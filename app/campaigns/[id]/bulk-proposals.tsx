"use client";

import { useState } from "react";
import Link from "next/link";
import { decideApplication, bulkDecideApplications } from "./actions";
import { inviteFromStorefront } from "@/app/c/[handle]/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const APPLICATION_LABELS: Record<string, string> = {
  pending: "Pending review",
  accepted: "Accepted",
  declined: "Declined",
};

type App = {
  id: string;
  creator_id: string;
  pitch: string;
  proposed_price_cents: number;
  status: string;
  deal_id: string | null;
  decline_reason: string | null;
};

export function BulkProposals({
  campaignId,
  applications,
  nameById,
  handleById,
  convByCreator,
  ratingByCreator = {},
  verifiedById = {},
  returnTo,
}: {
  campaignId: string;
  applications: App[];
  nameById: Record<string, string | null>;
  handleById: Record<string, string>;
  convByCreator: Record<string, string>;
  ratingByCreator?: Record<string, { avg: number; count: number }>;
  verifiedById?: Record<string, boolean>;
  returnTo?: string;
}) {
  const pending = applications.filter((a) => a.status === "pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === pending.length
        ? new Set()
        : new Set(pending.map((a) => a.id))
    );

  return (
    <div>
      {pending.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.size === pending.length && pending.length > 0}
              onChange={toggleAll}
              className="size-4 accent-primary"
            />
            Select all pending ({pending.length})
          </label>
          {selected.size > 0 && (
            <>
              <form action={bulkDecideApplications}>
                <input type="hidden" name="campaign_id" value={campaignId} />
                <input type="hidden" name="decision" value="accepted" />
                {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
                {[...selected].map((id) => (
                  <input key={id} type="hidden" name="application_ids" value={id} />
                ))}
                <Button type="submit" size="sm">
                  Accept {selected.size}
                </Button>
              </form>
              <details className="group">
                <summary className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>Decline {selected.size}</span>
                  </Button>
                </summary>
                <form action={bulkDecideApplications} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="campaign_id" value={campaignId} />
                  <input type="hidden" name="decision" value="declined" />
                  {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
                  {[...selected].map((id) => (
                    <input key={id} type="hidden" name="application_ids" value={id} />
                  ))}
                  <textarea
                    name="decline_reason"
                    maxLength={500}
                    rows={2}
                    placeholder="Shared feedback for all declined creators (optional)"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                  />
                  <Button type="submit" variant="outline" size="sm" className="self-start text-destructive border-destructive/40">
                    Confirm decline {selected.size}
                  </Button>
                </form>
              </details>
            </>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {applications.map((a) => {
          const handle = handleById[a.creator_id];
          const isPending = a.status === "pending";
          return (
            <li key={a.id} className="rounded-xl border p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 font-bold">
                  {isPending && pending.length > 1 && (
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                      className="size-4 accent-primary"
                    />
                  )}
                  {nameById[a.creator_id] || handle || "Creator"}
                  {verifiedById[a.creator_id] && (
                    <span
                      title="Verified creator"
                      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-foreground"
                    >
                      <span aria-hidden>✓</span> Verified
                    </span>
                  )}
                  {ratingByCreator[a.creator_id] && (
                    <span className="text-sm font-semibold">
                      <span className="text-amber">★</span>{" "}
                      {ratingByCreator[a.creator_id].avg}
                      <span className="ml-0.5 font-normal text-muted-foreground tabular-nums">
                        ({ratingByCreator[a.creator_id].count})
                      </span>
                    </span>
                  )}
                  {handle && (
                    <Link
                      href={`/c/${handle}`}
                      className="text-sm font-medium text-muted-foreground underline-offset-2 hover:underline"
                    >
                      @{handle}
                    </Link>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <Badge variant="secondary">{APPLICATION_LABELS[a.status] ?? a.status}</Badge>
                  <span className="font-extrabold tabular-nums text-primary">
                    ${(a.proposed_price_cents / 100).toFixed(2)}
                  </span>
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{a.pitch}</p>
              {a.status === "declined" && a.decline_reason && (
                <p className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
                  <span className="font-medium">Feedback:</span> {a.decline_reason}
                </p>
              )}
              {isPending && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={decideApplication}>
                    <input type="hidden" name="campaign_id" value={campaignId} />
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="decision" value="accepted" />
                    {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
                    <Button type="submit" size="sm">Accept</Button>
                  </form>
                  <details className="group">
                    <summary className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>Decline</span>
                      </Button>
                    </summary>
                    <form action={decideApplication} className="mt-2 flex flex-col gap-2">
                      <input type="hidden" name="campaign_id" value={campaignId} />
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="decision" value="declined" />
                      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}
                      <textarea
                        name="decline_reason"
                        maxLength={500}
                        rows={2}
                        placeholder="Brief feedback (optional)"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                      />
                      <Button type="submit" variant="outline" size="sm" className="self-start text-destructive border-destructive/40">
                        Confirm decline
                      </Button>
                    </form>
                  </details>
                  {convByCreator[a.creator_id] ? (
                    <Link
                      href={`/inbox/${convByCreator[a.creator_id]}`}
                      className="inline-flex h-8 items-center rounded-full border px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
                    >
                      Open conversation →
                    </Link>
                  ) : (
                    <form action={inviteFromStorefront}>
                      <input type="hidden" name="creator_id" value={a.creator_id} />
                      <input type="hidden" name="handle" value={handleById[a.creator_id] ?? ""} />
                      <input type="hidden" name="redirect_to" value={`/campaigns/${campaignId}`} />
                      <Button type="submit" variant="outline" size="sm">
                        Invite to chat
                      </Button>
                    </form>
                  )}
                </div>
              )}
              {a.status === "accepted" && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {a.deal_id ? (
                    <>
                      Accepted at their proposed price.{" "}
                      <Link href={`/deals/${a.deal_id}`} className="font-medium underline underline-offset-2">
                        open the deal
                      </Link>
                      .
                    </>
                  ) : (
                    "Accepted."
                  )}
                </p>
              )}
            </li>
          );
        })}
        {applications.length === 0 && (
          <li className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No applications yet.
          </li>
        )}
      </ul>
    </div>
  );
}
