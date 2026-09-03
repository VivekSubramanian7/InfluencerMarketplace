import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { createBooking } from "./actions";
import { SiteNav } from "@/components/site-nav";
import { Label } from "@/components/ui/label";
import { CharCountTextarea } from "@/components/book/char-count-textarea";
import { BookingConfirmButton } from "@/components/book/booking-confirm-button";

export default async function BookOfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ offeringId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { offeringId } = await params;
  const { user, role } = await requireRole("brand", `/book/${offeringId}`);
  const { error } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: offering } = await supabase
    .from("offerings")
    .select("id, title, type, price_cents, turnaround_days, revision_limit, creator_id, active")
    .eq("id", offeringId)
    .maybeSingle();
  if (!offering || !offering.active) notFound();

  const [
    { data: creator },
    { data: brandProducts },
    { data: activeDeal },
    pastDealCount,
    { data: brandProfile },
  ] = await Promise.all([
    supabase
      .from("creator_profiles")
      .select("handle")
      .eq("user_id", offering.creator_id)
      .maybeSingle(),
    supabase
      .from("brand_products")
      .select("name, description")
      .eq("brand_id", user!.id)
      .limit(3),
    supabase
      .from("deals")
      .select("id, status, offering_title")
      .eq("brand_id", user!.id)
      .eq("creator_id", offering.creator_id)
      .eq("offering_id", offering.id)
      .not("status", "in", '("completed","cancelled")')
      .limit(1)
      .maybeSingle(),
    supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", user!.id)
      .eq("creator_id", offering.creator_id),
    supabase
      .from("brand_profiles")
      .select("outreach_template")
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);
  const previousDeals = pastDealCount.count ?? 0;

  const productDefault = (brandProducts ?? [])
    .map((p) => [p.name, p.description].filter(Boolean).join(": "))
    .join("\n");

  return (
    <>
      <SiteNav role={role} userId={user.id} />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Book {offering.title}</h1>

        <div className="mt-4 rounded-xl border p-5">
          {creator && (
            <p className="text-sm text-muted-foreground">by @{creator.handle}</p>
          )}
          <p className="mt-2 text-3xl font-black tabular-nums text-primary">
            ${(offering.price_cents / 100).toFixed(0)}
          </p>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] text-primary">
                ✓
              </span>
              {offering.turnaround_days}-day delivery included
            </li>
            <li className="flex items-center gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] text-primary">
                ✓
              </span>
              {offering.revision_limit} revision{offering.revision_limit === 1 ? "" : "s"} included
            </li>
            <li className="flex items-center gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] text-primary">
                ✓
              </span>
              Direct creator communication
            </li>
            <li className="flex items-center gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] text-primary">
                ✓
              </span>
              Preview before publish
            </li>
          </ul>
        </div>

        <p className="mt-4 rounded-lg border border-amber bg-amber/15 px-4 py-3 text-sm">
          Payment is handled outside the platform for now. You and the creator agree on payment
          directly. The deal tracker keeps both sides honest.
        </p>
        {activeDeal && (
          <p className="mt-4 rounded-lg border border-amber bg-amber/15 px-4 py-3 text-sm">
            You already have an active deal for this offering ({activeDeal.offering_title} —{" "}
            <Link
              href={`/deals/${activeDeal.id}`}
              className="font-medium underline underline-offset-2"
            >
              view deal
            </Link>
            ). You can still book again if this is a separate project.
          </p>
        )}
        {!activeDeal && previousDeals > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            {previousDeals} previous deal{previousDeals !== 1 ? "s" : ""} with this creator.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <form action={createBooking} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="offering_id" value={offering.id} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goals">What does success look like?</Label>
            <CharCountTextarea
              id="goals"
              name="goals"
              rows={4}
              maxLength={2000}
              required
              placeholder="e.g., 50K views in 2 weeks, drive traffic to our landing page, increase brand awareness with Gen Z audience"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product_description">Product / service description</Label>
            <CharCountTextarea
              id="product_description"
              name="product_description"
              rows={3}
              maxLength={2000}
              defaultValue={productDefault}
              placeholder="e.g., Mobile app for meal planning, targets busy professionals aged 25-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="talking_points">Key talking points</Label>
            <CharCountTextarea
              id="talking_points"
              name="talking_points"
              rows={3}
              maxLength={2000}
              defaultValue={brandProfile?.outreach_template ?? ""}
              placeholder="e.g., Mention our free trial, show the app in use, include a call-to-action with our link"
            />
          </div>
          <BookingConfirmButton
            offeringTitle={offering.title}
            price={(offering.price_cents / 100).toFixed(0)}
            creatorHandle={creator?.handle ?? null}
          />
        </form>
      </main>
    </>
  );
}
