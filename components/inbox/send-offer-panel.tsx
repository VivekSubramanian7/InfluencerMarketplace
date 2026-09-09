"use client";

import { OFFER_VERB } from "@/lib/copy/taxonomy";

export function SendOfferPanel({
  open,
  children,
}: {
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={open} className="rounded-lg border border-[var(--border)]">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
        {OFFER_VERB}
      </summary>
      <div className="border-t border-[var(--divider)] p-3">{children}</div>
    </details>
  );
}
