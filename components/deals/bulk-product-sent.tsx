"use client";

import { useState } from "react";
import { bulkMarkProductSent } from "@/app/deals/bulk-actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type BarterDeal = {
  id: string;
  creator_id: string;
  offering_title: string;
  status: string;
};

export function BulkProductSent({
  deals,
  creatorLabel,
  returnTo = "/brand",
}: {
  deals: BarterDeal[];
  creatorLabel: (id: string) => string;
  returnTo?: string;
}) {
  const eligible = deals.filter(
    (d) => d.status === "accepted",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (eligible.length === 0) return null;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === eligible.length ? new Set() : new Set(eligible.map((d) => d.id)),
    );

  return (
    <section className="mt-6 rounded-[var(--radius-tile)] border border-[var(--border)] p-5">
      <h2 className="text-base font-bold">Barter — mark product sent</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Select accepted barter deals and mark products as shipped in bulk.
      </p>
      {eligible.length > 1 && (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.size === eligible.length}
            onChange={toggleAll}
            className="size-4 accent-primary"
          />
          Select all ({eligible.length})
        </label>
      )}
      <ul className="mt-3 flex flex-col gap-2">
        {eligible.map((d) => (
          <li key={d.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(d.id)}
              onChange={() => toggle(d.id)}
              className="size-4 accent-primary"
            />
            <span className="min-w-0 flex-1 truncate">
              {creatorLabel(d.creator_id)} · {d.offering_title}
            </span>
          </li>
        ))}
      </ul>
      {selected.size > 0 && (
        <form action={bulkMarkProductSent} className="mt-3">
          <input type="hidden" name="return_to" value={returnTo} />
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="deal_ids" value={id} />
          ))}
          <SubmitButton size="sm" pendingLabel="Sending…">
            Mark product sent ({selected.size})
          </SubmitButton>
        </form>
      )}
    </section>
  );
}
