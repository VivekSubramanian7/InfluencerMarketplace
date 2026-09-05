export type InboxCta =
  | { kind: "accept_invite" }
  | { kind: "wait_invite" }
  | { kind: "accept_offer"; offerId: string }
  | { kind: "send_offer" }
  | { kind: "chat" }
  | { kind: "none" };

export function inboxCta(input: {
  role: "brand" | "creator";
  convStatus: "invited" | "accepted" | "declined";
  hasPendingOffer: boolean;
  pendingOfferId?: string;
}): InboxCta {
  if (input.convStatus === "invited") {
    if (input.role === "creator") return { kind: "accept_invite" };
    return { kind: "wait_invite" };
  }
  if (input.convStatus !== "accepted") return { kind: "none" };
  if (input.hasPendingOffer) {
    if (input.role === "creator" && input.pendingOfferId) {
      return { kind: "accept_offer", offerId: input.pendingOfferId };
    }
    return { kind: "chat" };
  }
  if (input.role === "brand") return { kind: "send_offer" };
  return { kind: "chat" };
}
