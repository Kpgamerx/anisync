"use client";

/**
 * <TrailerModal /> — YouTube embed modal using Radix Dialog.
 *
 * Autoplays on open, destroys iframe on close to stop audio.
 * Keyboard: Escape closes (Radix default), K toggles play/pause.
 */

import * as React from "react";
import { Play, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AniListTrailer } from "@/types/anilist";

interface TrailerModalProps {
  trailer: AniListTrailer | null;
  trigger?: React.ReactNode;
}

export function TrailerModal({ trailer, trigger }: TrailerModalProps) {
  const [open, setOpen] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const trailerUrl = React.useMemo(() => {
    if (!trailer) return null;
    if (trailer.site === "youtube") {
      return `https://www.youtube-nocookie.com/embed/${trailer.id}?autoplay=1&rel=0`;
    }
    return `https://www.dailymotion.com/embed/video/${trailer.id}?autoplay=1`;
  }, [trailer]);

  // Keyboard: K toggles play/pause via postMessage (YouTube only).
  React.useEffect(() => {
    if (!open || !iframeRef.current) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "k" || e.key === "K") {
        if (trailer?.site === "youtube" && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "playVideo" }),
            "*",
          );
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, trailer]);

  if (!trailer || !trailerUrl) {
    return trigger ?? (
      <Button variant="outline" size="sm" disabled aria-label="No trailer available">
        <Play className="mr-1.5 h-4 w-4" />
        No Trailer
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" aria-label="Watch trailer">
            <Play className="mr-1.5 h-4 w-4" />
            Watch Trailer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-w-3xl border-space-700 bg-space-900 p-0"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Trailer</DialogTitle>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          {open && (
            <iframe
              ref={iframeRef}
              src={trailerUrl}
              title="Trailer"
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 z-10"
          onClick={() => setOpen(false)}
          aria-label="Close trailer"
        >
          <X className="h-4 w-4" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}