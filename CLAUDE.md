# AniSync — Project Memory

## Mission
Production-grade Discord Bot + Next.js 14 Web Dashboard providing full two-way synchronization with AniList accounts (including private profiles via per-user OAuth). Optimized for Vercel serverless hosting with zero persistent server processes.

---

## Tech Stack Decisions

| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 14+ App Router on Vercel | Edge-compatible, serverless-first |
| Bot Engine | Discord HTTP Interactions via Route Handlers | No WebSockets, no persistent server |
| ORM | Prisma → Neon Postgres (pooled) | Type-safe, serverless connection pooling |
| Auth | NextAuth.js v5 (Auth.js) — AniList + Discord OAuth2 | Per-user token management |
| Cache | Upstash Redis (HTTP-only) | Serverless-safe, no TCP connections |
| UI Library | Tailwind + Shadcn UI + Framer Motion | Composable, accessible, animated |
| Data Fetching | TanStack Query v5 | Optimistic updates, cache management |
| State | Zustand | Lightweight client state |
| Validation | Zod | Runtime + compile-time type safety |
| GraphQL | `graphql-request` | Lightweight, typed GraphQL client |

---

## Security Architecture

### S1 — AES-256-GCM Token Encryption
- AniList `access_token` and `refresh_token` MUST be encrypted before ANY database write
- Key material: `ENCRYPTION_KEY` env var (32-byte hex — never committed to git)
- Cipher: `aes-256-gcm` with random 12-byte IV per encryption operation
- Stored format: JSON string `{"iv":"<hex>","tag":"<hex>","ciphertext":"<hex>"}`
- Functions: `encryptToken(plain: string): string` and `decryptToken(stored: string): string`
- Failure mode: throw `CryptoError` — never return partial/empty data silently

### S2 — Discord Ed25519 Signature Verification
- Verify BEFORE reading body content on every Discord interaction request
- Use `verifyKey(rawBody, signature, timestamp, publicKey)` from `discord-interactions`
- Immediate `HTTP 401` with no body on failure — do not reveal why verification failed
- Must be Edge Runtime compatible (no Node.js `crypto` module — use `crypto.subtle`)

### S3 — Rate Limiting (Upstash Sliding Window)
- Discord Interactions: 100 req/min per Discord Application ID
- Dashboard mutation APIs: 60 req/min per authenticated user session
- Public APIs: 20 req/min per IP
- Response on limit: `HTTP 429` with `Retry-After` header (seconds until window resets)

### S4 — Session Validation
- All dashboard mutation routes: validate `auth()` session server-side before processing
- User can only mutate their OWN AniList data — validate `session.user.anilistId` matches request target

---

## Cross-File Dependency Map

```
PHASE 1 — Foundation (no dependencies)
  CLAUDE.md
  prisma/schema.prisma
  types/anilist.ts
  types/discord.ts
  lib/crypto.ts
  lib/db.ts
  lib/redis.ts

PHASE 2 — API Layer (depends on Phase 1)
  lib/auth.ts
  lib/anilist/client.ts
  lib/anilist/queries.ts
  lib/anilist/mutations.ts

PHASE 3 — Route Handlers (depends on Phase 1 + 2)
  app/api/auth/[...nextauth]/route.ts
  app/api/discord/interactions/route.ts
  app/api/cron/check-airing/route.ts
  app/api/sync/progress/route.ts
  app/api/config/server/route.ts

PHASE 4 — Anime UI Components (depends on types/)
  components/anime/StreamingBadges.tsx
  components/anime/TrailerModal.tsx
  components/anime/CharacterCarousel.tsx
  components/anime/ScoreDistributionChart.tsx
  components/anime/RelationsGraph.tsx
  components/anime/AnimeHeroCard.tsx
  components/anime/GenreHeatmap.tsx
  components/anime/WatchlistTable.tsx

PHASE 5 — Pages (depends on all above)
  app/layout.tsx
  app/page.tsx
  app/dashboard/layout.tsx
  app/dashboard/page.tsx
  app/dashboard/watchlist/page.tsx
  app/dashboard/config/page.tsx
  app/anime/[id]/page.tsx
  vercel.json
```

---

## Naming Conventions

- Files: kebab-case (`anilist-client.ts`, `watchlist-table.tsx`)
- Directories: kebab-case (`components/anime/`, `lib/anilist/`)
- TypeScript types/interfaces: PascalCase (`AniListMedia`, `MediaTag`)
- React components: PascalCase (`AnimeHeroCard`, `WatchlistTable`)
- Functions/variables: camelCase (`encryptToken`, `decryptToken`, `getMediaDetail`)
- Constants: UPPER_SNAKE_CASE (`ENCRYPTION_KEY`, `DISCORD_PUBLIC_KEY`)
- Database models: PascalCase (`User`, `Server`, `ServerMember`, `NotificationSub`, `FiredNotification`)
- Environment variables: UPPER_SNAKE_CASE

---

## Environment Variable Manifest

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Production URL |
| `ANILIST_CLIENT_ID` | Yes | AniList OAuth App |
| `ANILIST_CLIENT_SECRET` | Yes | AniList OAuth App |
| `DISCORD_CLIENT_ID` | Yes | Discord App |
| `DISCORD_CLIENT_SECRET` | Yes | Discord App |
| `DISCORD_BOT_TOKEN` | Yes | Discord Bot Token |
| `DISCORD_PUBLIC_KEY` | Yes | From Discord Developer Portal |
| `DATABASE_URL` | Yes | Pooled connection string (Neon/Supabase) |
| `DIRECT_URL` | Yes | Direct connection for migrations |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis REST Token |
| `ENCRYPTION_KEY` | Yes | `openssl rand -hex 32` — never commit |
| `CRON_SECRET` | Yes | `openssl rand -base64 32` |

---

## Known Constraints

- **Edge Runtime**: Discord interactions route must be Edge-compatible — no Node.js `crypto`, `fs`, or `path` modules; use `crypto.subtle` Web Crypto API
- **Vercel Function Timeout**: Serverless functions max out at 60s (Pro) / 10s (Hobby) — cron jobs need `maxDuration: 60`
- **No persistent server**: Discord bot uses HTTP interactions, not WebSocket gateway
- **Serverless DB**: Must use connection pooling (Neon pooled) — Prisma client singleton pattern required
- **Token encryption**: AES-256-GCM with per-operation IV; key rotation not supported in v1

---

## Quality Gates (enforce after every file)

1. `pnpm tsc --noEmit` — zero type errors
2. `pnpm eslint <filepath> --max-warnings=0` — zero lint warnings
3. `pnpm prisma validate` — after schema changes
4. Zero `any` types — use `unknown` + type guards or explicit interfaces
5. Zero hardcoded secrets
6. Zero truncated code — every function complete
7. All imports from installed packages
8. Error boundaries: every async op has typed catch blocks
9. Security: token decryption and signature verification have explicit failure modes
10. Responsive: Tailwind responsive prefixes (`sm:`, `md:`, `lg:`)
11. Accessibility: `aria-label`, `role`, keyboard handlers on interactive elements
12. Anime data: all optional fields null-checked before render