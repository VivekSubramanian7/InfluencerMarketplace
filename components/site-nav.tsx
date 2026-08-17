import Link from "next/link";
import { logout } from "@/app/(auth)/actions";

export function SiteNav({ role }: { role: "creator" | "brand" | "admin" }) {
  const links =
    role === "creator"
      ? [{ href: "/dashboard", label: "Dashboard" }, { href: "/deals", label: "Deals" }]
      : role === "admin"
        ? [{ href: "/admin", label: "Admin" }, { href: "/deals", label: "Deals" }]
        : [{ href: "/discover", label: "Discover" }, { href: "/deals", label: "Deals" }];
  return (
    <nav className="flex items-center justify-between border-b px-8 py-3 mb-2">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-semibold">Clipline</Link>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-sm underline-offset-4 hover:underline">
            {l.label}
          </Link>
        ))}
      </div>
      <form action={logout}>
        <button className="text-sm underline">Log out</button>
      </form>
    </nav>
  );
}
