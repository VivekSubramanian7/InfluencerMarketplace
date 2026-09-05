import { NavSkeleton } from "@/components/nav-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <>
      <NavSkeleton />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-5 w-72" />

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-[var(--radius-tile)] border border-[var(--border)] p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-3 h-8 w-24" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="min-w-0 rounded-[var(--radius-tile)] border border-[var(--border)] p-5">
            <Skeleton className="h-6 w-36" />
            <div className="mt-5 flex flex-col gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </section>
          <aside className="flex min-w-0 flex-col gap-6">
            <section className="overflow-hidden rounded-[var(--radius-tile)] border border-[var(--border)]">
              <Skeleton className="h-16 rounded-none" />
              <div className="p-5">
                <Skeleton className="h-5 w-32" />
                <div className="mt-4 flex flex-col gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
