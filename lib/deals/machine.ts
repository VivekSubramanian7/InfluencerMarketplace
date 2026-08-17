export type DealStatus =
  | "requested" | "funded" | "accepted" | "in_production" | "submitted"
  | "revision_requested" | "published" | "completed" | "cancelled" | "disputed";

export type DealAction =
  | "fund" | "accept" | "decline" | "expire_accept" | "begin_production"
  | "submit_preview" | "request_revision" | "mark_published" | "approve"
  | "auto_approve" | "cancel" | "dispute" | "resolve_release" | "resolve_refund";

export type Actor = "brand" | "creator" | "system" | "admin";
export type PaymentMode = "escrow" | "off_platform";

export interface Transition {
  from: DealStatus;
  action: DealAction;
  to: DealStatus;
  actor: Actor;
  /** null = allowed in both payment modes */
  mode: PaymentMode | null;
}

const DISPUTABLE: DealStatus[] = [
  "accepted", "in_production", "submitted", "revision_requested", "published",
];

export const TRANSITIONS: Transition[] = [
  // funding gate (escrow only; Stripe webhook is the caller)
  { from: "requested", action: "fund", to: "funded", actor: "system", mode: "escrow" },

  // creator acceptance — entry state differs by mode
  { from: "funded", action: "accept", to: "accepted", actor: "creator", mode: "escrow" },
  { from: "requested", action: "accept", to: "accepted", actor: "creator", mode: "off_platform" },
  { from: "funded", action: "decline", to: "cancelled", actor: "creator", mode: "escrow" },
  { from: "requested", action: "decline", to: "cancelled", actor: "creator", mode: "off_platform" },

  // 72h accept deadline (worker)
  { from: "funded", action: "expire_accept", to: "cancelled", actor: "system", mode: "escrow" },
  { from: "requested", action: "expire_accept", to: "cancelled", actor: "system", mode: null },

  // production flow
  { from: "accepted", action: "begin_production", to: "in_production", actor: "creator", mode: null },
  { from: "in_production", action: "submit_preview", to: "submitted", actor: "creator", mode: null },
  { from: "revision_requested", action: "submit_preview", to: "submitted", actor: "creator", mode: null },
  { from: "submitted", action: "request_revision", to: "revision_requested", actor: "brand", mode: null },
  { from: "submitted", action: "mark_published", to: "published", actor: "creator", mode: null },

  // completion — brand approval or 5-day auto-approve (worker)
  { from: "published", action: "approve", to: "completed", actor: "brand", mode: null },
  { from: "published", action: "auto_approve", to: "completed", actor: "system", mode: null },

  // cancellation before submission (either side; refund handled by payments layer)
  { from: "requested", action: "cancel", to: "cancelled", actor: "brand", mode: null },
  { from: "funded", action: "cancel", to: "cancelled", actor: "brand", mode: "escrow" },
  { from: "accepted", action: "cancel", to: "cancelled", actor: "brand", mode: null },
  { from: "in_production", action: "cancel", to: "cancelled", actor: "brand", mode: null },
  { from: "accepted", action: "cancel", to: "cancelled", actor: "creator", mode: null },
  { from: "in_production", action: "cancel", to: "cancelled", actor: "creator", mode: null },

  // disputes
  ...DISPUTABLE.flatMap((from): Transition[] => [
    { from, action: "dispute", to: "disputed", actor: "brand", mode: null },
    { from, action: "dispute", to: "disputed", actor: "creator", mode: null },
  ]),
  { from: "disputed", action: "resolve_release", to: "completed", actor: "admin", mode: null },
  { from: "disputed", action: "resolve_refund", to: "cancelled", actor: "admin", mode: null },
];

export function canTransition(
  from: DealStatus,
  action: DealAction,
  actor: Actor,
  mode: PaymentMode
): Transition | undefined {
  return TRANSITIONS.find(
    (t) =>
      t.from === from &&
      t.action === action &&
      t.actor === actor &&
      (t.mode === null || t.mode === mode)
  );
}
