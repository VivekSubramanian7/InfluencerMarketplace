"use client";

import { useState } from "react";
import { saveBrandProfile } from "@/app/brand/actions";
import { OFFERING_TYPES } from "@/lib/discovery/filters";
import { WebsiteIngest } from "@/components/brand/website-ingest";
import { OtherFormatField } from "@/components/brand/other-format-field";
import { ProposedProducts } from "@/components/brand/proposed-products";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { BrandProfileDefaults } from "@/components/brand/brand-profile-form";
import type { IngestProposal } from "@/lib/brand/ingest";

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video",
};

const STEPS = [
  { label: "Your brand", number: 1 },
  { label: "Who you work with", number: 2 },
  { label: "Outreach style", number: 3 },
] as const;

export function OnboardingWizard({
  defaults,
  proposal,
  website,
  productsJson,
}: {
  defaults: BrandProfileDefaults | null;
  proposal: IngestProposal | null;
  website: string | null;
  productsJson: string | null;
}) {
  const [step, setStep] = useState(1);

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>Step {step} of 3 · {STEPS[step - 1].label}</span>
        <span className="tabular-nums">{Math.round((step / 3) * 100)}% complete</span>
      </div>
      <div className="mt-1.5 flex gap-1">
        {STEPS.map((s) => (
          <div
            key={s.number}
            className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
              s.number <= step ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="mt-6 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Start with your website</h2>
          <div className="mt-2">
            <WebsiteIngest from="onboarding" website={website} proposal={proposal} />
          </div>
        </div>
      )}

      <form action={saveBrandProfile} className="mt-6">
        <input type="hidden" name="from" value="onboarding" />
        {productsJson && step === 2 && <ProposedProducts initial={JSON.parse(productsJson)} />}

        <div className={step === 1 ? "flex flex-col gap-4" : "hidden"}>
          <h2 className="text-lg font-bold">Tell us about your brand</h2>
          <p className="text-sm text-muted-foreground">
            The basics — who you are and what you do.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company">Company name</Label>
            <Input
              id="company"
              name="company"
              defaultValue={defaults?.company ?? ""}
              placeholder="Acme Skincare"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              name="website"
              type="url"
              defaultValue={defaults?.website ?? ""}
              placeholder="https://acme.com"
            />
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
        </div>

        <div className={step === 2 ? "flex flex-col gap-4" : "hidden"}>
          <h2 className="text-lg font-bold">Who do you work with?</h2>
          <p className="text-sm text-muted-foreground">
            Helps us suggest the right creators for your brand.
          </p>
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
        </div>

        <div className={step === 3 ? "flex flex-col gap-4" : "hidden"}>
          <h2 className="text-lg font-bold">Your outreach style</h2>
          <p className="text-sm text-muted-foreground">
            Your default message and any documents creators should have.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="outreach_template">Message template</Label>
            <Textarea
              id="outreach_template"
              name="outreach_template"
              rows={3}
              maxLength={2000}
              defaultValue={defaults?.outreach_template ?? ""}
              placeholder="Hi! We love your work and would like to collaborate on…"
            />
            <p className="text-xs text-muted-foreground">
              Sent when you reach out to creators from Discover.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guidelines">Brand guidelines</Label>
              <input
                id="guidelines"
                name="guidelines"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                className="text-sm file:mr-3 file:rounded-full file:border file:bg-background file:px-4 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rules">Rules for influencers</Label>
              <input
                id="rules"
                name="rules"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                className="text-sm file:mr-3 file:rounded-full file:border file:bg-background file:px-4 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Shared with every creator you work with. PDF, Word, or text, up to 10 MB.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Anything else</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={4000}
              defaultValue={defaults?.notes ?? ""}
              placeholder="Anything creators or our matching should know, in your own words."
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button type="button" onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <SubmitButton pendingLabel="Saving…">
              Save and start discovering
            </SubmitButton>
          )}
        </div>
      </form>
    </div>
  );
}
