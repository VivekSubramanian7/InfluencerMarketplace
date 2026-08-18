import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOnboardingState } from "@/lib/onboarding/state";
import { publishStorefront } from "./actions";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { Button } from "@/components/ui/button";

export default async function OnboardingPublishPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user } = await requireRole("creator", "/onboarding/publish");
  const { error } = await searchParams;
  const supabase = await createServerSupabase();
  const state = await getOnboardingState(supabase, user.id);
  if (!state.hasProfile) {
    redirect("/onboarding/profile?error=" + encodeURIComponent("Claim your handle first"));
  }

  const checks = [
    { done: state.hasProfile, label: "Handle claimed", href: "/onboarding/profile" },
    { done: state.socialCount > 0, label: "Social accounts added", href: "/onboarding/socials" },
    { done: state.offeringCount > 0, label: "At least one offering", href: "/onboarding/offerings" },
    { done: state.portfolioCount > 0, label: "Video highlights linked", href: "/onboarding/highlights" },
  ];

  return (
    <WizardShell step="publish">
      <p className="mt-2 text-sm text-muted-foreground">
        Publishing makes your storefront public at /c/{state.handle}. You can
        unpublish anytime from your dashboard.
      </p>
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-2">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <span className={c.done ? "font-medium" : "text-muted-foreground"}>
              <span aria-hidden className="mr-2">{c.done ? "✓" : "○"}</span>
              {c.label}
            </span>
            {!c.done && (
              <Link href={c.href} className="text-sm font-medium underline underline-offset-2">
                Add now
              </Link>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center gap-4">
        <form action={publishStorefront}>
          <Button type="submit">
            {state.isLive ? "You're live — back to dashboard" : "Publish storefront"}
          </Button>
        </form>
        {state.handle && (
          <Link
            href={`/c/${state.handle}`}
            className="text-sm font-medium underline underline-offset-2"
          >
            Preview storefront
          </Link>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        You can publish with steps unfinished — an empty section just won&apos;t show yet.
      </p>
    </WizardShell>
  );
}
