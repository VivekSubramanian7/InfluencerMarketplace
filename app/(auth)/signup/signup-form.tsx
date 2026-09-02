"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CREATOR_GOALS = [
  "Get booked by brands",
  "Monetize my content",
  "Build a storefront",
  "Grow my portfolio",
] as const;

const BRAND_GOALS = [
  "Find video creators",
  "Launch a campaign",
  "Get UGC content",
  "Scale influencer marketing",
] as const;

export function SignupForm({
  invite,
  signupAction,
}: {
  invite: string | null;
  signupAction: (formData: FormData) => void;
}) {
  const [step, setStep] = useState<"goals" | "credentials">("goals");
  const [role, setRole] = useState<"creator" | "brand">("creator");
  const [goals, setGoals] = useState<Set<string>>(new Set());

  const toggleGoal = (g: string) => {
    setGoals((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const options = role === "creator" ? CREATOR_GOALS : BRAND_GOALS;

  if (step === "goals") {
    return (
      <div className="rounded-2xl bg-card p-8 shadow-card">
        <h1 className="text-2xl font-extrabold tracking-tight">
          What brings you here?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick what matters — we&apos;ll tailor your setup.
        </p>

        {invite && (
          <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
            A brand invited you — sign up and your conversation opens
            automatically.
          </p>
        )}

        <div className="mt-6">
          <p className="text-sm font-medium">I am a…</p>
          <div className="mt-2 flex gap-2">
            {(["creator", "brand"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setGoals(new Set()); }}
                className={`flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                  role === r
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-secondary"
                }`}
              >
                {r === "creator" ? "Video creator" : "Brand"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {options.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGoal(g)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                goals.has(g)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full transition-colors ${
                  goals.has(g)
                    ? "bg-primary text-primary-foreground"
                    : "border-2 border-border"
                }`}
              >
                {goals.has(g) && <Check className="size-3" />}
              </span>
              {g}
            </button>
          ))}
        </div>

        <Button
          onClick={() => setStep("credentials")}
          className="mt-6 w-full"
        >
          Continue — set up my account
        </Button>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Takes under a minute. Free forever for creators.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card p-8 shadow-card">
      <button
        type="button"
        onClick={() => setStep("goals")}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
        Almost there
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Finish now — or lose your setup and start over.
      </p>

      <form action={signupAction} className="mt-6 flex flex-col gap-4">
        {invite && <input type="hidden" name="invite" value={invite} />}
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="goals" value={[...goals].join(",")} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="display_name">Display name</Label>
          <Input
            id="display_name"
            name="display_name"
            placeholder="Your name"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Min 8 characters"
            minLength={8}
            required
          />
        </div>
        <Button type="submit" className="mt-2">
          Create account
        </Button>
      </form>
    </div>
  );
}
