"use client";

/**
 * <RelationsGraph /> — Related media timeline.
 *
 * Groups relations by type (PREQUEL → PARENT → SEQUEL) and renders
 * a horizontal timeline with cover thumbnails. Clicking navigates
 * to that media's detail page.
 */

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import type { RelationEdge, RelationType } from "@/types/anilist";

interface RelationsGraphProps {
  relations: RelationEdge[];
  currentMediaId: number;
  className?: string;
}

const RELATION_ORDER: RelationType[] = [
  "PREQUEL",
  "PARENT",
  "SEQUEL",
  "SIDE_STORY",
  "SPIN_OFF",
  "ALTERNATIVE",
  "COMPILATION",
  "CONTAINS",
  "SOURCE",
  "ADAPTATION",
  "SUMMARY",
  "CHARACTER",
  "OTHER",
];

const RELATION_LABELS: Partial<Record<RelationType, string>> = {
  PREQUEL: "Prequel",
  PARENT: "Parent",
  SEQUEL: "Sequel",
  SIDE_STORY: "Side Story",
  SPIN_OFF: "Spin-off",
  ALTERNATIVE: "Alternative",
  COMPILATION: "Compilation",
  CONTAINS: "Contains",
  SOURCE: "Source",
  ADAPTATION: "Adaptation",
  SUMMARY: "Summary",
  CHARACTER: "Character",
  OTHER: "Other",
};

export function RelationsGraph({
  relations,
  currentMediaId,
  className,
}: RelationsGraphProps) {
  // Group by relation type, sorted by RELATION_ORDER.
  const grouped = React.useMemo(() => {
    const map = new Map<RelationType, RelationEdge[]>();
    for (const edge of relations) {
      if (edge.node.id === currentMediaId) continue;
      const existing = map.get(edge.relationType) ?? [];
      existing.push(edge);
      map.set(edge.relationType, existing);
    }
    return RELATION_ORDER
      .map((type) => ({ type, edges: map.get(type) ?? [] }))
      .filter((g) => g.edges.length > 0);
  }, [relations, currentMediaId]);

  if (grouped.length === 0) return null;

  return (
    <div className={`flex flex-col gap-4 ${className ?? ""}`}>
      {grouped.map((group, groupIdx) => (
        <div key={group.type} className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {RELATION_LABELS[group.type] ?? group.type}
          </span>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {group.edges.map((edge, i) => (
              <motion.div
                key={`${group.type}-${edge.node.id}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: groupIdx * 0.1 + i * 0.05 }}
              >
                <Link
                  href={`/anime/${edge.node.id}`}
                  className="group flex w-28 flex-col gap-1.5"
                  aria-label={`${RELATION_LABELS[group.type] ?? group.type}: ${edge.node.title.userPreferred}`}
                >
                  <div className="relative h-32 w-28 overflow-hidden rounded-md border border-space-700 bg-space-800 transition-colors group-hover:border-space-600">
                    {edge.node.coverImage.medium ? (
                      <Image
                        src={edge.node.coverImage.medium}
                        alt={edge.node.title.userPreferred}
                        fill
                        sizes="112px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-space-700">
                        <span className="text-xs text-muted-foreground">No image</span>
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-foreground group-hover:text-neon-400">
                    {edge.node.title.userPreferred}
                  </p>
                  <div className="flex gap-1">
                    <span className="rounded bg-space-700 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {edge.node.format}
                    </span>
                    <span className="rounded bg-space-700 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {edge.node.status}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}