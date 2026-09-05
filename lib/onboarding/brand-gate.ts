export function shouldForceBrandOnboarding(
  hasProfile: boolean,
  source: "login" | "nav"
): boolean {
  return source === "login" && !hasProfile;
}
