"use client";

import { Button } from "@/components/ui/button";

export function BookCallBlocker({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-float)]">
        <h2 className="text-lg font-semibold">Need more than 5 creators?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Free campaigns are limited to 5 influencers. Book a call with our team to scale up.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button asChild>
            <a href="https://cal.com/" target="_blank" rel="noopener noreferrer">
              Book a call
            </a>
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}
