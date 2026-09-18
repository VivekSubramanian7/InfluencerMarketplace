"use client";

import { useState } from "react";
import { createCampaign } from "@/app/campaigns/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { COUNTRIES, LANGUAGES } from "@/lib/constants";

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

type BrandProduct = { id: string; name: string };

export function TemplatePicker({
  campaigns,
  liveCreatorCount,
  products,
  autoOpen,
}: {
  campaigns: CampaignTemplate[];
  liveCreatorCount: number;
  products: BrandProduct[];
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen ?? false);
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="product_id">Product</Label>
              <select
                id="product_id"
                name="product_id"
                className="h-10 rounded-lg border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">None</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="buyer_persona">Buyer persona</Label>
              <Textarea
                id="buyer_persona"
                name="buyer_persona"
                rows={2}
                placeholder="Who is the target buyer? Age, interests, location…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Target locations</Label>
              <MultiSelect
                name="target_location"
                options={COUNTRIES}
                placeholder="Select countries…"
                max={10}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="target_language">Language</Label>
              <select
                id="target_language"
                name="target_language"
                className="h-10 rounded-lg border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">Any</option>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content_form">Content form</Label>
              <select
                id="content_form"
                name="content_form"
                className="h-10 rounded-lg border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">Any</option>
                <option value="reel">Reel</option>
                <option value="story">Story</option>
                <option value="post">Post</option>
                <option value="video">Video</option>
                <option value="live">Live</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="script">Script / brief</Label>
              <Textarea id="script" name="script" rows={4} placeholder="What should the creator say or show?" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="duration_seconds">Duration (seconds)</Label>
              <Input id="duration_seconds" name="duration_seconds" type="number" min={1} placeholder="e.g. 60" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_barter" className="size-4 accent-primary" />
              This is a barter deal (product exchange, no payment)
            </label>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expected_live_date">Expected live date</Label>
              <Input id="expected_live_date" name="expected_live_date" type="date" />
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
