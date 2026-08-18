import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { createBooking } from "./actions";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default async function BookOfferingPage({
  params, searchParams,
}: {
  params: Promise<{ offeringId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { offeringId } = await params;
  const { role } = await requireRole("brand", `/book/${offeringId}`);
  const { error } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: offering } = await supabase
    .from("offerings")
    .select("id, title, type, price_cents, turnaround_days, revision_limit, creator_id, active")
    .eq("id", offeringId)
    .maybeSingle();
  if (!offering || !offering.active) notFound();

  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("handle")
    .eq("user_id", offering.creator_id)
    .maybeSingle();

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Book: {offering.title}</h1>

      <div className="mt-4 rounded-xl border p-5">
        <p className="text-muted-foreground">
          {creator ? <>by @{creator.handle} · </> : null}
          <span className="font-extrabold tabular-nums text-primary">
            ${(offering.price_cents / 100).toFixed(2)}
          </span>{" "}
          · {offering.turnaround_days}d turnaround ·{" "}
          {offering.revision_limit} revision{offering.revision_limit === 1 ? "" : "s"}
        </p>
      </div>

      <p className="mt-4 rounded-lg border border-amber bg-amber/15 px-4 py-3 text-sm">
        Payment is handled outside the platform for now — you and the creator
        agree on payment directly. The deal tracker keeps both sides honest.
      </p>
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <form action={createBooking} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="offering_id" value={offering.id} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goals">Goals — what does success look like? *</Label>
          <Textarea id="goals" name="goals" rows={4} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product_description">Product / service description</Label>
          <Textarea id="product_description" name="product_description" rows={3} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="talking_points">Key talking points</Label>
          <Textarea id="talking_points" name="talking_points" rows={3} />
        </div>
        <Button type="submit" className="mt-2">
          Send booking request
        </Button>
      </form>
      </main>
    </>
  );
}
