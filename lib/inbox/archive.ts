type ArchiveRow = {
  brand_id: string;
  creator_id: string;
  archived_by_brand_at: string | null;
  archived_by_creator_at: string | null;
};

export function isArchivedForUser(c: ArchiveRow, userId: string): boolean {
  if (c.brand_id === userId) return !!c.archived_by_brand_at;
  if (c.creator_id === userId) return !!c.archived_by_creator_at;
  return false;
}
