import Link from "next/link";
import { LayoutDashboard, ListTodo, Settings } from "lucide-react";
import { auth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/watchlist", label: "Watchlist", icon: ListTodo },
    { href: "/dashboard/config", label: "Config", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-space-950">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-16 flex-col items-center gap-4 border-r border-space-700 bg-space-900 py-4 sm:w-56">
        <Link
          href="/"
          className="flex items-center gap-2 px-2 text-lg font-bold text-neon-400"
        >
          <span className="hidden sm:inline">AniSync</span>
          <span className="sm:hidden">A</span>
        </Link>

        <Separator className="w-full" />

        <nav className="flex w-full flex-1 flex-col gap-1 px-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-space-700 hover:text-foreground"
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User avatar */}
        {session?.user && (
          <div className="flex items-center gap-2 px-2 py-2">
            <Avatar className="h-8 w-8">
              {session.user.anilistAvatar && (
                <AvatarImage
                  src={session.user.anilistAvatar}
                  alt={session.user.anilistUsername ?? "User"}
                />
              )}
              <AvatarFallback>
                {session.user.anilistUsername?.[0] ?? "U"}
              </AvatarFallback>
            </Avatar>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              {session.user.anilistUsername ?? "User"}
            </span>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}