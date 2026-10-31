"use client";

/**
 * <AnimeHeroCard /> — Full-width hero for the /anime/[id] detail page.
 *
 * Full-bleed bannerImage with gradient overlay, floating cover art,
 * title stack, animated score ring, status pill, format badge,
 * episode count, airing countdown, action bar, genre pills, and
 * studio cards.
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Play, Heart, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrailerModal } from "@/components/anime/TrailerModal";
import { StreamingBadges } from "@/components/anime/StreamingBadges";
import type { AniListMedia } from "@/types/anilist";
import { scoreToColor } from "@/types/anilist";

interface AnimeHeroCardProps {
  media: AniListMedia;
}

const STATUS_COLORS: Record<string, string> = {
  RELEASING: "bg-green-500/20 text-green-400 border-green-500/30",
  FINISHED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  NOT_YET_RELEASED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
  HIATUS: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

/** Animated SVG score ring. */
function ScoreRing({ score }: { score: number | null }) {
  if (score === null) return null;
  const color = scoreToColor(score);
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      <svg className="h-20 w-20 -rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-space-700"
        />
        <motion.circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: "spring", stiffness: 60, damping: 15, delay: 0.3 }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] text-muted-foreground">score</span>
      </div>
    </div>
  );
}

/** Live airing countdown. */
function AiringCountdown({
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
    }, 1000);
    return () => clearInterval(interval);
  }, [airingAt]);

  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 && d === 0) parts.push(`${s}s`);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-neon-400/30 bg-neon-400/10 px-3 py-1.5">
      <span className="text-xs text-neon-400">Ep {episode} airs in</span>
      <span className="font-mono text-sm font-bold text-neon-400">
        {parts.join(" ") || "now"}
      </span>
    </div>
  );
}

export function AnimeHeroCard({ media }: AnimeHeroCardProps) {
  const studio = media.studios.nodes.find((s) => s.isAnimationStudio) ??
    media.studios.nodes[0] ??
    null;

  return (
    <div className="relative w-full overflow-hidden rounded-xl">
      {/* Banner */}
      {media.bannerImage ? (
        <div className="relative h-[400px] w-full sm:h-[500px]">
          <Image
            src={media.bannerImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-space-950/40 to-space-950" />
        </div>
      ) : (
        <div className="h-[400px] w-full bg-space-800 sm:h-[500px]" />
      )}

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Cover art */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
            className="relative z-10 h-40 w-28 flex-shrink-0 overflow-hidden rounded-lg border-2 border-space-700 shadow-2xl sm:h-48 sm:w-32"
            style={{
              boxShadow: media.coverImage.color
                ? `0 0 40px ${media.coverImage.color}40`
                : undefined,
            }}
          >
            {media.coverImage.extraLarge ? (
              <Image
                src={media.coverImage.extraLarge}
                alt={media.title.userPreferred}
                fill
                sizes="128px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-space-700">
                <span className="text-sm text-muted-foreground">No image</span>
              </div>
            )}
          </motion.div>

          {/* Title + meta */}
          <div className="flex flex-1 flex-col gap-2">
            {media.title.native && (
              <p className="text-sm text-muted-foreground">{media.title.native}</p>
            )}
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
              {media.title.userPreferred || media.title.romaji}
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              {media.status && (
                <Badge
                  variant="outline"
                  className={STATUS_COLORS[media.status] ?? STATUS_COLORS.HIATUS}
                >
                  {media.status}
                </Badge>
              )}
              {media.format && (
                <Badge variant="outline" className="border-space-600 text-muted-foreground">
                  {media.format}
                </Badge>
              )}
              {media.seasonYear && (
                <Badge variant="outline" className="border-space-600 text-muted-foreground">
                  {media.season ?? ""} {media.seasonYear}
                </Badge>
              )}
              {media.episodes !== null && (
                <span className="text-sm text-muted-foreground">
                  {media.episodes} Episodes
                  {media.duration ? ` · ${media.duration} min/ep` : ""}
                </span>
              )}
            </div>

            {/* Airing countdown */}
            {media.nextAiringEpisode && (
              <AiringCountdown
                airingAt={media.nextAiringEpisode.airingAt}
                episode={media.nextAiringEpisode.episode}
              />
            )}

            {/* Genre pills */}
            <div className="flex flex-wrap gap-1.5">
              {media.genres.slice(0, 6).map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-space-700/80 px-2.5 py-0.5 text-xs text-muted-foreground backdrop-blur-sm"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>

          {/* Score ring */}
          <div className="flex flex-col items-center gap-2">
            <ScoreRing score={media.averageScore} />
            <span className="text-xs text-muted-foreground">
              ❤️ {media.favourites} favs
            </span>
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" className="bg-neon-400 text-space-950 hover:bg-neon-300">
            <Plus className="mr-1.5 h-4 w-4" />
            Add to List
          </Button>
          <TrailerModal trailer={media.trailer} />
          <Button variant="outline" size="sm" className="border-space-600">
            <Heart className="mr-1.5 h-4 w-4" />
            Favorite
          </Button>
          <Link href={media.siteUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm">
              <ExternalLink className="mr-1.5 h-4 w-4" />
              AniList
            </Button>
          </Link>
        </div>

        {/* Streaming badges */}
        {media.externalLinks.length > 0 && (
          <div className="mt-3">
            <StreamingBadges links={media.externalLinks} />
          </div>
        )}

        {/* Studio card */}
        {studio && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-space-700 bg-space-800/80 px-3 py-1.5 backdrop-blur-sm">
            <span className="text-sm font-medium text-foreground">{studio.name}</span>
            {studio.isAnimationStudio && (
              <Badge variant="secondary" className="text-[10px]">
                Animation Studio
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}