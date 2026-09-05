"use client";

import Link from "next/link";
import type { FilterToken } from "@/lib/filters/tokens";

export function FilterTokenBar({
  tokens,
  basePath,
  allowedKeys,
}: {
  tokens: FilterToken[];
  basePath: string;
  allowedKeys: { key: string; label: string; options: { value: string; label: string }[] }[];
}) {
  const without = (key: string) => {
    const next = tokens.filter((t) => t.key !== key);
    const qs = next.map((t) => `${t.key}=${encodeURIComponent(t.value)}`).join("&");
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const add = (key: string, value: string) => {
    const next = tokens.filter((t) => t.key !== key).concat([{ key, label: key, value }]);
    const qs = next.map((t) => `${t.key}=${encodeURIComponent(t.value)}`).join("&");
    return `${basePath}?${qs}`;
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {tokens.map((t) => (
        <Link
          key={t.key}
          href={without(t.key)}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--secondary)] px-3 py-1 text-xs font-medium text-[var(--ink)]"
        >
          {t.label}: {t.value}
          <span aria-hidden className="text-[var(--muted-foreground)]">×</span>
        </Link>
      ))}
      {allowedKeys.map((def) => {
        if (tokens.some((t) => t.key === def.key)) return null;
        const first = def.options[0];
        if (!first) return null;
        return (
          <Link
            key={def.key}
            href={add(def.key, first.value)}
            className="inline-flex items-center rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--ink)]"
          >
            + {def.label}
          </Link>
        );
      })}
      {tokens.length > 0 && (
        <Link href={basePath} className="text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--ink)]">
          Reset filters
        </Link>
      )}
    </div>
  );
}
