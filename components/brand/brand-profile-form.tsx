import { saveBrandProfile } from "@/app/brand/actions";
import { OFFERING_TYPES } from "@/lib/discovery/filters";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { OtherFormatField } from "@/components/brand/other-format-field";
import { ProposedProducts } from "@/components/brand/proposed-products";

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video",
};

export interface BrandProfileDefaults {
  company: string | null;
  website: string | null;
  description: string | null;
  notes: string | null;
  outreach_template: string | null;
  pref_niches: string[];
  pref_types: string[];
  pref_types_other: string | null;
  guidelines_path: string | null;
  rules_path: string | null;
}

// Shared between /brand/onboarding (from="onboarding") and /brand/settings.
export function BrandProfileForm({
  defaults,
  from,
  productsJson,
}: {
  defaults: BrandProfileDefaults | null;
  from: "onboarding" | "settings";
  /** website-ingestion products, applied only when this form is saved */
  productsJson?: string | null;
}) {
  return (
    <form action={saveBrandProfile} className="flex flex-col gap-5">
      <input type="hidden" name="from" value={from} />
      {productsJson && <ProposedProducts initial={JSON.parse(productsJson)} />}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="company">Company name</Label>
        <Input id="company" name="company" defaultValue={defaults?.company ?? ""} placeholder="Acme Skincare" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="website">Website</Label>
        <Input id="website" name="website" type="url" defaultValue={defaults?.website ?? ""} placeholder="https://acme.com" />
        <p className="text-xs text-muted-foreground">
          For now we use this as a reference for creators. Automatic product and
          brand-description extraction is coming.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">What your brand is about</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={defaults?.description ?? ""}
          placeholder="What you sell, who it's for, and the tone you go for."
        />
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-semibold">
          What kind of creators should we suggest?
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pref_niches">Content niches (comma-separated, up to 8)</Label>
          <Input
            id="pref_niches"
            name="pref_niches"
            defaultValue={(defaults?.pref_niches ?? []).join(", ")}
            placeholder="beauty, fitness, food"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Formats</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {OFFERING_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="pref_types"
                  value={t}
                  defaultChecked={(defaults?.pref_types ?? []).includes(t)}
                  className="size-4 accent-primary"
                />
                {TYPE_LABELS[t]}
              </label>
            ))}
          </div>
          <OtherFormatField defaultValue={defaults?.pref_types_other ?? ""} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-semibold">Documents for creators</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="guidelines">
            Brand guidelines{defaults?.guidelines_path ? " (uploaded, choose a file to replace)" : ""}
          </Label>
          <input
            id="guidelines"
            name="guidelines"
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md"
            className="text-sm file:mr-3 file:rounded-full file:border file:bg-background file:px-4 file:py-1.5 file:text-sm file:font-medium"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rules">
            Your rules for influencers{defaults?.rules_path ? " (uploaded, choose a file to replace)" : ""}
          </Label>
          <input
            id="rules"
            name="rules"
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md"
            className="text-sm file:mr-3 file:rounded-full file:border file:bg-background file:px-4 file:py-1.5 file:text-sm file:font-medium"
          />
          <p className="text-xs text-muted-foreground">
            Shared automatically with every creator you work with. PDF, Word, or text, up to 10 MB.
          </p>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="outreach_template">Reachout message template</Label>
        <Textarea
          id="outreach_template"
          name="outreach_template"
          rows={4}
          maxLength={2000}
          defaultValue={defaults?.outreach_template ?? ""}
          placeholder="Hi! We love your work and would like to collaborate on…"
        />
        <p className="text-xs text-muted-foreground">
          Sent as the invitation when you reach out to creators from Discover.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Anything else</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={4000}
          defaultValue={defaults?.notes ?? ""}
          placeholder="Anything creators or our matching should know, in your own words."
        />
      </div>

      <SubmitButton className="mt-1 self-start" pendingLabel="Saving…">
        {from === "onboarding" ? "Save and start discovering" : "Save changes"}
      </SubmitButton>
    </form>
  );
}
