import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { deleteOffering, saveOffering, toggleOffering } from "./actions";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video (no posting)",
};

export default async function OfferingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user, role } = await requireRole("creator", "/dashboard/offerings");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: offerings } = await supabase
    .from("offerings")
    .select("id, type, title, description, price_cents, turnaround_days, revision_limit, active")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Your offerings</h1>
        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && (
          <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
            Saved.
          </p>
        )}

        <ul className="mt-6 mb-10 flex flex-col gap-3">
          {(offerings ?? []).map((o) => (
            <li key={o.id} className="rounded-xl border p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-bold">{o.title}</span>
                <span className="font-extrabold tabular-nums text-primary">
                  ${(o.price_cents / 100).toFixed(2)}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                {TYPE_LABELS[o.type] ?? o.type} · {o.turnaround_days}d turnaround ·{" "}
                {o.revision_limit} revisions ·{" "}
                <Badge variant="secondary">{o.active ? "active" : "hidden"}</Badge>
              </p>
              <div className="mt-3 flex gap-2">
                <form action={toggleOffering}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="active" value={o.active ? "false" : "true"} />
                  <Button type="submit" variant="outline" size="sm">
                    {o.active ? "Hide" : "Activate"}
                  </Button>
                </form>
                <form action={deleteOffering}>
                  <input type="hidden" name="id" value={o.id} />
                  <ConfirmSubmitButton
                    label="Delete"
                    confirmLabel="Delete for good"
                    message="This removes the offering permanently."
                  />
                </form>
              </div>
            </li>
          ))}
          {(offerings ?? []).length === 0 && (
            <li className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No offerings yet. Add your first below.
            </li>
          )}
        </ul>

        <h2 className="text-lg font-bold">Add an offering</h2>
        <form action={saveOffering} className="mt-3 flex flex-col gap-4">
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
            <Input id="title" name="title" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="price">Price (USD)</Label>
            <Input id="price" name="price" inputMode="decimal" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="turnaround_days">Turnaround (days)</Label>
            <Input id="turnaround_days" name="turnaround_days" type="number" defaultValue={14} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="revision_limit">Included revisions</Label>
            <Input id="revision_limit" name="revision_limit" type="number" defaultValue={1} />
          </div>
          <Button type="submit" className="mt-2">
            Save offering
          </Button>
        </form>
      </main>
    </>
  );
}
