"use client";

/**
 * <ScoreDistributionChart /> — Pure CSS + Framer Motion bar chart
 * using AniList stats.scoreDistribution.
 *
 * 10 bars (score 10–100 in steps of 10), highlights the user's own
 * score with neon accent. Animates bars on mount with spring physics.
 */

import * as React from "react";
import { motion } from "framer-motion";
import type { ScoreDistributionEntry } from "@/types/anilist";

interface ScoreDistributionChartProps {
  distribution: ScoreDistributionEntry[];
  userScore: number | null;
  className?: string;
}

export function ScoreDistributionChart({
  distribution,
  userScore,
  className,
}: ScoreDistributionChartProps) {
  // Build 10 buckets: 1-10, 11-20, ..., 91-100
  const buckets = React.useMemo(() => {
    const map = new Map<number, number>();
    for (const entry of distribution) {
      const bucket = Math.ceil(entry.score / 10);
      map.set(bucket, (map.get(bucket) ?? 0) + entry.amount);
    }
    return Array.from({ length: 10 }, (_, i) => ({
      bucket: i + 1,
      amount: map.get(i + 1) ?? 0,
      label: `${i * 10 + 1}-${(i + 1) * 10}`,
    }));
  }, [distribution]);

  const maxAmount = React.useMemo(
    () => Math.max(1, ...buckets.map((b) => b.amount)),
    [buckets],
  );

  const userBucket = userScore !== null ? Math.ceil(userScore / 10) : null;

  return (
    <div
      className={`flex h-48 items-end gap-1.5 ${className ?? ""}`}
      role="img"
      aria-label="Score distribution chart"
    >
      {buckets.map((b, i) => {
        const heightPct = (b.amount / maxAmount) * 100;
        const isUserBucket = userBucket === b.bucket;
        return (
          <div
            key={b.bucket}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <motion.div
              className={`w-full rounded-t-sm ${
                isUserBucket
                  ? "bg-neon-400"
                  : "bg-violet-400/40"
              }`}
              style={{ minHeight: 4 }}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(heightPct, 2)}%` }}
              transition={{
                type: "spring",
                stiffness: 100,
                damping: 15,
                delay: i * 0.05,
              }}
              title={`${b.label}: ${b.amount} votes`}
            />
            <span className="text-[10px] text-muted-foreground">{b.bucket * 10}</span>
          </div>
        );
      })}
    </div>
  );
}