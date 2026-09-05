import { NavSkeleton } from "@/components/nav-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function DealsLoading() {
  return (
    <>
      <NavSkeleton />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <Skeleton className="h-9 w-48" />
        <div className="mt-6">
          {["a", "b", "c"].map((s) => (
            <section key={s} className="mb-10">
              <Skeleton className="h-6 w-40" />
              <div className="mt-3 flex flex-col gap-2">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-4 rounded-[var(--radius-tile)] border border-[var(--border)] p-4"
                  >
                    <Skeleton className="h-5 w-1/2" />
                    <div className="flex shrink-0 items-center gap-4">
                      <Skeleton className="h-5 w-24 rounded-full" />
                      <Skeleton className="h-5 w-14" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
