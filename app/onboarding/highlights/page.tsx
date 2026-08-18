import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { addHighlight, removeHighlight } from "./actions";
import { detectPlatform } from "@/lib/portfolio/platform";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default async function OnboardingHighlightsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user } = await requireRole("creator", "/onboarding/highlights");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: profile } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (!profile) {
    redirect("/onboarding/profile?error=" + encodeURIComponent("Claim your handle first"));
  }

  const { data: items } = await supabase
    .from("portfolio_items")
    .select("id, media_url, caption")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <WizardShell step="highlights" skip={false}>
      <p className="mt-2 text-sm text-muted-foreground">
        Link the videos you&apos;re proudest of — they show as your recent work on the storefront.
      </p>
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
          Highlight added — add another or continue.
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-2">
        {(items ?? []).map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <span className="min-w-0">
              <Badge variant="secondary">{detectPlatform(item.media_url).label}</Badge>{" "}
              <span className="break-all text-sm">{item.caption || item.media_url}</span>
            </span>
            <form action={removeHighlight} className="shrink-0">
              <input type="hidden" name="id" value={item.id} />
              <Button type="submit" variant="outline" size="sm">
                Remove
              </Button>
            </form>
          </li>
        ))}
        {(items ?? []).length === 0 && (
          <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No highlights yet — paste your first video link below.
          </li>
        )}
      </ul>

      <section className="mt-6 rounded-xl border p-5">
        <h2 className="font-bold">Add a highlight</h2>
        <form action={addHighlight} className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="media_url">Video link</Label>
            <Input id="media_url" name="media_url" required placeholder="https://youtube.com/watch?v=…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="caption">Caption (optional)</Label>
            <Input id="caption" name="caption" placeholder="Taste-testing every flavor of…" />
          </div>
          <SubmitButton variant="outline" className="self-start" pendingLabel="Adding…">
            Add highlight
          </SubmitButton>
        </form>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
        <p className="text-sm text-muted-foreground">
          {(items ?? []).length > 0
            ? `${(items ?? []).length} ${(items ?? []).length === 1 ? "highlight" : "highlights"} added`
            : "Nothing added yet — you can do this later"}
        </p>
        <Button asChild>
          <Link href="/onboarding/publish">Continue → Go live</Link>
        </Button>
      </div>
    </WizardShell>
  );
}
