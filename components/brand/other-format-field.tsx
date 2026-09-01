"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export function OtherFormatField({ defaultValue }: { defaultValue: string }) {
  const [checked, setChecked] = useState(!!defaultValue);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="size-4 accent-primary"
        />
        Other
      </span>
      {checked && (
        <Input
          name="pref_types_other"
          maxLength={500}
          defaultValue={defaultValue}
          placeholder="e.g. podcast mentions, newsletter sponsorships…"
        />
      )}
    </label>
  );
}
