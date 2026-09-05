"use client";

import { useRef } from "react";
import { sendThreadMessage } from "@/app/inbox/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function MessageComposer({
  conversationId,
  defaultValue = "",
  showDraftButton,
  draftAction,
}: {
  conversationId: string;
  defaultValue?: string;
  showDraftButton?: boolean;
  draftAction?: (formData: FormData) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <form
        ref={formRef}
        action={sendThreadMessage}
        className="flex flex-col gap-2"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            const target = e.target as HTMLElement;
            if (target.tagName === "TEXTAREA") {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }
        }}
      >
        <input type="hidden" name="conversation_id" value={conversationId} />
        <Textarea
          name="body"
          placeholder="Write a message"
          aria-label="Write a message"
          required
          maxLength={5000}
          rows={defaultValue ? 5 : 2}
          defaultValue={defaultValue}
        />
        <Button type="submit" className="self-end">Send</Button>
      </form>
      {showDraftButton && draftAction && (
        <form action={draftAction}>
          <input type="hidden" name="conversation_id" value={conversationId} />
          <SubmitButton variant="outline" size="sm" pendingLabel="Drafting…">
            Draft a reply with AI
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
