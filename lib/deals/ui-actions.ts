import {
  canTransition, DealAction, DealStatus, PaymentMode,
} from "@/lib/deals/machine";

export interface UiAction {
  action: DealAction;
  label: string;
  needsUrl: "preview_url" | "live_url" | null;
  confirm: boolean;
  needsNote?: boolean;
  needsPreview?: boolean;
}

// Order here is display order. Only user-facing actions (no system/admin).
const CANDIDATES: UiAction[] = [
  { action: "accept", label: "Accept deal", needsUrl: null, confirm: false },
  { action: "decline", label: "Decline", needsUrl: null, confirm: true },
  { action: "begin_production", label: "Start production", needsUrl: null, confirm: false },
  { action: "submit_preview", label: "Submit preview", needsUrl: "preview_url", confirm: false },
  { action: "request_revision", label: "Request changes", needsUrl: null, confirm: false, needsNote: true },
  { action: "mark_published", label: "Mark as published", needsUrl: "live_url", confirm: false },
  { action: "approve", label: "Approve & complete", needsUrl: null, confirm: false, needsPreview: true },
  { action: "cancel", label: "Cancel deal", needsUrl: null, confirm: true },
  { action: "dispute", label: "Open dispute", needsUrl: null, confirm: true },
];

export function actionsFor(
  status: DealStatus,
  role: "brand" | "creator",
  mode: PaymentMode
): UiAction[] {
  return CANDIDATES.filter((c) => canTransition(status, c.action, role, mode));
}
