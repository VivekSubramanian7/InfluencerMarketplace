import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function SiteNav({ role }: { role: "creator" | "brand" | "admin" }) {
  const links =
    role === "creator"
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/campaigns", label: "Campaigns" },
          { href: "/deals", label: "Deals" },
        ]
      : role === "admin"
        ? [
            { href: "/admin", label: "Admin" },
            { href: "/deals", label: "Deals" },
          ]
        : [
            { href: "/discover", label: "Discover" },
            { href: "/campaigns", label: "Campaigns" },
            { href: "/deals", label: "Deals" },
          ];
  return (
    <nav className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-black tracking-tight">
            Clipline
          </Link>
          <div className="flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <form action={logout}>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            Log out
          </Button>
        </form>
      </div>
    </nav>
  );
}
