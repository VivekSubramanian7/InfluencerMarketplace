"use client";

import { useState } from "react";

export function StarRating({
  name = "rating",
  defaultValue = 5,
}: {
  name?: string;
  defaultValue?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      <input type="hidden" name={name} value={value} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setValue(n)}
          onMouseEnter={() => setHover(n)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className="text-2xl transition-transform hover:scale-110 active:scale-95"
        >
          <span className={n <= (hover || value) ? "text-amber" : "text-border"}>
            ★
          </span>
        </button>
      ))}
      <span className="ml-2 text-sm font-semibold tabular-nums">{value}/5</span>
    </div>
  );
}
