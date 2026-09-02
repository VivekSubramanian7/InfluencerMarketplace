"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * A destructive submit button that requires a second, deliberate click before
 * it will submit its enclosing <form>. Guards against accidental data loss.
 */
export function ConfirmSubmitButton({
  label,
  confirmLabel,
  message,
}: {
  label: string;
  confirmLabel: string;
  message?: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive border-destructive/40"
        onClick={() => setArmed(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {message && (
        <span className="text-xs text-muted-foreground">{message}</span>
      )}
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="text-destructive border-destructive/40"
      >
        {confirmLabel}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setArmed(false)}
      >
        Cancel
      </Button>
    </span>
  );
}
