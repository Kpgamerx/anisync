"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { setAuthToken } from "@/lib/anilist/client";
import {
  GET_USER_WATCHLIST,
  type GetUserWatchlistResult,
} from "@/lib/anilist/queries";
import { executeQuery } from "@/lib/anilist/client";
import { WatchlistTable } from "@/components/anime/WatchlistTable";
import type { WatchlistEntry } from "@/types/anilist";

export default function WatchlistPage() {
  const [entries, setEntries] = React.useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Load watchlist on mount.
  React.useEffect(() => {
    let cancelled = false;

    async function loadWatchlist() {
      try {
        const session = await auth();
        if (!session?.user?.anilistId) {
          setError("AniList account not linked.");
          setLoading(false);
          return;
        }

        const dbUser = await prisma.user.findUnique({
          where: { anilistId: session.user.anilistId },
          select: { encryptedAccessToken: true },
        });

        if (!dbUser?.encryptedAccessToken) {
          setError("No AniList token found. Please re-link your account.");
          setLoading(false);
          return;
        }

        const token = decryptToken(dbUser.encryptedAccessToken);
        setAuthToken(token);

        const result = await executeQuery<GetUserWatchlistResult>(
          GET_USER_WATCHLIST,
          { userId: session.user.anilistId },
        );

        const allEntries =
          result.MediaListCollection?.lists.flatMap(
            (list) => list.entries,
          ) ?? [];

        if (!cancelled) {
          setEntries(allEntries);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load watchlist.";
          setError(message);
          setLoading(false);
        }
      }
    }

    loadWatchlist();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync handler — PATCH /api/sync/progress.
  const handleSync = React.useCallback(
    async (mediaId: number, patch: Partial<WatchlistEntry>) => {
      try {
        const response = await fetch("/api/sync/progress", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId, ...patch }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? "Sync failed.",
          );
        }

        // Optimistic update.
        setEntries((prev) =>
          prev.map((entry) =>
            entry.mediaId === mediaId ? { ...entry, ...patch } : entry,
          ),
        );

        toast.success("Synced to AniList!");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Sync failed.";
        toast.error(message);
      }
    },
    [],
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Watchlist</h1>
          <p className="mt-1 text-muted-foreground">Loading your watchlist...</p>
        </div>
        <div className="h-64 animate-pulse rounded-lg border border-space-700 bg-space-800" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-foreground">Watchlist</h1>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Watchlist</h1>
        <p className="mt-1 text-muted-foreground">
          {entries.length} {entries.length === 1 ? "entry" : "entries"} ·
          Changes sync to AniList instantly
        </p>
      </div>
      <WatchlistTable entries={entries} onSync={handleSync} />
    </div>
  );
}