import { NavSkeleton } from "@/components/nav-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function DiscoverLoading() {
  return (
    <>
      <NavSkeleton />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="mt-2 h-5 w-96 max-w-full" />

        <div className="mt-6 rounded-2xl border bg-secondary/50 p-4">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 min-w-56 flex-1 rounded-full bg-background" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Skeleton className="h-10 w-40 rounded-full bg-background" />
            <Skeleton className="h-10 w-36 rounded-full bg-background" />
            <Skeleton className="h-10 w-44 rounded-full bg-background" />
            <Skeleton className="h-10 w-24 rounded-full bg-background" />
            <Skeleton className="h-10 w-24 rounded-full bg-background" />
          </div>
        </div>

        <Skeleton className="mt-6 h-4 w-36" />

        <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li key={i} className="overflow-hidden rounded-2xl bg-card shadow-card">
              <Skeleton className="h-24 rounded-none" />
              <div className="-mt-7 flex items-end gap-3 px-5">
                <Skeleton className="size-14 shrink-0 rounded-2xl bg-background" />
                <div className="min-w-0 flex-1 pb-0.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-1.5 h-3 w-20" />
                </div>
              </div>
              <div className="px-5 pb-5">
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-1.5 h-4 w-3/4" />
                <div className="mt-4 flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="size-8 rounded-full" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
