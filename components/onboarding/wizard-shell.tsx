import Link from "next/link";
import { WIZARD_STEPS, WizardStep, stepIndex } from "@/lib/onboarding/steps";

const STEP_LABELS: Record<WizardStep, string> = {
  profile: "Claim your handle",
  socials: "Add your socials",
  offerings: "What you offer",
  highlights: "Show your best work",
  publish: "Go live",
};

// Shared frame for every wizard step: progress dots, title, and the
// per-step skip link. Skips advance to the next step; the last step and
// the profile step (which everything else depends on) skip to /dashboard.
export function WizardShell({
  step,
  children,
}: {
  step: WizardStep;
  children: React.ReactNode;
}) {
  const idx = stepIndex(step);
  const next = WIZARD_STEPS[idx + 1];
  const skipHref = step === "profile" || !next ? "/dashboard" : `/onboarding/${next}`;
  const skipLabel = step === "profile" || !next ? "Do this later → Dashboard" : "Skip for now";

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <ol className="flex items-center gap-2" aria-label="Onboarding progress">
        {WIZARD_STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={s === step ? "step" : undefined}
            title={STEP_LABELS[s]}
            className={
              "h-2.5 rounded-full transition-all " +
              (i < idx
                ? "w-2.5 bg-primary"
                : i === idx
                  ? "w-8 bg-primary"
                  : "w-2.5 bg-border")
            }
          />
        ))}
        <li className="ml-2 text-xs font-medium text-muted-foreground">
          Step {idx + 1} of {WIZARD_STEPS.length}
        </li>
      </ol>
      <div className="mt-6 flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">{STEP_LABELS[step]}</h1>
        <Link
          href={skipHref}
          className="shrink-0 text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {skipLabel}
        </Link>
      </div>
      {children}
    </main>
  );
}
