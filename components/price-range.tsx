"use client";

import { useState } from "react";

const chip =
  "h-10 rounded-full border bg-background px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PriceRange({
  defaultMin,
  defaultMax,
}: {
  defaultMin?: number | null;
  defaultMax?: number | null;
}) {
  const [lo, setLo] = useState(defaultMin ?? "");
  const [hi, setHi] = useState(defaultMax ?? "");

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        placeholder="Min $"
        aria-label="Minimum price"
        value={lo}
        onChange={(e) => setLo(e.target.value === "" ? "" : Number(e.target.value))}
        className={`${chip} w-28`}
      />
      <span className="text-sm text-muted-foreground">–</span>
      <input
        type="number"
        min={0}
        placeholder="Max $"
        aria-label="Maximum price"
        value={hi}
        onChange={(e) => setHi(e.target.value === "" ? "" : Number(e.target.value))}
        className={`${chip} w-28`}
      />
      <input type="hidden" name="min_price" value={lo} />
      <input type="hidden" name="max_price" value={hi} />
    </div>
  );
}
