/**
 * POST /api/config/server — saves or updates the Discord server
 * configuration (notification channel, ping role, timezone, etc.).
 *
 * Security:
 *   S3: Rate-limited per authenticated user session (60 req/min).
 *   S4: Validates auth() session server-side; only the server admin
 *       (the authenticated user must be a member of the guild) can
 *       update the config.
 */

import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  dashboardMutationLimiter,
  checkRateLimit,
  rateLimitHeaders,
} from "@/lib/redis";

const configSchema = z.object({
  guildId: z.string().min(1),
  guildName: z.string().optional(),
  guildIcon: z.string().optional(),
  notificationChannelId: z.string().optional().nullable(),
  pingRoleId: z.string().optional().nullable(),
  timezone: z.string().default("UTC"),
  titleLanguage: z
    .enum(["ROMAJI", "ENGLISH", "NATIVE"])
    .default("ROMAJI"),
  preferDub: z.boolean().default(false),
  airingAlertsEnabled: z.boolean().default(true),
});

export async function POST(request: Request): Promise<Response> {
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

  // S3: Rate limit.
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

  const parsed = configSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const config = parsed.data;

  // Verify the user is a member of this server.
  const membership = await prisma.serverMember.findFirst({
    where: {
      userId,
      server: { discordGuildId: config.guildId },
    },
  });

  if (!membership) {
    // Auto-create the server record if it doesn't exist, then link the user.
    const existingServer = await prisma.server.findUnique({
      where: { discordGuildId: config.guildId },
    });

    if (!existingServer) {
      // Create server + membership in a transaction.
      await prisma.$transaction([
        prisma.server.create({
          data: {
            discordGuildId: config.guildId,
            guildName: config.guildName ?? null,
            guildIcon: config.guildIcon ?? null,
            notificationChannelId: config.notificationChannelId ?? null,
            pingRoleId: config.pingRoleId ?? null,
            timezone: config.timezone,
            titleLanguage: config.titleLanguage,
            preferDub: config.preferDub,
            airingAlertsEnabled: config.airingAlertsEnabled,
          },
        }),
        prisma.serverMember.create({
          data: { userId, server: { connect: { discordGuildId: config.guildId } } },
        }),
      ]);
    } else {
      // Link the user as a member.
      await prisma.serverMember.create({
        data: { userId, serverId: existingServer.id },
      }).catch(() => {
        // Already a member — ignore unique constraint violation.
      });
    }
  }

  // Upsert the server config.
  const upserted = await prisma.server.upsert({
    where: { discordGuildId: config.guildId },
    create: {
      discordGuildId: config.guildId,
      guildName: config.guildName ?? null,
      guildIcon: config.guildIcon ?? null,
      notificationChannelId: config.notificationChannelId ?? null,
      pingRoleId: config.pingRoleId ?? null,
      timezone: config.timezone,
      titleLanguage: config.titleLanguage,
      preferDub: config.preferDub,
      airingAlertsEnabled: config.airingAlertsEnabled,
    },
    update: {
      guildName: config.guildName ?? null,
      guildIcon: config.guildIcon ?? null,
      notificationChannelId: config.notificationChannelId ?? null,
      pingRoleId: config.pingRoleId ?? null,
      timezone: config.timezone,
      titleLanguage: config.titleLanguage,
      preferDub: config.preferDub,
      airingAlertsEnabled: config.airingAlertsEnabled,
    },
  });

  return Response.json({ ok: true, server: upserted });
}

export async function GET(request: Request): Promise<Response> {
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
      { error: "Invalid session" },
      { status: 401 },
    );
  }

  const guildId = new URL(request.url).searchParams.get("guildId");
  if (!guildId) {
    return Response.json(
      { error: "guildId query parameter is required" },
      { status: 400 },
    );
  }

  // Verify membership.
  const membership = await prisma.serverMember.findFirst({
    where: {
      userId,
      server: { discordGuildId: guildId },
    },
    include: { server: true },
  });

  if (!membership) {
    return Response.json(
      { error: "You are not a member of this server." },
      { status: 403 },
    );
  }

  return Response.json({ ok: true, server: membership.server });
}