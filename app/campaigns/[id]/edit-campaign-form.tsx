"use client";

import { useState } from "react";
import { editCampaign } from "../actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function EditCampaignForm({
  campaign,
  returnTo,
}: {
  campaign: {
    id: string;
    title: string;
    description: string;
    budget_min_cents: number;
    budget_max_cents: number;
    apply_by: string | null;
  };
  returnTo?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
        Edit campaign
      </Button>
    );
  }

  return (
    <form action={editCampaign} className="mt-4 flex max-w-xl flex-col gap-4 rounded-xl border p-5">
      <input type="hidden" name="id" value={campaign.id} />
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-title">Title</Label>
        <Input id="edit-title" name="title" required maxLength={80} defaultValue={campaign.title} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          name="description"
          rows={5}
          required
          maxLength={2000}
          defaultValue={campaign.description}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-budget-min">Budget from (USD)</Label>
          <Input
            id="edit-budget-min"
            name="budget_min"
            inputMode="decimal"
            required
            defaultValue={(campaign.budget_min_cents / 100).toFixed(2)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-budget-max">Budget to (USD)</Label>
          <Input
            id="edit-budget-max"
            name="budget_max"
            inputMode="decimal"
            required
            defaultValue={(campaign.budget_max_cents / 100).toFixed(2)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-apply-by">Applications close</Label>
        <Input
          id="edit-apply-by"
          name="apply_by"
          type="date"
          defaultValue={campaign.apply_by ?? ""}
        />
      </div>
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingLabel="Saving…">Save changes</SubmitButton>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
