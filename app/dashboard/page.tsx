import Link from "next/link";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <h1 className="text-2xl font-bold text-foreground">
          Not authenticated
        </h1>
        <p className="text-muted-foreground">
          Sign in with AniList to view your dashboard.
        </p>
        <Link href="/api/auth/signin">
          <Button className="bg-neon-400 text-space-950 hover:bg-neon-300">
            Sign In
          </Button>
        </Link>
      </div>
    );
  }

  const username = session.user.anilistUsername ?? "User";

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Welcome back, {username}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Your AniSync dashboard overview
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-space-700 bg-space-800">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              AniList ID
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {session.user.anilistId ?? "Not linked"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-space-700 bg-space-800">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Discord
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {session.user.discordId ? "Linked" : "Not linked"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-space-700 bg-space-800">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link href="/dashboard/watchlist">
              <Button variant="outline" size="sm" className="border-space-600">
                Watchlist
              </Button>
            </Link>
            <Link href="/dashboard/config">
              <Button variant="outline" size="sm" className="border-space-600">
                Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}