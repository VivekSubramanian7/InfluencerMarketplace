"use client";
import { useState } from "react";

export function CopyInviteMessage({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="mt-2 rounded-lg bg-secondary/60 p-3">
      <p className="whitespace-pre-wrap break-words text-sm">{text}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Copy this message and send it to them.</p>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md border bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-secondary"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
