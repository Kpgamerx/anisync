/**
 * Upstash Redis client + rate limiters (Security rule S3).
 *
 * Upstash's REST client is HTTP-only — safe for both Node.js serverless
 * functions and Edge Runtime (no TCP connections). If credentials are absent
 * the client degrades to a no-op cache and unlimited rate limiting so that
 * local development and type-checking environments do not hard-crash.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const isRedisConfigured =
  typeof redisUrl === "string" &&
  redisUrl.length > 0 &&
  typeof redisToken === "string" &&
  redisToken.length > 0;

/**
 * Shared Redis client. `null` when Upstash is not configured — every
 * consumer MUST null-check before use.
 */
export const redis: Redis | null = isRedisConfigured
  ? new Redis({ url: redisUrl as string, token: redisToken as string })
  : null;

/**
 * Wraps a Redis read with an in-memory fallback so cache-miss code paths
 * behave identically whether or not Redis is configured.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redis === null) return null;
  try {
    const value = await redis.get<T>(key);
    return value ?? null;
  } catch {
    // Cache failures must never break the request path.
    return null;
  }
}

/**
 * Writes a cache entry with TTL. Never throws — cache write failures are
 * logged and swallowed so they cannot degrade the request path.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (redis === null) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // Intentionally swallowed: cache is best-effort.
  }
}

/** Deletes a cache entry. Never throws. */
export async function cacheDelete(key: string): Promise<void> {
  if (redis === null) return;
  try {
    await redis.del(key);
  } catch {
    // Intentionally swallowed: cache is best-effort.
  }
}

/**
 * Rate limiter factory. Returns a no-op limiter that always allows requests
 * when Upstash is unconfigured (development / type-check environments).
 */
function createLimiter(
  prefix: string,
  limit: number,
  window: `${number} ${"s" | "m" | "h"}`,
): Ratelimit | null {
  if (redis === null) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `anisync:ratelimit:${prefix}`,
    ephemeralCache: true,
  });
}

/** S3: Discord Interactions — 100 req/min per Discord Application ID. */
export const discordInteractionLimiter = createLimiter(
  "discord",
  100,
  "1 m",
);

/** S3: Dashboard mutation APIs — 60 req/min per authenticated user session. */
export const dashboardMutationLimiter = createLimiter(
  "dashboard",
  60,
  "1 m",
);

/** S3: Public APIs — 20 req/min per IP. */
export const publicApiLimiter = createLimiter("public", 20, "1 m");

/** S3: AniList GraphQL proxy — 30 req/min per user to respect upstream limits. */
export const anilistLimiter = createLimiter("anilist", 30, "1 m");

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAfterSeconds: number;
}

const unlimited: RateLimitResult = {
  success: true,
  limit: Number.POSITIVE_INFINITY,
  remaining: Number.POSITIVE_INFINITY,
  resetAfterSeconds: 0,
};

/**
 * Consumes one rate limit token for the given limiter + identifier.
 * Never throws: an Upstash outage fails open (availability over strictness),
 * which is the accepted trade-off documented in CLAUDE.md.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<RateLimitResult> {
  if (limiter === null) return unlimited;
  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      resetAfterSeconds: Math.max(
        0,
        Math.ceil((result.reset - Date.now()) / 1000),
      ),
    };
  } catch {
    return unlimited;
  }
}

/** Builds the standard 429 response headers for a failed limit check. */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Retry-After": String(result.resetAfterSeconds),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };
}
