"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// Submit button with a pending state for server-action forms. The socials
// add action blocks on a stats fetch (up to ~5s), so silent submits read
// as "nothing happened" without this.
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <span
            aria-hidden
            className="mr-1 inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
