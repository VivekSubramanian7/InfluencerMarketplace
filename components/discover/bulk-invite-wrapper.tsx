"use client";

import { useState, useCallback } from "react";
import { BookCallBlocker } from "@/components/discover/book-call-blocker";
import { BulkInviteToCampaign } from "@/components/discover/invite-to-campaign";

type Campaign = { id: string; title: string };

export function BulkInviteWrapper({
  campaigns,
  formId,
}: {
  campaigns: Campaign[];
  formId: string;
}) {
  const [blockerOpen, setBlockerOpen] = useState(false);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const checked = form.querySelectorAll('input[name="creator_id"]:checked');
    if (checked.length > 5) {
      e.preventDefault();
      setBlockerOpen(true);
    }
  }, [formId]);

  return (
    <>
      <div onSubmitCapture={handleSubmit}>
        <BulkInviteToCampaign campaigns={campaigns} formId={formId} />
      </div>
      <BookCallBlocker open={blockerOpen} onClose={() => setBlockerOpen(false)} />
    </>
  );
}
