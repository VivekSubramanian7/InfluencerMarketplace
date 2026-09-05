import type { DealStatus } from "./machine";

export const STATUS_LABELS: Record<DealStatus, string> = {
  requested:          "Awaiting response",
  accepted:           "In production",
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

export const STATUS_TO_STEP: Record<DealStatus, number> = {
  requested: 0,
  accepted: 1,
  submitted: 2,
  revision_requested: 2,
  published: 3,
  completed: 4,
  cancelled: -1,
  disputed: -1,
};

export const ACTION_TITLES: Record<string, string> = {
  accept:           "Deal accepted",
  decline:          "Deal declined",
  submit_preview:   "Preview submitted for review",
  approve_preview:  "Preview approved — clear to publish",
  request_revision: "Changes requested on preview",
  mark_published:   "Content is live — deal completed",
  approve:          "Deal approved and completed",
  cancel:           "Deal cancelled",
  dispute:          "Dispute opened",
};
