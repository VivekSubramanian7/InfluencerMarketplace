import { NavSkeleton } from "@/components/nav-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function CampaignsLoading() {
  return (
    <>
      <NavSkeleton />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        <div className="mt-6 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 rounded-[var(--radius-tile)] border border-[var(--border)] p-5"
            >
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="mt-2 h-4 w-1/3" />
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
