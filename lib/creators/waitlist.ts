export const WAITLIST_FOLLOWER_FLOOR = 3000;

export function publishDecision(maxFollowerCount: number | null): "live" | "waitlisted" {
  if (maxFollowerCount === null) return "waitlisted";
  return maxFollowerCount >= WAITLIST_FOLLOWER_FLOOR ? "live" : "waitlisted";
}
