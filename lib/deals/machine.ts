export type DealStatus =
  | "requested" | "accepted" | "submitted"
  | "revision_requested" | "published" | "completed" | "cancelled" | "disputed";

export type DealAction =
  | "accept" | "decline" | "expire_accept" | "submit_preview"
  | "approve_preview" | "request_revision" | "mark_published" | "approve"
  | "auto_approve" | "cancel" | "dispute" | "resolve_release" | "resolve_refund";

export type Actor = "brand" | "creator" | "system" | "admin";
export type PaymentMode = "escrow" | "off_platform";

export interface Transition {
  from: DealStatus;
  action: DealAction;
  to: DealStatus;
  actor: Actor;
  mode: PaymentMode | null;
}

const DISPUTABLE: DealStatus[] = [
  "accepted", "submitted", "revision_requested", "published",
];

export const TRANSITIONS: Transition[] = [
  // creator acceptance — no funding gate (escrow not live)
  { from: "requested", action: "accept", to: "accepted", actor: "creator", mode: null },
  { from: "requested", action: "decline", to: "cancelled", actor: "creator", mode: null },

  // 72h accept deadline (worker)
  { from: "requested", action: "expire_accept", to: "cancelled", actor: "system", mode: null },

  // production flow — creator submits directly from accepted
  { from: "accepted", action: "submit_preview", to: "submitted", actor: "creator", mode: null },
  { from: "revision_requested", action: "submit_preview", to: "submitted", actor: "creator", mode: null },
  { from: "submitted", action: "request_revision", to: "revision_requested", actor: "brand", mode: null },
  { from: "submitted", action: "approve_preview", to: "submitted", actor: "brand", mode: null },
  { from: "submitted", action: "mark_published", to: "published", actor: "creator", mode: null },

  // completion
  { from: "published", action: "approve", to: "completed", actor: "brand", mode: null },
  { from: "published", action: "auto_approve", to: "completed", actor: "system", mode: null },

  // cancellation before submission
  { from: "requested", action: "cancel", to: "cancelled", actor: "brand", mode: null },
  { from: "accepted", action: "cancel", to: "cancelled", actor: "brand", mode: null },
  { from: "accepted", action: "cancel", to: "cancelled", actor: "creator", mode: null },

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
