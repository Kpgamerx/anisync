"use client";

/**
 * <GenreHeatmap /> — User's genre affinity visualization.
 *
 * Grid of genre cells where brightness is proportional to how many
 * completed anime the user has in that genre. Tooltip shows count.
 */

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GenreStat {
  genre: string;
  count: number;
}

interface GenreHeatmapProps {
  stats: GenreStat[];
  className?: string;
}

export function GenreHeatmap({ stats, className }: GenreHeatmapProps) {
  const maxCount = React.useMemo(
    () => Math.max(1, ...stats.map((s) => s.count)),
    [stats],
  );

  if (stats.length === 0) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={`grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 ${className ?? ""}`}
        role="grid"
        aria-label="Genre affinity heatmap"
      >
        {stats.map((stat) => {
          const intensity = stat.count / maxCount;
          // Darker = fewer, brighter neon = more
          const opacity = 0.15 + intensity * 0.85;
          return (
            <Tooltip key={stat.genre}>
              <TooltipTrigger asChild>
                <div
                  className="flex aspect-square cursor-default flex-col items-center justify-center rounded-lg border border-space-700 p-2 text-center transition-all hover:border-neon-400/50"
                  style={{
                    backgroundColor: `rgba(0, 242, 254, ${opacity * 0.3})`,
                  }}
                  role="gridcell"
                  tabIndex={0}
                >
                  <span className="text-xs font-medium text-foreground">
                    {stat.genre}
                  </span>
                  <span className="text-lg font-bold text-neon-400">
                    {stat.count}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{stat.genre}</p>
                <p className="text-muted-foreground">
                  {stat.count} anime completed
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}