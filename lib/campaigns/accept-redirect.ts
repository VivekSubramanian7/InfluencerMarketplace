export function acceptRedirect(returnTo: string | null, dealId: string): string {
  return returnTo && returnTo.startsWith("/") ? returnTo : `/deals/${dealId}`;
}
