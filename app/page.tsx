import Link from "next/link";
import { Github, Discord } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-space-950 px-4">
      {/* Hero */}
      <div className="flex max-w-3xl flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neon-400/10">
            <Discord className="h-6 w-6 text-neon-400" />
          </div>
          <h1 className="text-4xl font-bold text-foreground sm:text-5xl">
            AniSync
          </h1>
        </div>

        <p className="max-w-xl text-lg text-muted-foreground">
          Premium Discord Bot + Web Dashboard for full two-way synchronization
          with your AniList account. Track progress, get airing notifications,
          and manage your watchlist — all from Discord or the web.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/api/auth/signin">
            <Button
              size="lg"
              className="bg-neon-400 text-space-950 hover:bg-neon-300"
            >
              Get Started
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="lg" className="border-space-600">
              Dashboard
            </Button>
          </Link>
        </div>

        {/* Feature grid */}
        <div className="mt-12 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          <FeatureCard
            title="2-Way Sync"
            description="Update progress from Discord or the web — changes sync to AniList instantly."
          />
          <FeatureCard
            title="Airing Alerts"
            description="Get notified in your Discord server when new episodes air."
          />
          <FeatureCard
            title="Rich Embeds"
            description="Beautiful anime info cards with scores, streaming links, and trailers."
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 flex items-center gap-2 text-sm text-muted-foreground">
        <span>Powered by AniList</span>
        <span>·</span>
        <Link
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <Github className="h-4 w-4" />
          GitHub
        </Link>
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-space-700 bg-space-800 p-4 text-left">
      <h3 className="mb-1 font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}