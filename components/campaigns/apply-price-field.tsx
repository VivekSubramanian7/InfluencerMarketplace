"use client";

import { useState } from "react";
import { budgetWarning } from "@/lib/campaigns/budget";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ApplyPriceField({
  budgetMaxCents,
  defaultValue,
}: {
  budgetMaxCents: number;
  defaultValue: string;
}) {
  const [warning, setWarning] = useState<string | null>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    const dollars = parseFloat(raw);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setWarning(null);
      return;
    }
    setWarning(budgetWarning(Math.round(dollars * 100), budgetMaxCents));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="proposed_price">Your price (USD)</Label>
      <Input
        id="proposed_price"
        name="proposed_price"
        inputMode="decimal"
        required
        defaultValue={defaultValue}
        onChange={onChange}
      />
      {warning ? (
        <p className="text-xs text-[var(--warn)]">{warning}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Suggested from the brand&rsquo;s budget — adjust to your rate.
        </p>
      )}
    </div>
  );
}
