"use client";

import { useState } from "react";

const MIN = 0;
const MAX = 1000;
const STEP = 10;

export function PriceRange({
  defaultMin,
  defaultMax,
}: {
  defaultMin?: number | null;
  defaultMax?: number | null;
}) {
  const [lo, setLo] = useState(defaultMin ?? MIN);
  const [hi, setHi] = useState(defaultMax ?? MAX);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm tabular-nums">
        <span className="font-semibold">${lo}</span>
        <span className="text-muted-foreground">to</span>
        <span className="font-semibold">{hi >= MAX ? `$${MAX}+` : `$${hi}`}</span>
      </div>
      <div className="relative h-6">
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={lo}
          onChange={(e) => {
            const v = Number(e.target.value);
            setLo(Math.min(v, hi - STEP));
          }}
          aria-label="Minimum price"
          className="price-slider absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto"
        />
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={hi}
          onChange={(e) => {
            const v = Number(e.target.value);
            setHi(Math.max(v, lo + STEP));
          }}
          aria-label="Maximum price"
          className="price-slider absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto"
        />
        <div className="pointer-events-none absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-border">
          <div
            className="absolute h-full rounded-full bg-primary"
            style={{
              left: `${((lo - MIN) / (MAX - MIN)) * 100}%`,
              right: `${100 - ((hi - MIN) / (MAX - MIN)) * 100}%`,
            }}
          />
        </div>
      </div>
      <input type="hidden" name="min_price" value={lo > MIN ? lo : ""} />
      <input type="hidden" name="max_price" value={hi < MAX ? hi : ""} />
    </div>
  );
}
