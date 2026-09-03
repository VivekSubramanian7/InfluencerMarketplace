import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export function NavSkeleton() {
  return (
    <nav className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-lg font-black tracking-tight">
            Clipline
          </Link>
          <div className="flex items-center gap-0.5 rounded-full bg-secondary/60 p-1">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </div>
    </nav>
  );
}
