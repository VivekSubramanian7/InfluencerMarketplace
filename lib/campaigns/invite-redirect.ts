export function inviteRedirect(conversationId: string | null, count: number): string {
  if (conversationId && count === 1) return `/inbox?c=${conversationId}`;
  return `/inbox?sent=${count}`;
}
