export function responseTimeMs(invitedAt: string, respondedAt: string | null): number | null {
  if (!respondedAt) return null;
  return new Date(respondedAt).getTime() - new Date(invitedAt).getTime();
}

export function averageResponseTimeMs(samples: number[]): number | null {
  if (samples.length === 0) return null;
  return Math.round(samples.reduce((sum, ms) => sum + ms, 0) / samples.length);
}
