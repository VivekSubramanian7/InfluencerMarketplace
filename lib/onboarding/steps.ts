// Wizard progress is derived purely from what data exists — no tracking
// columns, so a creator who fills things in from the dashboard instead
// stops being routed back to steps they've effectively completed.

export const WIZARD_STEPS = ["profile", "socials", "offerings", "highlights", "publish"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export function isWizardStep(value: string): value is WizardStep {
  return (WIZARD_STEPS as readonly string[]).includes(value);
}

export interface OnboardingState {
  hasProfile: boolean;
  isLive: boolean;
  socialCount: number;
  offeringCount: number;
  portfolioCount: number;
}

export function nextIncompleteStep(s: OnboardingState): WizardStep | "done" {
  if (!s.hasProfile) return "profile";
  if (s.socialCount === 0) return "socials";
  if (s.offeringCount === 0) return "offerings";
  if (s.portfolioCount === 0) return "highlights";
  if (!s.isLive) return "publish";
  return "done";
}

export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}

export function previousStep(step: WizardStep): WizardStep | null {
  const i = stepIndex(step);
  return i <= 0 ? null : WIZARD_STEPS[i - 1];
}
