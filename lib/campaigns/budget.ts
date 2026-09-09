export function budgetWarning(priceCents: number, budgetMaxCents: number): string | null {
  if (priceCents > budgetMaxCents) {
    return "This is above the brand's budget — you can still apply, but they may decline.";
  }
  return null;
}

export function capOfferToCampaign(
  priceCents: number,
  budgetMaxCents: number | null
): { cents: number; capped: boolean } {
  if (budgetMaxCents != null && priceCents > budgetMaxCents) {
    return { cents: budgetMaxCents, capped: true };
  }
  return { cents: priceCents, capped: false };
}
