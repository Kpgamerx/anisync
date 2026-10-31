/**
 * Typed AniList GraphQL client.
 *
 * - Handles auth (per-user decrypted token), rate limiting (S3), retries with
 *   exponential backoff for 429/500s, and Redis-backed response caching.
 * - Exports both `executeQuery` (viewer-authenticated) and
 *   `executePublicQuery` (unauthenticated, rate-limited per IP).
 */

import {
  GraphQLClient,
  type RequestExtendedVariables,
  type RequestDocument,
} from "graphql-request";
import {
  anilistLimiter,
  cacheGet,
  cacheSet,
  checkRateLimit,
} from "@/lib/redis";

export const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";

export class AniListError extends Error {
  readonly status: number;
  constructor(message: string, status: number, cause?: unknown) {
    super(message);
    this.name = "AniListError";
    this.status = status;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export interface AniListGraphQLError {
  message: string;
  status?: number;
  locations?: Array<{ line: number; column: number }>;
}

interface AniListErrorBody {
  errors?: AniListGraphQLError[];
  data?: unknown;
}

const publicClient = new GraphQLClient(ANILIST_GRAPHQL_URL, {
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

const authenticatedClient = new GraphQLClient(ANILIST_GRAPHQL_URL, {
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

/** Applies a decrypted per-user token to the authenticated client. */
export function setAuthToken(accessToken: string): void {
  authenticatedClient.setHeaders({
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  });
}

/** Clears auth headers (e.g. after a token refresh failure). */
export function clearAuthToken(): void {
  authenticatedClient.setHeaders({
    "Content-Type": "application/json",
    Accept: "application/json",
  });
}

/** Retries an async fn on 429/5xx with exponential backoff + jitter. */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status =
        error instanceof AniListError
          ? error.status
          : typeof (error as { response?: { status?: number } }).response
              ?.status === "number"
            ? (error as { response: { status: number } }).response.status
            : undefined;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt === maxAttempts) break;
      const backoffMs = Math.min(8000, 500 * 2 ** (attempt - 1));
      const jitterMs = Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, backoffMs + jitterMs));
    }
  }
  throw lastError;
}

/** Normalizes a fetch/graphql failure into a typed AniListError. */
function normalizeError(error: unknown, fallbackStatus = 502): AniListError {
  if (error instanceof AniListError) return error;

  // graphql-request ClientError shape.
  if (error instanceof Error && "response" in error) {
    const body = (error as { response?: AniListErrorBody }).response;
    if (body && Array.isArray(body.errors) && body.errors.length > 0) {
      const first = body.errors[0];
      return new AniListError(first.message, first.status ?? 400, error);
    }
    return new AniListError("AniList request failed.", fallbackStatus, error);
  }
  if (error instanceof Error) {
    return new AniListError(error.message, fallbackStatus, error);
  }
  return new AniListError("AniList request failed with unknown error.", fallbackStatus, error);
}

export interface ExecuteOptions {
  /** Cache key — omit to bypass caching entirely (mutations). */
  cacheKey?: string;
  /** Cache TTL in seconds. Defaults to 300 (5 min). */
  cacheTtlSeconds?: number;
  /** Retry policy: 0 disables, defaults to 3. */
  maxRetries?: number;
}

/**
 * Executes an authenticated GraphQL request using the currently set token
 * (set via `setAuthToken`). Use for Viewer-scoped queries and all mutations.
 */
export async function executeQuery<TResult>(
  document: RequestDocument,
  variables?: RequestExtendedVariables<TResult, Record<string, unknown>>,
  options: ExecuteOptions = {},
): Promise<TResult> {
  const { maxRetries = 3 } = options;
  try {
    return await withRetry(
      () => authenticatedClient.request<TResult>(document, variables),
      maxRetries,
    );
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * Executes a public (unauthenticated) GraphQL request, rate-limited per IP
 * (S3: 20 req/min) and cached in Redis when a cache key is provided.
 */
export async function executePublicQuery<TResult>(
  document: RequestDocument,
  variables: Record<string, unknown> | undefined,
  ip: string,
  options: ExecuteOptions = {},
): Promise<TResult> {
  const { cacheKey, cacheTtlSeconds = 300, maxRetries = 3 } = options;

  if (cacheKey !== undefined) {
    const cached = await cacheGet<TResult>(cacheKey);
    if (cached !== null) return cached;
  }

  const limit = await checkRateLimit(anilistLimiter, ip);
  if (!limit.success) {
    throw new AniListError("AniList rate limit exceeded.", 429);
  }

  try {
    const result = await withRetry(
      () => publicClient.request<TResult>(document, variables),
      maxRetries,
    );
    if (cacheKey !== undefined) {
      await cacheSet(cacheKey, result, cacheTtlSeconds);
    }
    return result;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * Executes a query on behalf of the current user's AniList account.
 * Combines rate limiting (per user), caching, and auth token handling.
 */
export async function executeUserQuery<TResult>(
  document: RequestDocument,
  variables: Record<string, unknown> | undefined,
  userId: string,
  options: ExecuteOptions = {},
): Promise<TResult> {
  const { cacheKey, cacheTtlSeconds = 60, maxRetries = 3 } = options;

  if (cacheKey !== undefined) {
    const cached = await cacheGet<TResult>(cacheKey);
    if (cached !== null) return cached;
  }

  const limit = await checkRateLimit(anilistLimiter, userId);
  if (!limit.success) {
    throw new AniListError("AniList rate limit exceeded.", 429);
  }

  try {
    const result = await withRetry(
      () => authenticatedClient.request<TResult>(document, variables),
      maxRetries,
    );
    if (cacheKey !== undefined) {
      await cacheSet(cacheKey, result, cacheTtlSeconds);
    }
    return result;
  } catch (error) {
    throw normalizeError(error);
  }
}
