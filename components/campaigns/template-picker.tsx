"use client";

import { useState } from "react";
import { createCampaign } from "@/app/campaigns/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video (no posting)",
};

type CampaignTemplate = {
  id: string;
  title: string;
  description: string;
  offering_type: string;
  budget_min_cents: number;
  budget_max_cents: number;
};

export function TemplatePicker({
  campaigns,
  liveCreatorCount,
}: {
  campaigns: CampaignTemplate[];
  liveCreatorCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"choose" | "blank" | "template">("choose");
  const [selected, setSelected] = useState<CampaignTemplate | null>(null);

  const close = () => {
    setOpen(false);
    setMode("choose");
    setSelected(null);
  };

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className="mt-4">
        New campaign
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-dialog-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-float)]"
      >
        <h2 id="campaign-dialog-title" className="text-lg font-semibold">New campaign</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {liveCreatorCount} live creators on Clipline
        </p>

        {mode === "choose" && (
          <div className="mt-4 flex flex-col gap-2">
            <Button type="button" variant="outline" onClick={() => setMode("blank")}>
              Start from scratch
            </Button>
            {campaigns.length > 0 && (
              <Button type="button" variant="outline" onClick={() => setMode("template")}>
                Start from a template
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          </div>
        )}

        {mode === "template" && (
          <ul className="mt-4 flex flex-col gap-2">
            {campaigns.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => { setSelected(c); setMode("blank"); }}
                  className="w-full rounded-[var(--radius-tile)] border border-[var(--border)] p-4 text-left transition-colors hover:bg-[var(--row-hover)]"
                >
                  <span className="font-medium">{c.title}</span>
                  <span className="mt-0.5 block text-sm text-[var(--muted-foreground)]">
                    {TYPE_LABELS[c.offering_type] ?? c.offering_type}
                  </span>
                </button>
              </li>
            ))}
            <Button type="button" variant="ghost" onClick={() => setMode("choose")}>← Back</Button>
          </ul>
        )}

        {mode === "blank" && (
          <form action={createCampaign} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                required
                defaultValue={selected ? `Copy of ${selected.title}` : ""}
                placeholder="Spring launch, honest review videos"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">What you&apos;re looking for</Label>
              <Textarea
                id="description"
                name="description"
                rows={5}
                required
                defaultValue={selected?.description ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Content type</Label>
              <select
                id="type"
                name="type"
                className="h-10 rounded-lg border bg-background px-3 text-sm"
                defaultValue={selected?.offering_type ?? "dedicated_video"}
              >
                {Object.entries(TYPE_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="budget_min">Budget from (USD)</Label>
                <Input
                  id="budget_min"
                  name="budget_min"
                  inputMode="decimal"
                  required
                  defaultValue={selected ? (selected.budget_min_cents / 100).toFixed(2) : ""}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="budget_max">Budget to (USD)</Label>
                <Input
                  id="budget_max"
                  name="budget_max"
                  inputMode="decimal"
                  required
                  defaultValue={selected ? (selected.budget_max_cents / 100).toFixed(2) : ""}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apply_by">Applications close (optional)</Label>
              <Input id="apply_by" name="apply_by" type="date" />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Start campaign</Button>
              <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
