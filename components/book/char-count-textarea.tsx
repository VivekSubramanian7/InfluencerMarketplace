"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

export function CharCountTextarea({
  id,
  name,
  rows,
  maxLength,
  defaultValue,
  placeholder,
  required,
}: {
  id: string;
  name: string;
  rows: number;
  maxLength: number;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [length, setLength] = useState(defaultValue?.length ?? 0);

  return (
    <div>
      <Textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={maxLength}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        onChange={(e) => setLength(e.target.value.length)}
      />
      <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
        {length} / {maxLength}
      </p>
    </div>
  );
}
