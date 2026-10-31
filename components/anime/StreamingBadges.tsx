"use client";

/**
 * <StreamingBadges /> — Streaming platform links from AniList externalLinks.
 *
 * Filters externalLinks where type === "STREAMING" and renders branded
 * badges with platform icon + name. Opens in new tab with noopener.
 */

import Image from "next/image";
import type { ExternalLink } from "@/types/anilist";

interface StreamingBadgesProps {
  links: ExternalLink[];
  className?: string;
}

/** Fallback brand colors when AniList doesn't provide one. */
const FALLBACK_COLORS: Record<string, string> = {
  Crunchyroll: "#F47521",
  Netflix: "#E50914",
  Hidive: "#00BFFF",
  YouTube: "#FF0000",
  "Prime Video": "#00A8E1",
  Funimation: "#5B0BB8",
  Hulu: "#1CE783",
};

export function StreamingBadges({ links, className }: StreamingBadgesProps) {
  const streamingLinks = links.filter((l) => l.type === "STREAMING");

  if (streamingLinks.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-2 ${className ?? ""}`}
      role="list"
      aria-label="Streaming platforms"
    >
      {streamingLinks.map((link) => {
        const brandColor = link.color ?? FALLBACK_COLORS[link.site] ?? "#171C2B";
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: brandColor }}
            role="listitem"
            aria-label={`Watch on ${link.site}`}
          >
            {link.icon && (
              <Image
                src={link.icon}
                alt=""
                width={14}
                height={14}
                className="rounded-sm"
                unoptimized
              />
            )}
            <span>{link.site}</span>
          </a>
        );
      })}
    </div>
  );
}