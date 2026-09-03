"use client";

import posthog from "posthog-js";

export function captureClientEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) {
      posthog.capture(event, properties);
    }
  } catch {
    // ponytail: analytics must never break user flows
  }
}

export function identifyClientUser(
  userId: string,
  properties: Record<string, unknown>,
): void {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) {
      posthog.identify(userId, properties);
    }
  } catch {}
}

export function resetClientAnalytics(): void {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) {
      posthog.reset();
    }
  } catch {}
}
