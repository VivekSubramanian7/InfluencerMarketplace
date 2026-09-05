export type FilterToken = { key: string; label: string; value: string };

const LABELS: Record<string, string> = {
  status: "Status",
  needs_me: "Needs me",
};

export function parseFilterTokens(sp: URLSearchParams, allowed: string[]): FilterToken[] {
  const tokens: FilterToken[] = [];
  for (const key of allowed) {
    const value = sp.get(key);
    if (!value) continue;
    tokens.push({ key, label: LABELS[key] ?? key, value });
  }
  return tokens;
}

export function toSearchParams(tokens: FilterToken[]): URLSearchParams {
  const sp = new URLSearchParams();
  for (const t of tokens) {
    sp.set(t.key, t.value);
  }
  return sp;
}
