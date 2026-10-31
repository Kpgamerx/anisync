"use client";

/**
 * <CharacterCarousel /> — Horizontal scroll character showcase using
 * Embla Carousel with drag scroll and keyboard navigation.
 *
 * Each card shows character image, name, and role badge.
 * Hover reveals Japanese name + voice actor with tooltip.
 */

import * as React from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import type { CharacterEdge } from "@/types/anilist";

interface CharacterCarouselProps {
  characters: CharacterEdge[];
  className?: string;
}

const ROLE_COLORS: Record<string, string> = {
  MAIN: "bg-neon-400/20 text-neon-400 border-neon-400/30",
  SUPPORTING: "bg-violet-400/20 text-violet-400 border-violet-400/30",
  BACKGROUND: "bg-muted/20 text-muted-foreground border-muted/30",
};

export function CharacterCarousel({
  characters,
  className,
}: CharacterCarouselProps) {
  const [emblaRef] = useEmblaCarousel(
    { loop: false, align: "start", dragFree: true },
    [Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })],
  );

  if (characters.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={`overflow-hidden ${className ?? ""}`}
        ref={emblaRef}
        role="region"
        aria-label="Characters carousel"
      >
        <div className="flex gap-4">
          {characters.map((edge) => {
            const va = edge.voiceActors[0];
            return (
              <div
                key={edge.node.id}
                className="min-w-[160px] flex-shrink-0 cursor-grab active:cursor-grabbing"
              >
                <div className="group relative overflow-hidden rounded-lg border border-space-700 bg-space-800 transition-colors hover:border-space-600">
                  <div className="relative aspect-[3/4] w-full overflow-hidden">
                    {edge.node.image.large ? (
                      <Image
                        src={edge.node.image.large}
                        alt={edge.node.name.full}
                        fill
                        sizes="160px"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-space-700">
                        <span className="text-2xl text-muted-foreground">?</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-space-950 via-transparent to-transparent" />
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-foreground">
                      {edge.node.name.full}
                    </p>
                    {edge.node.name.native && (
                      <p className="truncate text-xs text-muted-foreground">
                        {edge.node.name.native}
                      </p>
                    )}
                    <Badge
                      className={`mt-2 ${ROLE_COLORS[edge.role] ?? ROLE_COLORS.BACKGROUND}`}
                      variant="outline"
                    >
                      {edge.role}
                    </Badge>
                  </div>
                </div>

                {va && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="mt-2 flex items-center gap-2 rounded-md bg-space-800/50 p-2">
                        {va.image.large && (
                          <Image
                            src={va.image.large}
                            alt={va.name.full}
                            width={24}
                            height={24}
                            className="rounded-full"
                            unoptimized
                          />
                        )}
                        <span className="truncate text-xs text-muted-foreground">
                          VA: {va.name.full}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{va.name.full}</p>
                      {va.name.native && <p>{va.name.native}</p>}
                      {va.languageV2 && (
                        <p className="text-muted-foreground">{va.languageV2}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}