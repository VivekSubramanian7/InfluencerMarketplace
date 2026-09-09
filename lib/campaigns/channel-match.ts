export function creatorHasRequiredChannel(
  creatorPlatforms: string[],
  requiredPlatforms: string[],
): boolean {
  if (requiredPlatforms.length === 0) return true;
  return requiredPlatforms.some((p) => creatorPlatforms.includes(p));
}
