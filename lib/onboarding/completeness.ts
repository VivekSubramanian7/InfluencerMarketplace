export interface StorefrontCounts {
  socialCount: number;
  offeringCount: number;
  portfolioCount: number;
  isLive: boolean;
}

export function storefrontComplete(s: StorefrontCounts): boolean {
  return s.socialCount >= 1 && s.offeringCount >= 1 && s.portfolioCount >= 1 && s.isLive;
}

export function missingStorefrontItems(s: StorefrontCounts): string[] {
  const missing: string[] = [];
  if (s.socialCount < 1) missing.push("a channel");
  if (s.offeringCount < 1) missing.push("an offering");
  if (s.portfolioCount < 1) missing.push("a sample link");
  if (!s.isLive) missing.push("a published storefront");
  return missing;
}

export function storefrontCompletenessError(
  missing: string[],
  action = "applying",
): string {
  return `Complete your storefront (${missing.join(", ")}) before ${action}`;
}
