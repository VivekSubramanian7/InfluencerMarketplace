import Link from "next/link";
import { CheckedIcon } from "@/components/ui/icons";
import { WIZARD_STEPS, WizardStep, stepIndex, previousStep } from "@/lib/onboarding/steps";

const STEP_LABELS: Record<WizardStep, string> = {
  profile: "Claim your handle",
  socials: "Add your socials",
  offerings: "What you offer",
  highlights: "Show your best work",
  publish: "Go live",
};

// Account creation is step 0 (already done), so the bar never starts at
// 0% — the goal gradient effect.  6 total steps = account + 5 wizard.
const TOTAL_STEPS = WIZARD_STEPS.length + 1;

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
  const prev = previousStep(step);
  const completedSteps = idx + 1; // +1 for account creation
  const pct = Math.round((completedSteps / TOTAL_STEPS) * 100);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between gap-4" aria-label="Onboarding progress">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Step {idx + 1} of {WIZARD_STEPS.length}</span>
            <span className="tabular-nums">{pct}% complete</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
      <ol className="mt-4 flex items-center gap-1" aria-label="Steps">
        {WIZARD_STEPS.map((s, i) => (
          <li key={s}>
            {i < idx ? (
              <Link
                href={`/onboarding/${s}`}
                title={STEP_LABELS[s]}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors"
              >
                <CheckedIcon size={12} aria-hidden />
                <span className="hidden sm:inline">{STEP_LABELS[s].split(" ").slice(0, 2).join(" ")}</span>
                <span className="sm:hidden">{i + 1}</span>
              </Link>
            ) : (
              <span
                title={STEP_LABELS[s]}
                aria-current={s === step ? "step" : undefined}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  i === idx
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <span className="hidden sm:inline">{STEP_LABELS[s].split(" ").slice(0, 2).join(" ")}</span>
                <span className="sm:hidden">{i + 1}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
      {prev && (
        <Link
          href={`/onboarding/${prev}`}
          className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Link>
      )}
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
