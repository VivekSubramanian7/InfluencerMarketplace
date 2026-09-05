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

const CANDIDATES: UiAction[] = [
  { action: "accept", label: "Accept deal", needsUrl: null, confirm: false },
  { action: "decline", label: "Decline", needsUrl: null, confirm: true },
  { action: "submit_preview", label: "Submit preview", needsUrl: "preview_url", confirm: false },
  { action: "approve_preview", label: "Approve preview", needsUrl: null, confirm: false },
  { action: "request_revision", label: "Request changes", needsUrl: null, confirm: false, needsNote: true },
  { action: "mark_published", label: "Mark as published", needsUrl: "live_url", confirm: false },
  { action: "approve", label: "Approve & complete", needsUrl: null, confirm: false, needsPreview: true },
  { action: "cancel", label: "Cancel deal", needsUrl: null, confirm: true },
  { action: "dispute", label: "Open dispute", needsUrl: null, confirm: true },
];

export function actionsFor(
  status: DealStatus,
  role: "brand" | "creator",
  mode: PaymentMode,
  revisionCount = 0,
  revisionLimit = 1,
): UiAction[] {
  return CANDIDATES.filter((c) => {
    if (c.action === "request_revision" && revisionCount >= revisionLimit) return false;
    return canTransition(status, c.action, role, mode);
  });
}

export function primaryActionLabel(
  status: DealStatus,
  role: "brand" | "creator",
  mode: PaymentMode,
): string | null {
  const first = actionsFor(status, role, mode).find((a) => !a.confirm);
  return first?.label ?? null;
}
