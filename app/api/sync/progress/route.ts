/**
 * PATCH /api/sync/progress — updates the authenticated user's AniList
 * list entry (progress, score, status, notes).
 *
 * Security:
 *   S3: Rate-limited per authenticated user session (60 req/min).
 *   S4: Validates auth() session server-side; user can only mutate their
 *       own AniList data.
 */

import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import {
  dashboardMutationLimiter,
  checkRateLimit,
  rateLimitHeaders,
} from "@/lib/redis";
import {
  SAVE_MEDIA_LIST_ENTRY,
  buildSaveEntryVariables,
  type SaveMediaListEntryResult,
} from "@/lib/anilist/mutations";
import { executeQuery, setAuthToken } from "@/lib/anilist/client";

const patchSchema = z.object({
  mediaId: z.number().int().positive(),
  status: z
    .enum(["CURRENT", "PLANNING", "COMPLETED", "DROPPED", "PAUSED", "REPEATING"])
    .optional(),
  progress: z.number().int().min(0).optional(),
  score: z.number().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
});

export async function PATCH(request: Request): Promise<Response> {
  // S4: Validate session.
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const userId = session.user.id;
  if (!userId) {
    return Response.json(
      { error: "Invalid session — no user ID" },
      { status: 401 },
    );
  }

  // S3: Rate limit per authenticated user.
  const rateLimit = await checkRateLimit(dashboardMutationLimiter, userId);
  if (!rateLimit.success) {
    return Response.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  // Parse and validate body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // Resolve the user's encrypted AniList token and decrypt (S1).
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      encryptedAccessToken: true,
      tokenExpiresAt: true,
      anilistId: true,
    },
  });

  if (!dbUser?.encryptedAccessToken || !dbUser.anilistId) {
    return Response.json(
      { error: "AniList account not linked. Please connect via /login." },
      { status: 403 },
    );
  }

  if (dbUser.tokenExpiresAt && dbUser.tokenExpiresAt.getTime() <= Date.now()) {
    return Response.json(
      { error: "AniList token expired. Please re-link your account." },
      { status: 403 },
    );
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(dbUser.encryptedAccessToken);
  } catch {
    return Response.json(
      { error: "Token decryption failed. Please re-link your account." },
      { status: 403 },
    );
  }

  // Set the auth token on the GraphQL client and execute the mutation.
  setAuthToken(accessToken);

  try {
    const result = await executeQuery<SaveMediaListEntryResult>(
      SAVE_MEDIA_LIST_ENTRY,
      buildSaveEntryVariables(input.mediaId, input),
    );

    if (!result.SaveMediaListEntry) {
      return Response.json(
        { error: "AniList rejected the update." },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      entry: result.SaveMediaListEntry,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AniList request failed.";
    return Response.json(
      { error: message },
      { status: 502 },
    );
  }
}