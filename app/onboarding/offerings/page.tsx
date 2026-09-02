import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { saveOfferingStep } from "./actions";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video (no posting)",
};

export default async function OnboardingOfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user } = await requireRole("creator", "/onboarding/offerings");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: profile } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (!profile) {
    redirect("/onboarding/profile?error=" + encodeURIComponent("Claim your handle first"));
  }

  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, type, title, price_cents")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <WizardShell step="offerings" skip={false}>
      <p className="mt-2 text-sm text-muted-foreground">
        Productize what brands can book: a clear title, a set price, a turnaround.
      </p>
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
          Offering added! Add another or continue.
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-2">
        {(offerings ?? []).map((o) => (
          <li key={o.id} className="flex items-baseline justify-between gap-4 rounded-xl border p-4">
            <span className="min-w-0 truncate">
              <span className="font-bold">{o.title}</span>{" "}
              <span className="text-sm text-muted-foreground">{TYPE_LABELS[o.type] ?? o.type}</span>
            </span>
            <span className="shrink-0 font-extrabold tabular-nums text-primary">
              ${(o.price_cents / 100).toFixed(2)}
            </span>
          </li>
        ))}
        {(offerings ?? []).length === 0 && (
          <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No offerings yet. Add your first below.
          </li>
        )}
      </ul>

      <section className="mt-6 rounded-xl border p-5">
        <h2 className="font-bold">Add an offering</h2>
        <form action={saveOfferingStep} className="mt-3 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            defaultValue="dedicated_video"
          >
            {Object.entries(TYPE_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required placeholder="Honest product review video" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="price">Price (USD)</Label>
            <Input id="price" name="price" inputMode="decimal" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="turnaround_days">Turnaround (days)</Label>
            <Input id="turnaround_days" name="turnaround_days" type="number" defaultValue={14} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="revision_limit">Revisions</Label>
            <Input id="revision_limit" name="revision_limit" type="number" defaultValue={1} />
          </div>
        </div>
        <SubmitButton variant="outline" className="self-start" pendingLabel="Adding…">
          Add offering
        </SubmitButton>
        </form>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
        <p className="text-sm text-muted-foreground">
          {(offerings ?? []).length > 0
            ? `${(offerings ?? []).length} ${(offerings ?? []).length === 1 ? "offering" : "offerings"} added`
            : "Nothing added yet, you can do this later"}
        </p>
        <Button asChild>
          <Link href="/onboarding/highlights">Continue → Show your best work</Link>
        </Button>
      </div>
    </WizardShell>
  );
}
