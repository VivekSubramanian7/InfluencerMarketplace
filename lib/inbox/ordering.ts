export function sortConversationsByActivity<
  T extends { lastActivityAt: string | null; createdAt: string }
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ka = a.lastActivityAt ?? a.createdAt;
    const kb = b.lastActivityAt ?? b.createdAt;
    return kb.localeCompare(ka);
  });
}
