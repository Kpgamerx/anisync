/**
 * Discord Interactions webhook handler (Edge Runtime).
 *
 * Security rule S2: verifies the Ed25519 signature BEFORE reading the body.
 * Security rule S3: rate-limited per Discord Application ID (100 req/min).
 *
 * Supported commands:
 *   /login, /anime, /progress, /score, /status, /profile,
 *   /compare, /schedule, /recommend
 */

import { verifyKey } from "discord-interactions";
import {
  discordInteractionLimiter,
  checkRateLimit,
  rateLimitHeaders,
} from "@/lib/redis";
import {
  InteractionType,
  InteractionResponseType,
  type DiscordInteraction,
  type InteractionResponse,
  type DiscordEmbed,
  type EmbedField,
  type DiscordComponent,
  type DiscordButtonComponent,
  pongResponse,
  ephemeralMessageResponse,
  messageResponse,
  deferredResponse,
} from "@/types/discord";
import {
  GET_MEDIA_DETAIL,
  GET_USER_WATCHLIST,
  GET_AIRING_SCHEDULE,
  GET_MEDIA_RECOMMENDATIONS,
  SEARCH_ANIME,
  type GetMediaDetailResult,
  type GetAiringScheduleResult,
  type GetMediaRecommendationsResult,
  type SearchAnimeResult,
} from "@/lib/anilist/queries";
import {
  SAVE_MEDIA_LIST_ENTRY,
  buildSaveEntryVariables,
  type SaveMediaListEntryResult,
} from "@/lib/anilist/mutations";
import { executePublicQuery, executeQuery } from "@/lib/anilist/client";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { stripHtml, scoreToColor } from "@/types/anilist";

export const runtime = "edge";

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY ?? "";
const ANILIST_OAUTH_REDIRECT = `${process.env.NEXTAUTH_URL ?? ""}/api/auth/callback/anilist`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Verifies the Discord Ed25519 signature (S2). Returns true only on valid. */
async function verifyDiscordSignature(
  rawBody: Uint8Array,
  signature: string,
  timestamp: string,
): Promise<boolean> {
  if (!DISCORD_PUBLIC_KEY || !signature || !timestamp) return false;
  try {
    return await verifyKey(rawBody, signature, timestamp, DISCORD_PUBLIC_KEY);
  } catch {
    return false;
  }
}

/** Converts a hex color string to a Discord embed integer color. */
function hexToInt(hex: string | null): number {
  if (!hex) return 0x00f2fe;
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return Number.isNaN(num) ? 0x00f2fe : num;
}

/** Formats seconds into "Xd Yh Zm" for airing countdowns. */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "now";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(" ") || "<1m";
}

/** Resolves the AniList access token for a Discord user (S1 decryption). */
async function getAniListTokenForDiscordUser(
  discordId: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { discordId },
    select: { encryptedAccessToken: true, tokenExpiresAt: true },
  });
  if (!user?.encryptedAccessToken) return null;
  if (user.tokenExpiresAt && user.tokenExpiresAt.getTime() <= Date.now()) {
    return null;
  }
  try {
    return decryptToken(user.encryptedAccessToken);
  } catch {
    return null;
  }
}

/** Builds the rich Discord embed for the /anime command. */
function buildAnimeEmbed(media: GetMediaDetailResult["Media"]): DiscordEmbed {
  if (!media) {
    return { title: "Anime not found", color: hexToInt(null) };
  }

  const studio = media.studios.nodes.find((s) => s.isAnimationStudio) ??
    media.studios.nodes[0] ??
    null;

  const streamingLinks = media.externalLinks
    .filter((l) => l.type === "STREAMING")
    .map((l) => l.site)
    .slice(0, 5);

  const fields: EmbedField[] = [
    {
      name: "Score",
      value: `⭐ ${media.averageScore ?? "—"}/100 · ❤️ ${media.favourites}`,
      inline: true,
    },
    {
      name: "Episodes",
      value: `${media.episodes ?? "—"}${media.duration ? ` · ${media.duration} min/ep` : ""}`,
      inline: true,
    },
    {
      name: "Status",
      value: media.status ?? "Unknown",
      inline: true,
    },
    {
      name: "Genres",
      value: media.genres.slice(0, 3).join(", ") || "—",
      inline: true,
    },
  ];

  if (media.nextAiringEpisode) {
    fields.push({
      name: "Airing",
      value: `Ep ${media.nextAiringEpisode.episode} airs in ${formatCountdown(media.nextAiringEpisode.timeUntilAiring)}`,
      inline: true,
    });
  } else if (media.startDate.year) {
    fields.push({
      name: "Aired",
      value: `${media.startDate.year}`,
      inline: true,
    });
  }

  if (streamingLinks.length > 0) {
    fields.push({
      name: "Streaming",
      value: streamingLinks.join(" · "),
      inline: false,
    });
  }

  const description = stripHtml(media.description);
  const truncated =
    description.length > 300
      ? `${description.slice(0, 300)}... [Read more](${media.siteUrl})`
      : description;

  return {
    title: media.title.userPreferred || media.title.romaji,
    url: media.siteUrl,
    description: truncated || undefined,
    color: hexToInt(media.coverImage.color),
    timestamp: new Date().toISOString(),
    thumbnail: { url: media.coverImage.large },
    image: media.bannerImage ? { url: media.bannerImage } : undefined,
    author: studio
      ? {
          name: `${studio.name} | ${media.format} | ${media.seasonYear ?? ""}`.trim(),
        }
      : undefined,
    fields,
    footer: { text: "AniSync · Powered by AniList" },
  };
}

/** Builds the action row of buttons for the /anime embed. */
function buildAnimeButtons(mediaId: number): DiscordComponent[] {
  const buttons: DiscordButtonComponent[] = [
    {
      type: 2,
      style: 1,
      label: "+ Add to List",
      custom_id: `add_${mediaId}`,
    },
    {
      type: 2,
      style: 2,
      label: "View on AniList",
      url: `https://anilist.co/anime/${mediaId}`,
    },
  ];
  return [{ type: 1, components: buttons }];
}

/* ------------------------------------------------------------------ */
/* Command handlers                                                    */
/* ------------------------------------------------------------------ */

/** Handles /anime [search] — searches by name, returns rich embed. */
async function handleAnimeCommand(
  interaction: DiscordInteraction,
): Promise<InteractionResponse> {
  const searchOption = interaction.data?.options?.find(
    (o) => o.name === "search",
  );
  const searchValue =
    typeof searchOption?.value === "string" ? searchOption.value : "";

  if (!searchValue) {
    return ephemeralMessageResponse("Please provide an anime title to search.");
  }

  const searchResult = await executePublicQuery<SearchAnimeResult>(
    SEARCH_ANIME,
    { search: searchValue, perPage: 1 },
    interaction.member?.user?.id ?? interaction.user?.id ?? "anonymous",
    { cacheKey: `search:${searchValue}`, cacheTtlSeconds: 300 },
  );

  const firstMatch = searchResult.Page?.media[0];
  if (!firstMatch) {
    return ephemeralMessageResponse(`No anime found for "${searchValue}".`);
  }

  const detailResult = await executePublicQuery<GetMediaDetailResult>(
    GET_MEDIA_DETAIL,
    { id: firstMatch.id },
    interaction.member?.user?.id ?? interaction.user?.id ?? "anonymous",
    { cacheKey: `media:${firstMatch.id}`, cacheTtlSeconds: 300 },
  );

  if (!detailResult.Media) {
    return ephemeralMessageResponse("Anime details could not be loaded.");
  }

  return messageResponse(
    [buildAnimeEmbed(detailResult.Media)],
    buildAnimeButtons(firstMatch.id),
  );
}

/** Handles /progress +1 — increments the user's current episode. */
async function handleProgressIncrement(
  interaction: DiscordInteraction,
): Promise<InteractionResponse> {
  const discordId = interaction.member?.user?.id ?? interaction.user?.id;
  if (!discordId) {
    return ephemeralMessageResponse("Could not identify your Discord account.");
  }

  const token = await getAniListTokenForDiscordUser(discordId);
  if (!token) {
    return ephemeralMessageResponse(
      "Your AniList account is not linked. Use `/login` to connect.",
    );
  }

  const mediaIdOption = interaction.data?.options?.find(
    (o) => o.name === "media_id",
  );
  const mediaId =
    typeof mediaIdOption?.value === "number"
      ? mediaIdOption.value
      : typeof mediaIdOption?.value === "string"
        ? parseInt(mediaIdOption.value, 10)
        : NaN;

  if (Number.isNaN(mediaId)) {
    return ephemeralMessageResponse("Please specify a valid media ID.");
  }

  // Fetch current entry to get existing progress.
  const detailResult = await executeQuery<GetMediaDetailResult>(
    GET_MEDIA_DETAIL,
    { id: mediaId },
  );
  if (!detailResult.Media) {
    return ephemeralMessageResponse("Anime not found on AniList.");
  }

  const currentProgress = detailResult.Media.mediaListEntry?.progress ?? 0;
  const newProgress = currentProgress + 1;

  const result = await executeQuery<SaveMediaListEntryResult>(
    SAVE_MEDIA_LIST_ENTRY,
    buildSaveEntryVariables(mediaId, { progress: newProgress }),
  );

  if (!result.SaveMediaListEntry) {
    return ephemeralMessageResponse("Failed to update progress on AniList.");
  }

  return ephemeralMessageResponse(
    `Progress updated: **${detailResult.Media.title.userPreferred}** — episode ${newProgress}/${detailResult.Media.episodes ?? "?"}`,
  );
}

/** Handles /score [title] [score] — updates the user's score. */
async function handleScoreCommand(
  interaction: DiscordInteraction,
): Promise<InteractionResponse> {
  const discordId = interaction.member?.user?.id ?? interaction.user?.id;
  if (!discordId) {
    return ephemeralMessageResponse("Could not identify your Discord account.");
  }

  const token = await getAniListTokenForDiscordUser(discordId);
  if (!token) {
    return ephemeralMessageResponse(
      "Your AniList account is not linked. Use `/login` to connect.",
    );
  }

  const options = interaction.data?.options ?? [];
  const titleOption = options.find((o) => o.name === "title");
  const scoreOption = options.find((o) => o.name === "score");
  const searchValue =
    typeof titleOption?.value === "string" ? titleOption.value : "";
  const scoreValue =
    typeof scoreOption?.value === "number"
      ? scoreOption.value
      : typeof scoreOption?.value === "string"
        ? parseFloat(scoreOption.value)
        : NaN;

  if (!searchValue || Number.isNaN(scoreValue)) {
    return ephemeralMessageResponse("Please provide both a title and a score.");
  }

  const searchResult = await executePublicQuery<SearchAnimeResult>(
    SEARCH_ANIME,
    { search: searchValue, perPage: 1 },
    discordId,
    { cacheKey: `search:${searchValue}`, cacheTtlSeconds: 300 },
  );

  const firstMatch = searchResult.Page?.media[0];
  if (!firstMatch) {
    return ephemeralMessageResponse(`No anime found for "${searchValue}".`);
  }

  const result = await executeQuery<SaveMediaListEntryResult>(
    SAVE_MEDIA_LIST_ENTRY,
    buildSaveEntryVariables(firstMatch.id, { score: scoreValue }),
  );

  if (!result.SaveMediaListEntry) {
    return ephemeralMessageResponse("Failed to update score on AniList.");
  }

  return ephemeralMessageResponse(
    `Score updated: **${firstMatch.title.userPreferred}** — ${scoreValue}/100`,
  );
}

/** Handles /status [title] [status] — changes watching status. */
async function handleStatusCommand(
  interaction: DiscordInteraction,
): Promise<InteractionResponse> {
  const discordId = interaction.member?.user?.id ?? interaction.user?.id;
  if (!discordId) {
    return ephemeralMessageResponse("Could not identify your Discord account.");
  }

  const token = await getAniListTokenForDiscordUser(discordId);
  if (!token) {
    return ephemeralMessageResponse(
      "Your AniList account is not linked. Use `/login` to connect.",
    );
  }

  const options = interaction.data?.options ?? [];
  const titleOption = options.find((o) => o.name === "title");
  const statusOption = options.find((o) => o.name === "status");
  const searchValue =
    typeof titleOption?.value === "string" ? titleOption.value : "";
  const statusValue =
    typeof statusOption?.value === "string" ? statusOption.value : "";

  if (!searchValue || !statusValue) {
    return ephemeralMessageResponse("Please provide both a title and a status.");
  }

  const searchResult = await executePublicQuery<SearchAnimeResult>(
    SEARCH_ANIME,
    { search: searchValue, perPage: 1 },
    discordId,
    { cacheKey: `search:${searchValue}`, cacheTtlSeconds: 300 },
  );

  const firstMatch = searchResult.Page?.media[0];
  if (!firstMatch) {
    return ephemeralMessageResponse(`No anime found for "${searchValue}".`);
  }

  const result = await executeQuery<SaveMediaListEntryResult>(
    SAVE_MEDIA_LIST_ENTRY,
    buildSaveEntryVariables(firstMatch.id, {
      status: statusValue as
        | "CURRENT"
        | "PLANNING"
        | "COMPLETED"
        | "DROPPED"
        | "PAUSED"
        | "REPEATING",
    }),
  );

  if (!result.SaveMediaListEntry) {
    return ephemeralMessageResponse("Failed to update status on AniList.");
  }

  return ephemeralMessageResponse(
    `Status updated: **${firstMatch.title.userPreferred}** — ${statusValue}`,
  );
}

/** Handles /login — generates an AniList OAuth link for the Discord user. */
async function handleLoginCommand(
  interaction: DiscordInteraction,
): Promise<InteractionResponse> {
  const discordId = interaction.member?.user?.id ?? interaction.user?.id;
  if (!discordId) {
    return ephemeralMessageResponse("Could not identify your Discord account.");
  }

  const clientId = process.env.ANILIST_CLIENT_ID ?? "";
  if (!clientId) {
    return ephemeralMessageResponse(
      "AniList OAuth is not configured. Please contact the bot administrator.",
    );
  }

  const redirectUri = encodeURIComponent(ANILIST_OAUTH_REDIRECT);
  const stateParam = encodeURIComponent(`discord:${discordId}`);
  const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&state=${stateParam}`;

  return ephemeralMessageResponse(
    `Link your AniList account: [Click here](${authUrl})\nThis link expires in 10 minutes. After linking, use \`/profile\` to view your stats.`,
  );
}

/** Handles /schedule — shows today's airing schedule. */
async function handleScheduleCommand(
  interaction: DiscordInteraction,
): Promise<InteractionResponse> {
  const now = Math.floor(Date.now() / 1000);
  const endOfDay = now + 24 * 3600;

  const result = await executePublicQuery<GetAiringScheduleResult>(
    GET_AIRING_SCHEDULE,
    { start: now, end: endOfDay, page: 1 },
    interaction.member?.user?.id ?? interaction.user?.id ?? "anonymous",
    { cacheKey: `schedule:${now}`, cacheTtlSeconds: 300 },
  );

  const schedules = result.Page?.airingSchedules ?? [];
  if (schedules.length === 0) {
    return ephemeralMessageResponse("No episodes airing in the next 24 hours.");
  }

  const lines = schedules
    .slice(0, 10)
    .map((s) => {
      const title = s.media?.title.userPreferred ?? "Unknown";
      const countdown = formatCountdown(s.timeUntilAiring);
      return `**Ep ${s.episode}** — ${title} (${countdown})`;
    })
    .join("\n");

  return messageResponse(
    undefined,
    undefined,
    `**Airing in the next 24 hours:**\n${lines}`,
  );
}

/** Handles /recommend [title] — shows recommendations. */
async function handleRecommendCommand(
  interaction: DiscordInteraction,
): Promise<InteractionResponse> {
  const titleOption = interaction.data?.options?.find(
    (o) => o.name === "title",
  );
  const searchValue =
    typeof titleOption?.value === "string" ? titleOption.value : "";

  if (!searchValue) {
    return ephemeralMessageResponse("Please provide a title to get recommendations.");
  }

  const searchResult = await executePublicQuery<SearchAnimeResult>(
    SEARCH_ANIME,
    { search: searchValue, perPage: 1 },
    interaction.member?.user?.id ?? interaction.user?.id ?? "anonymous",
    { cacheKey: `search:${searchValue}`, cacheTtlSeconds: 300 },
  );

  const firstMatch = searchResult.Page?.media[0];
  if (!firstMatch) {
    return ephemeralMessageResponse(`No anime found for "${searchValue}".`);
  }

  const recResult = await executePublicQuery<GetMediaRecommendationsResult>(
    GET_MEDIA_RECOMMENDATIONS,
    { mediaId: firstMatch.id, page: 1 },
    interaction.member?.user?.id ?? interaction.user?.id ?? "anonymous",
    { cacheKey: `recs:${firstMatch.id}`, cacheTtlSeconds: 600 },
  );

  const recs =
    recResult.Media?.recommendations?.nodes
      .filter((n) => n.mediaRecommendation !== null)
      .slice(0, 5) ?? [];

  if (recs.length === 0) {
    return ephemeralMessageResponse(
      `No recommendations found for **${firstMatch.title.userPreferred}**.`,
    );
  }

  const lines = recs
    .map((n) => {
      const rec = n.mediaRecommendation!;
      const score = rec.averageScore ?? "—";
      return `**${rec.title.userPreferred}** — ⭐ ${score}/100`;
    })
    .join("\n");

  return messageResponse(
    undefined,
    undefined,
    `**Recommendations for ${firstMatch.title.userPreferred}:**\n${lines}`,
  );
}

/** Handles /profile — shows the user's AniList stats. */
async function handleProfileCommand(
  interaction: DiscordInteraction,
): Promise<InteractionResponse> {
  const discordId = interaction.member?.user?.id ?? interaction.user?.id;
  if (!discordId) {
    return ephemeralMessageResponse("Could not identify your Discord account.");
  }

  const user = await prisma.user.findUnique({
    where: { discordId },
    select: { anilistId: true, anilistUsername: true },
  });

  if (!user?.anilistId) {
    return ephemeralMessageResponse(
      "Your AniList account is not linked. Use `/login` to connect.",
    );
  }

  const watchlistResult = await executePublicQuery(
    GET_USER_WATCHLIST,
    { userId: user.anilistId, status: "COMPLETED" },
    discordId,
    { cacheKey: `watchlist:${user.anilistId}:COMPLETED`, cacheTtlSeconds: 300 },
  );

  const entries = watchlistResult.MediaListCollection?.lists ?? [];
  const totalCompleted = entries.reduce(
    (sum, list) => sum + list.entries.length,
    0,
  );

  return messageResponse(
    undefined,
    undefined,
    `**${user.anilistUsername ?? "Your"} AniList Profile**\nTotal completed: ${totalCompleted} anime`,
  );
}

/* ------------------------------------------------------------------ */
/* Main route handler                                                  */
/* ------------------------------------------------------------------ */

export async function POST(request: Request): Promise<Response> {
  // S2: Verify signature BEFORE reading body content.
  const signature = request.headers.get("x-signature-ed25519") ?? "";
  const timestamp = request.headers.get("x-signature-timestamp") ?? "";

  const rawBody = await request.arrayBuffer();
  const bodyBytes = new Uint8Array(rawBody);

  const isValid = await verifyDiscordSignature(bodyBytes, signature, timestamp);
  if (!isValid) {
    return new Response(null, { status: 401 });
  }

  // S3: Rate limit per Discord Application ID.
  const interaction = JSON.parse(
    new TextDecoder().decode(bodyBytes),
  ) as DiscordInteraction;

  const rateLimit = await checkRateLimit(
    discordInteractionLimiter,
    interaction.application_id,
  );
  if (!rateLimit.success) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded" }),
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  // Handle PING (verification handshake).
  if (interaction.type === InteractionType.PING) {
    return Response.json(pongResponse());
  }

  // Route to command handler.
  const commandName = interaction.data?.name ?? "";
  let response: InteractionResponse;

  try {
    switch (commandName) {
      case "login":
        response = await handleLoginCommand(interaction);
        break;
      case "anime":
        response = await handleAnimeCommand(interaction);
        break;
      case "progress":
        response = await handleProgressIncrement(interaction);
        break;
      case "score":
        response = await handleScoreCommand(interaction);
        break;
      case "status":
        response = await handleStatusCommand(interaction);
        break;
      case "profile":
        response = await handleProfileCommand(interaction);
        break;
      case "schedule":
        response = await handleScheduleCommand(interaction);
        break;
      case "recommend":
        response = await handleRecommendCommand(interaction);
        break;
      default:
        response = ephemeralMessageResponse(
          `Unknown command: ${commandName}`,
        );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    response = ephemeralMessageResponse(`Error: ${message}`);
  }

  return Response.json(response);
}

export async function GET(): Promise<Response> {
  return new Response("Discord interactions endpoint. POST only.", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}