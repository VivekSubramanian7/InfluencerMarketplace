import Link from "next/link";
import { WIZARD_STEPS, WizardStep, stepIndex } from "@/lib/onboarding/steps";

const STEP_LABELS: Record<WizardStep, string> = {
  profile: "Claim your handle",
  socials: "Add your socials",
  offerings: "What you offer",
  highlights: "Show your best work",
  publish: "Go live",
};

// Shared frame for every wizard step: progress dots, title, and (for
// steps whose primary button is NOT the advance — profile, publish) a
// header escape link to the dashboard. List+add steps pass skip={false}:
// their footer Continue pill is the single advancing action.
export function WizardShell({
  step,
  skip = true,
  children,
}: {
  step: WizardStep;
  skip?: boolean;
  children: React.ReactNode;
}) {
  const idx = stepIndex(step);

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
        {skip && (
          <Link
            href="/dashboard"
            className="shrink-0 text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Do this later → Dashboard
          </Link>
        )}
      </div>
      {children}
    </main>
  );
}
