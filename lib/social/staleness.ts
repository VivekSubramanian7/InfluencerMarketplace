// last_synced_at doubles as "last sync attempt": failed fetches also stamp
// it (the storefront only shows the date when a follower count exists), so
// these windows are a per-account backoff as well as a freshness measure.

export const STALE_AFTER_DAYS = 7;
export const HARD_STALE_AFTER_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

function ageDays(lastSyncedAt: string | null, now: Date): number | null {
  if (!lastSyncedAt) return null;
  const t = Date.parse(lastSyncedAt);
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / DAY_MS;
}

// Never attempted, unparsable, or older than the sync window → due.
export function isDueForSync(lastSyncedAt: string | null, now: Date = new Date()): boolean {
  const age = ageDays(lastSyncedAt, now);
  return age === null || age >= STALE_AFTER_DAYS;
}

// Old enough that previously synced numbers should be flagged 'stale'.
export function isStale(lastSyncedAt: string | null, now: Date = new Date()): boolean {
  const age = ageDays(lastSyncedAt, now);
  return age !== null && age >= HARD_STALE_AFTER_DAYS;
}
