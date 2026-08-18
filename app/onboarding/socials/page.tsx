import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { addSocialAccount, removeSocialAccount } from "./actions";
import { SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS, SocialPlatform } from "@/lib/social/types";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default async function OnboardingSocialsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; added?: string }>;
}) {
  const { user } = await requireRole("creator", "/onboarding/socials");
  const { error, added } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: profile } = await supabase
    .from("creator_profiles").select("handle").eq("user_id", user.id).maybeSingle();
  if (!profile) {
    redirect("/onboarding/profile?error=" + encodeURIComponent("Claim your handle first"));
  }

  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("id, platform, platform_handle, follower_count, verification_status")
    .eq("creator_id", user.id)
    .order("platform");

  const existingByPlatform = new Map(
    (accounts ?? []).map((a) => [a.platform as SocialPlatform, a.platform_handle as string])
  );

  return (
    <WizardShell step="socials" skip={false}>
      <p className="mt-2 text-sm text-muted-foreground">
        Add the accounts where you post. We&apos;ll pull your public follower counts
        automatically so brands see real numbers on your storefront.
      </p>
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {added && (
        <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
          {SOCIAL_PLATFORM_LABELS[added as SocialPlatform] ?? added} added — stats are syncing.
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-2">
        {(accounts ?? []).map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <span className="min-w-0">
              <span className="font-bold">
                {SOCIAL_PLATFORM_LABELS[a.platform as SocialPlatform] ?? a.platform}
              </span>{" "}
              <span className="text-muted-foreground">@{a.platform_handle}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              {a.follower_count !== null ? (
                <span className="text-sm font-bold tabular-nums">
                  {Intl.NumberFormat("en", { notation: "compact" }).format(a.follower_count)}{" "}
                  <span className="font-medium text-muted-foreground">followers</span>
                </span>
              ) : (
                <Badge variant="secondary">
                  {a.verification_status === "failed" ? "stats unavailable" : "syncing"}
                </Badge>
              )}
              <form action={removeSocialAccount}>
                <input type="hidden" name="id" value={a.id} />
                <Button type="submit" variant="outline" size="sm">
                  Remove
                </Button>
              </form>
            </span>
          </li>
        ))}
        {(accounts ?? []).length === 0 && (
          <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No socials yet — add your first below.
          </li>
        )}
      </ul>

      <section className="mt-6 rounded-xl border p-5">
        <h2 className="font-bold">Add a social account</h2>
        <form action={addSocialAccount} className="mt-3 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,180px)_1fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="platform">Platform</Label>
              <select
                id="platform"
                name="platform"
                className="h-10 rounded-lg border bg-background px-3 text-sm"
                defaultValue={SOCIAL_PLATFORMS.find((p) => !existingByPlatform.has(p)) ?? "youtube"}
              >
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {SOCIAL_PLATFORM_LABELS[p]}
                    {existingByPlatform.has(p) ? ` — replaces @${existingByPlatform.get(p)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="handle">Handle or profile link</Label>
              <Input id="handle" name="handle" required placeholder="@yourname or https://…" />
            </div>
          </div>
          <SubmitButton variant="outline" className="self-start" pendingLabel="Adding & syncing stats…">
            Add account
          </SubmitButton>
        </form>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
        <p className="text-sm text-muted-foreground">
          {(accounts ?? []).length > 0
            ? `${(accounts ?? []).length} ${(accounts ?? []).length === 1 ? "account" : "accounts"} added`
            : "Nothing added yet — you can do this later"}
        </p>
        <Button asChild>
          <Link href="/onboarding/offerings">Continue → What you offer</Link>
        </Button>
      </div>
    </WizardShell>
  );
}
