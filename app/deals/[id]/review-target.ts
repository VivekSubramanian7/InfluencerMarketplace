export function reviewRevalidatePath(
  targetRole: "brand" | "creator",
  handle: string,
): string {
  return targetRole === "brand" ? `/brand/${handle}` : `/c/${handle}`;
}
