const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

export function parseHandle(raw: string): string | null {
  const h = raw.trim().toLowerCase();
  return HANDLE_RE.test(h) ? h : null;
}

export function parsePriceCents(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [dollars, decimals = ""] = s.split(".");
  const cents = parseInt(dollars, 10) * 100 + parseInt(decimals.padEnd(2, "0") || "0", 10);
  if (cents < 100 || cents > 100_000_000) return null;
  return cents;
}

export function parseTags(raw: string, max = 8): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const tag = part.trim().toLowerCase();
    if (tag.length >= 1 && tag.length <= 30) seen.add(tag);
    if (seen.size === max) break;
  }
  return [...seen];
}

export function parseIntInRange(raw: string, min: number, max: number): number | null {
  const s = raw.trim();
  if (!/^-?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= min && n <= max ? n : null;
}

export function parseMediaUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseText(raw: string, maxLen: number): string | null {
  const t = raw.trim();
  return t.length >= 1 && t.length <= maxLen ? t : null;
}
