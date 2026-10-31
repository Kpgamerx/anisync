"use client";

/**
 * <WatchlistTable /> — 2-Way Sync Data Table built on @tanstack/react-table v8.
 *
 * Columns: Cover, Title, Progress, Score, Status, Next Ep, Streaming,
 * Updated, Actions. Inline-editable status and progress with optimistic
 * updates via the /api/sync/progress endpoint.
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { Check, Plus, MoreHorizontal, Star } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { StreamingBadges } from "@/components/anime/StreamingBadges";
import type { WatchlistEntry, MediaListStatus } from "@/types/anilist";
import { scoreToColor } from "@/types/anilist";

interface WatchlistTableProps {
  entries: WatchlistEntry[];
  onSync?: (mediaId: number, patch: Partial<WatchlistEntry>) => Promise<void>;
}

const STATUS_OPTIONS: { value: MediaListStatus; label: string }[] = [
  { value: "CURRENT", label: "Watching" },
  { value: "PLANNING", label: "Plan to Watch" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DROPPED", label: "Dropped" },
  { value: "PAUSED", label: "Paused" },
  { value: "REPEATING", label: "Repeating" },
];

const STATUS_COLORS: Partial<Record<MediaListStatus, string>> = {
  CURRENT: "text-neon-400",
  COMPLETED: "text-green-400",
  PLANNING: "text-blue-400",
  DROPPED: "text-red-400",
  PAUSED: "text-yellow-400",
  REPEATING: "text-violet-400",
};

/** Live countdown chip for next airing episode. */
function NextEpChip({
  airingAt,
  episode,
}: {
  airingAt: number;
  episode: number;
}) {
  const [remaining, setRemaining] = React.useState(
    Math.max(0, airingAt - Math.floor(Date.now() / 1000)),
  );

  React.useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, airingAt - Math.floor(Date.now() / 1000)));
    }, 60000);
    return () => clearInterval(interval);
  }, [airingAt]);

  if (remaining <= 0) return null;
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  return (
    <span className="inline-flex items-center rounded-full bg-neon-400/10 px-2 py-0.5 text-xs text-neon-400">
      Ep {episode} in {h}h {m}m
    </span>
  );
}

export function WatchlistTable({ entries, onSync }: WatchlistTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const columns = React.useMemo<ColumnDef<WatchlistEntry>[]>(
    () => [
      {
        id: "cover",
        header: "",
        cell: ({ row }) => {
          const media = row.original.media;
          return (
            <div
              className="relative h-16 w-12 overflow-hidden rounded"
              style={{
                borderLeft: `3px solid ${media.coverImage.color ?? "#171C2B"}`,
              }}
            >
              {media.coverImage.medium ? (
                <Image
                  src={media.coverImage.medium}
                  alt={media.title.userPreferred}
                  fill
                  sizes="48px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-space-700">
                  <span className="text-[10px] text-muted-foreground">?</span>
                </div>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: "title",
        header: "Title",
        cell: ({ row }) => {
          const media = row.original.media;
          return (
            <div className="flex flex-col gap-0.5">
              <Link
                href={`/anime/${media.id}`}
                className="font-medium text-foreground hover:text-neon-400"
              >
                {media.title.userPreferred}
              </Link>
              {media.title.native && (
                <span className="text-xs text-muted-foreground">
                  {media.title.native}
                </span>
              )}
              <div className="flex gap-1">
                <span className="rounded bg-space-700 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {media.format}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "progress",
        header: "Progress",
        cell: ({ row }) => {
          const entry = row.original;
          const media = entry.media;
          const total = media.episodes ?? 0;
          const pct = total > 0 ? (entry.progress / total) * 100 : 0;
          return (
            <div className="flex flex-col gap-1">
              <span className="text-sm text-foreground">
                {entry.progress}
                {total > 0 ? ` / ${total}` : ""}
              </span>
              {total > 0 && (
                <Progress value={pct} className="h-1.5 w-20" />
              )}
            </div>
          );
        },
      },
      {
        id: "score",
        header: "Score",
        cell: ({ row }) => {
          const entry = row.original;
          const avg = row.original.media.averageScore;
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <Star
                  className="h-3 w-3"
                  style={{ color: scoreToColor(entry.score || null) }}
                />
                <span className="text-sm text-foreground">{entry.score || "—"}</span>
              </div>
              {avg !== null && (
                <span className="text-xs text-muted-foreground">avg: {avg}</span>
              )}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <Select
              value={entry.status}
              onValueChange={(value) => {
                onSync?.(entry.mediaId, {
                  status: value as MediaListStatus,
                });
              }}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className={STATUS_COLORS[opt.value]}>
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        id: "nextEp",
        header: "Next Ep",
        cell: ({ row }) => {
          const entry = row.original;
          if (
            entry.status === "CURRENT" &&
            entry.media.nextAiringEpisode
          ) {
            return (
              <NextEpChip
                airingAt={entry.media.nextAiringEpisode.airingAt}
                episode={entry.media.nextAiringEpisode.episode}
              />
            );
          }
          return <span className="text-xs text-muted-foreground">—</span>;
        },
        enableSorting: false,
      },
      {
        id: "streaming",
        header: "Streaming",
        cell: ({ row }) => {
          const links = row.original.media.externalLinks.map((l) => ({
            id: 0,
            url: l.url,
            site: l.site,
            type: l.type,
            icon: l.icon,
            color: l.color,
          }));
          if (links.length === 0) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return <StreamingBadges links={links} />;
        },
        enableSorting: false,
      },
      {
        id: "updated",
        header: "Updated",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(row.original.updatedAt * 1000, {
              addSuffix: true,
            })}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  onSync?.(entry.mediaId, {
                    progress: entry.progress + 1,
                  })
                }
                aria-label="Increment progress"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  onSync?.(entry.mediaId, {
                    status: "COMPLETED",
                    progress: entry.media.episodes ?? entry.progress,
                  })
                }
                aria-label="Mark complete"
              >
                <Check className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      onSync?.(entry.mediaId, { status: "PAUSED" })
                    }
                  >
                    Pause
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      onSync?.(entry.mediaId, { status: "DROPPED" })
                    }
                  >
                    Drop
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      onSync?.(entry.mediaId, { status: "PLANNING" })
                    }
                  >
                    Move to Planning
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [onSync],
  );

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-space-700 bg-space-800 p-8 text-center">
        <p className="text-lg font-medium text-foreground">No entries yet</p>
        <p className="text-sm text-muted-foreground">
          Your watchlist will appear here once you add anime on AniList.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-space-700 bg-space-800/50">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="border-space-700 hover:bg-transparent"
            >
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="text-muted-foreground">
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="border-space-700 hover:bg-space-700/30"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}