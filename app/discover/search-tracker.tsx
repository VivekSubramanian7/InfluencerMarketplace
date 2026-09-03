"use client";

import { useEffect, useRef } from "react";
import { captureClientEvent } from "@/lib/analytics-client";

export function SearchTracker({
  query,
  filters,
  totalResults,
  page,
}: {
  query: string | null;
  filters: Record<string, string | null>;
  totalResults: number;
  page: number;
}) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    const props = {
      query,
      ...filters,
      results_count: totalResults,
      page,
    };
    captureClientEvent("search_performed", props);
    if (totalResults === 0) {
      captureClientEvent("search_zero_results", props);
    }
  }, [query, filters, totalResults, page]);

  return null;
}
