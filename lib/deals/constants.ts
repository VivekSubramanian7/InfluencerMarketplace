import type { DealStatus } from "./machine";

export const STATUS_LABELS: Record<DealStatus, string> = {
  requested:          "Awaiting response",
  accepted:           "In production",
  product_sent:       "Product sent",
  product_received:   "Product received",
  submitted:          "Preview submitted",
  revision_requested: "Changes requested",
  published:          "Published, awaiting approval",
  completed:          "Completed",
  cancelled:          "Cancelled",
  disputed:           "Disputed",
};

export const DEAL_STEPS = [
  "Booked", "Accepted", "Submitted", "Published", "Completed",
] as const;

export const BARTER_DEAL_STEPS = [
  "Booked", "Accepted", "Product", "Submitted", "Published", "Completed",
] as const;

export const STATUS_TO_STEP: Record<DealStatus, number> = {
  requested: 0,
  accepted: 1,
  product_sent: 2,
  product_received: 2,
  submitted: 3,
  revision_requested: 3,
  published: 4,
  completed: 5,
  cancelled: -1,
  disputed: -1,
};

export const STATUS_TO_STEP_PAID: Record<DealStatus, number> = {
  requested: 0,
  accepted: 1,
  product_sent: -1,
  product_received: -1,
  submitted: 2,
  revision_requested: 2,
  published: 3,
  completed: 4,
  cancelled: -1,
  disputed: -1,
};

export const ACTION_TITLES: Record<string, string> = {
  accept:               "Deal accepted",
  decline:              "Deal declined",
  mark_product_sent:    "Product marked as sent",
  mark_product_received:"Product marked as received",
  submit_preview:       "Preview submitted for review",
  approve_preview:      "Preview approved — clear to publish",
  request_revision:     "Changes requested on preview",
  mark_published:       "Live link submitted — awaiting brand approval",
  approve:              "Deal approved and completed",
  cancel:               "Deal cancelled",
  dispute:              "Dispute opened",
};
