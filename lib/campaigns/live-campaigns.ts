export function liveCampaigns<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter((c) => c.status === "open");
}
