/**
 * NextAuth.js v5 (Auth.js) configuration — AniList + Discord OAuth2.
 *
 * - Strategy: JWT. The Prisma adapter persists users, but AniList tokens are
 *   stored directly on our User row (AES-256-GCM encrypted, Security rule S1),
 *   so the session JWT carries only identifiers (id, anilistId, discordId).
 * - The AniList provider is a custom OAuth2 config: AniList has no userinfo
 *   endpoint, so the profile is resolved through the Viewer GraphQL query.
 */

import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Provider } from "next-auth/providers";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";

import { encryptToken, decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";

const ANILIST_TOKEN_URL = "https://anilist.co/api/v2/oauth/token";
const ANILIST_AUTHORIZE_URL = "https://anilist.co/api/v2/oauth/authorize";
const ANILIST_VIEWER_URL = "https://graphql.anilist.co";

interface AniListViewerProfile {
  id: number;
  name: string;
  avatar?: { large?: string | null } | null;
  options?: { titleLanguage?: string } | null;
}

interface AniListTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string | null;
}

/** Fetches the authenticated AniList Viewer profile via GraphQL. */
async function fetchAniListProfile(accessToken: string): Promise<AniListViewerProfile | null> {
  try {
    const response = await fetch(ANILIST_VIEWER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: `query Viewer {
          Viewer {
            id
            name
            avatar { large }
            options { titleLanguage }
          }
        }`,
      }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("data" in body) ||
      typeof (body as { data: unknown }).data !== "object"
    ) {
      return null;
    }
    const data = (body as { data: { Viewer?: AniListViewerProfile | null } }).data;
    return data.Viewer ?? null;
  } catch {
    return null;
  }
}

const anilistProvider: Provider = {
  id: "anilist",
  name: "AniList",
  type: "oauth",
  version: "2",
  authorization: {
    url: ANILIST_AUTHORIZE_URL,
    params: {
      scope: "",
      response_type: "code",
    },
  },
  token: {
    url: ANILIST_TOKEN_URL,
    async request({ provider, params, verificationUrl }): Promise<{
      tokens: Record<string, unknown>;
    }> {
      // AniList expects form-encoded body, not JSON.
      const response = await fetch(verificationUrl ?? provider.token!.url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: provider.clientId as string,
          client_secret: provider.clientSecret as string,
          redirect_uri: provider.redirectUri as string,
          code: String(params.code ?? ""),
        }),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`AniList token exchange failed: HTTP ${response.status}`);
      }
      const tokens: AniListTokenResponse = (await response.json()) as AniListTokenResponse;
      return {
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type,
        },
      };
    },
  },
  userinfo: {
    async request({ tokens }) {
      const accessToken = tokens.access_token;
      if (typeof accessToken !== "string" || accessToken.length === 0) {
        throw new Error("AniList OAuth returned no access token.");
      }
      const profile = await fetchAniListProfile(accessToken);
      if (profile === null) {
        throw new Error("Could not resolve AniList Viewer profile.");
      }
      return {
        id: String(profile.id),
        name: profile.name,
        image: profile.avatar?.large ?? null,
        anilistId: profile.id,
        titleLanguage: profile.options?.titleLanguage ?? "ROMAJI",
      };
    },
  },
  profile(profile) {
    return {
      id: String(profile.id),
      name: profile.name,
      email: null,
      image: profile.image ?? null,
      anilistId: profile.anilistId,
      titleLanguage: profile.titleLanguage,
    };
  },
  checks: ["state"],
  clientId: process.env.ANILIST_CLIENT_ID,
  clientSecret: process.env.ANILIST_CLIENT_SECRET,
  allowDangerousEmailAccountLinking: false,
};

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: { signIn: "/dashboard" },
  providers: [
    anilistProvider,
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "identify guilds",
        },
      },
      profile(profile) {
        return {
          id: profile.id,
          name: profile.global_name ?? profile.username,
          email: null,
          image:
            profile.avatar !== null
              ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
              : `https://cdn.discordapp.com/embed/avatars/0.png`,
          discordId: profile.id,
          discordUsername: profile.username,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "discord") {
        // Ensure a User row exists for the Discord identity, and merge with
        // any existing account previously linked to the same AniList user.
        if (user.id) {
          const existing = await prisma.user.findUnique({
            where: { discordId: user.id },
          });
          if (!existing) {
            await prisma.user.create({
              data: {
                discordId: user.id,
                discordUsername: (user as { discordUsername?: string }).discordUsername ?? null,
                discordAvatar: user.image ?? null,
              },
            });
          }
        }
        return true;
      }
      if (account?.provider === "anilist") {
        return true; // Tokens are persisted in the jwt callback below.
      }
      return true;
    },
    async jwt({ token, user, account, isNewUser }) {
      // Initial sign-in with AniList: persist encrypted tokens (S1).
      if (account?.provider === "anilist" && account.access_token) {
        const accessToken = account.access_token as string;
        const refreshToken = account.refresh_token as string | undefined;
        const expiresAt = account.expires_at ? new Date(account.expires_at * 1000) : null;
        const anilistId = (user as { anilistId?: number }).anilistId;
        const anilistName = user.name ?? null;
        const anilistAvatar = user.image ?? null;
        const titleLanguage =
          (user as { titleLanguage?: string }).titleLanguage ?? "ROMAJI";

        const encryptedAccess = encryptToken(accessToken);
        const encryptedRefresh = refreshToken ? encryptToken(refreshToken) : null;

        // Find or create the User row keyed by anilistId, then link Discord
        // if that same person has previously logged in with Discord.
        let dbUser = await prisma.user.findUnique({
          where: { anilistId: anilistId ?? undefined },
        });
        if (!dbUser) {
          const encryptedAccessToken = encryptedAccess;
          dbUser = await prisma.user.create({
            data: {
              anilistId: anilistId ?? null,
              anilistUsername: anilistName,
              anilistAvatar: anilistAvatar,
              encryptedAccessToken,
              encryptedRefreshToken: encryptedRefresh,
              tokenExpiresAt: expiresAt,
              titleLanguage,
            },
          });
        } else {
          dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              anilistId: anilistId ?? dbUser.anilistId,
              anilistUsername: anilistName,
              anilistAvatar: anilistAvatar,
              encryptedAccessToken: encryptedAccess,
              encryptedRefreshToken: encryptedRefresh,
              tokenExpiresAt: expiresAt,
              titleLanguage,
            },
          });
        }

        // Link Discord identity if present on this session already.
        const existingDiscordLink = await prisma.user.findFirst({
          where: { discordId: token.discordId as string | undefined },
        });
        if (existingDiscordLink && existingDiscordLink.id !== dbUser.id) {
          // Merge: keep the anilist-linked user, delete the duplicate.
          await prisma.user.delete({ where: { id: existingDiscordLink.id } });
          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              discordId: existingDiscordLink.discordId,
              discordUsername: existingDiscordLink.discordUsername,
              discordAvatar: existingDiscordLink.discordAvatar,
            },
          });
        }

        return {
          ...token,
          userId: dbUser.id,
          anilistId: dbUser.anilistId,
          anilistUsername: dbUser.anilistUsername,
          anilistAvatar: dbUser.anilistAvatar,
          discordId: dbUser.discordId,
        };
      }

      // Discord-only sign-in: refresh identifiers from the database.
      if (account?.provider === "discord" && user.id) {
        const dbUser = await prisma.user.findUnique({
          where: { discordId: user.id },
        });
        if (dbUser) {
          return {
            ...token,
            userId: dbUser.id,
            anilistId: dbUser.anilistId,
            anilistUsername: dbUser.anilistUsername,
            anilistAvatar: dbUser.anilistAvatar,
            discordId: dbUser.discordId,
          };
        }
      }

      if (isNewUser) return token;
      return token;
    },
    async session({ session, token }) {
      session.user.id = (token.userId as string | undefined) ?? session.user.id;
      session.user.anilistId = (token.anilistId as number | undefined) ?? null;
      session.user.anilistUsername =
        (token.anilistUsername as string | undefined) ?? null;
      session.user.anilistAvatar =
        (token.anilistAvatar as string | undefined) ?? null;
      session.user.discordId = (token.discordId as string | undefined) ?? null;
      return session;
    },
    async authorized({ auth, request: { nextUrl } }) {
      // Protect the dashboard: redirect unauthenticated users to landing.
      const isLoggedIn = auth?.user !== undefined;
      const isDashboard = nextUrl.pathname.startsWith("/dashboard");
      if (isDashboard) return isLoggedIn;
      return true;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

/**
 * Security rule S4 — resolves the authenticated user's AniList id for a
 * session, verifying the decrypted AniList token is present and unexpired.
 * Returns null if not authenticated or not linked to AniList.
 *
 * @throws {CryptoError} propagated from decryptToken when the stored envelope
 *   cannot be authenticated (tampered ciphertext) — callers must treat this
 *   as a failed session, not silently degrade.
 */
export async function getAnilistAccessToken(): Promise<string | null> {
  const session = await auth();
  const anilistId = session?.user?.anilistId;
  if (typeof anilistId !== "number") return null;

  const dbUser = await prisma.user.findUnique({ where: { anilistId } });
  if (!dbUser?.encryptedAccessToken) return null;

  const decrypted = decryptToken(dbUser.encryptedAccessToken);
  const expiresAt = dbUser.tokenExpiresAt;
  if (expiresAt !== null && expiresAt.getTime() <= Date.now()) {
    // Token expired — the caller (anilist client) handles refresh.
    return null;
  }
  return decrypted;
}
