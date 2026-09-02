"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const TRENDING = [
  "gaming",
  "food",
  "beauty",
  "tech",
  "fitness",
  "lifestyle",
  "fashion",
  "finance",
] as const;

/**
 * Search field that surfaces helpful suggestions (recent searches + trending
 * niches) the moment the user focuses an empty field — minimising initial
 * effort. Lives inside the Discover GET form; the Search button submits it.
 */
export function SearchSuggest({
  defaultValue,
  recent = [],
}: {
  defaultValue: string;
  recent?: { name: string; href: string }[];
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const showSuggestions = open && value.trim() === "";

  return (
    <div className="flex min-w-56 flex-1 gap-2">
      <div className="relative flex-1">
        <Input
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder="Search by name, handle, or bio"
          aria-label="Search creators"
          autoComplete="off"
          className="h-10 w-full rounded-full bg-background px-4"
        />
        {showSuggestions && (
          <div className="absolute left-0 top-full z-30 mt-2 w-full rounded-2xl border bg-popover p-3 shadow-card">
            {recent.length > 0 && (
              <div className="mb-3">
                <p className="px-1 pb-1.5 text-xs font-semibold text-muted-foreground">
                  Recent searches
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((r) => (
                    <Link
                      key={r.href}
                      href={r.href}
                      className="rounded-full border bg-background px-3 py-1 text-sm font-medium transition-colors hover:bg-secondary"
                    >
                      {r.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <p className="px-1 pb-1.5 text-xs font-semibold text-muted-foreground">
              Trending niches
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TRENDING.map((n) => (
                <Link
                  key={n}
                  href={`/discover?niche=${n}`}
                  className="rounded-full border bg-background px-3 py-1 text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {n}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      <Button type="submit" className="h-10 rounded-full px-6">
        Search
      </Button>
    </div>
  );
}
