import "server-only";
import { PostHog } from "posthog-node";

export type AnalyticsEvent =
  | "signup_started"
  | "signup_completed"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "creator_profile_viewed"
  | "booking_started"
  | "booking_completed"
  | "deal_state_changed"
  | "deal_created"
  | "deal_marked_paid"
  | "deal_review_submitted"
  | "search_performed"
  | "search_zero_results"
  | "search_result_clicked"
  | "filter_applied"
  | "search_saved"
  | "storefront_viewed"
  | "storefront_section_viewed"
  | "storefront_cta_clicked"
  | "offering_viewed"
  | "message_sent"
  | "offer_sent"
  | "offer_accepted"
  | "offer_declined"
  | "invite_sent"
  | "invite_accepted"
  | "invite_declined"
  | "reachouts_sent"
  | "notification_clicked"
  | "dashboard_section_viewed";

let _client: PostHog | null = null;

function getServerClient(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (!_client) {
    _client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 20,
      flushInterval: 10000,
    });
  }
  return _client;
}

export function trackServerEvent(
  event: AnalyticsEvent,
  distinctId: string,
  properties?: Record<string, unknown>,
): void {
  try {
    getServerClient()?.capture({ distinctId, event, properties });
  } catch {
    // ponytail: analytics must never break user flows
  }
}

export function identifyServerUser(
  distinctId: string,
  properties: Record<string, unknown>,
): void {
  try {
    getServerClient()?.identify({ distinctId, properties });
  } catch {
    // ponytail: analytics must never break user flows
  }
}
