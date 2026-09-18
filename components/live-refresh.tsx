// components/live-refresh.tsx
"use client";

// ponytail: polling at 5s interval — swap to Supabase Realtime when concurrent
// users exceed ~500 open tabs. Migration: replace the setInterval in useEffect
// with a supabase.channel(...).on('postgres_changes', ...) subscription that
// calls router.refresh() on relevant table changes. Same mount point in
// AppShell, same contract (renders null, triggers RSC re-render).

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 5_000;

export function LiveRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, INTERVAL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [router]);

  return null;
}
