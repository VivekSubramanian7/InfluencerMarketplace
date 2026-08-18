import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

// Placeholder for SiteNav while a route loads — same bar height and wordmark,
// muted pills where the role-dependent links land.
export function NavSkeleton() {
  return (
    <nav className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-black tracking-tight">
            Clipline
          </Link>
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </nav>
  );
}
