/**
 * Vercel Cron job — checks for upcoming airing episodes and fires
 * Discord notifications for subscribed users.
 *
 * Security: validates CRON_SECRET header to prevent unauthorized invocation.
 * Runs on Node.js runtime (Prisma + crypto access), maxDuration 60s.
 */

import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import {
  GET_AIRING_SCHEDULE,
  type GetAiringScheduleResult,
} from "@/lib/anilist/queries";
import { executePublicQuery } from "@/lib/anilist/client";

export const maxDuration = 60;

const DISCORD_WEBHOOK_URL = "https://discord.com/api/v10";
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";

interface AiringNotification {
  mediaId: number;
  mediaTitle: string;
  episode: number;
  airingAt: number;
  discordUserIds: string[];
  channelId: string | null;
  guildId: string | null;
}

/** Sends a Discord message to a channel via the bot token. */
async function sendDiscordMessage(
  channelId: string,
  content: string,
  embeds?: unknown[],
): Promise<void> {
  if (!DISCORD_BOT_TOKEN) return;
  try {
    await fetch(`${DISCORD_WEBHOOK_URL}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, embeds }),
    });
  } catch {
    // Best-effort: notification failures must not crash the cron.
  }
}

/** Processes airing notifications for all subscribed users. */
async function processAiringNotifications(): Promise<{
  processed: number;
  fired: number;
}> {
  const now = Math.floor(Date.now() / 1000);
  const lookAhead = now + 6 * 3600; // Check next 6 hours.

  // Fetch upcoming airing schedule from AniList.
  const scheduleResult = await executePublicQuery<GetAiringScheduleResult>(
    GET_AIRING_SCHEDULE,
    { start: now, end: lookAhead, page: 1 },
    "cron",
    { cacheKey: `cron:schedule:${Math.floor(now / 300)}`, cacheTtlSeconds: 300 },
  );

  const schedules = scheduleResult.Page?.airingSchedules ?? [];
  if (schedules.length === 0) {
    return { processed: 0, fired: 0 };
  }

  let fired = 0;

  for (const schedule of schedules) {
    if (!schedule.media) continue;

    // Find all notification subs for this media that haven't been fired.
    const subs = await prisma.notificationSub.findMany({
      where: {
        mediaId: schedule.media.id,
        server: { airingAlertsEnabled: true },
      },
      include: {
        user: {
          select: {
            discordId: true,
            encryptedAccessToken: true,
          },
        },
        server: {
          select: {
            id: true,
            discordGuildId: true,
            notificationChannelId: true,
            pingRoleId: true,
          },
        },
      },
    });

    if (subs.length === 0) continue;

    // Group by server/channel for batched delivery.
    const byChannel = new Map<string, AiringNotification>();

    for (const sub of subs) {
      if (!sub.user.discordId) continue;

      // Check if already fired.
      const alreadyFired = await prisma.firedNotification.findUnique({
        where: {
          airingId_discordUserId: {
            airingId: schedule.id,
            discordUserId: sub.user.discordId,
          },
        },
      });
      if (alreadyFired) continue;

      const channelKey = sub.server.notificationChannelId ?? sub.server.id;
      const existing = byChannel.get(channelKey);

      if (existing) {
        existing.discordUserIds.push(sub.user.discordId);
      } else {
        byChannel.set(channelKey, {
          mediaId: schedule.media.id,
          mediaTitle: schedule.media.title.userPreferred,
          episode: schedule.episode,
          airingAt: schedule.airingAt,
          discordUserIds: [sub.user.discordId],
          channelId: sub.server.notificationChannelId,
          guildId: sub.server.discordGuildId,
        });
      }
    }

    // Send notifications.
    for (const [, notif] of byChannel) {
      if (!notif.channelId) continue;

      const mentions = notif.discordUserIds
        .map((id) => `<@${id}>`)
        .join(" ");

      const message = `🔔 **${notif.mediaTitle}** — Episode ${notif.episode} airs in ${formatCountdown(notif.airingAt - now)}!\n${mentions}`;

      await sendDiscordMessage(notif.channelId, message);

      // Record fired notifications.
      for (const discordUserId of notif.discordUserIds) {
        try {
          await prisma.firedNotification.create({
            data: { airingId: schedule.id, discordUserId },
          });
        } catch {
          // Unique constraint: already fired, skip.
        }
      }
      fired++;
    }
  }

  return { processed: schedules.length, fired };
}

/** Formats seconds into a human-readable countdown. */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "now";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export async function GET(request: Request): Promise<Response> {
  // Security: validate CRON_SECRET.
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET ?? "";
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await processAiringNotifications();
    return Response.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}