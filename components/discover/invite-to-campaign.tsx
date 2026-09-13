"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { inviteToCampaign } from "@/app/campaigns/[id]/invite-actions";
import { CAMPAIGN_INVITE_CTA } from "@/lib/copy/taxonomy";
import { Button } from "@/components/ui/button";

type Campaign = { id: string; title: string };

export function InviteToCampaign({
  campaigns,
  creatorId,
  redirectTo,
  className,
  size = "sm",
  variant = "default",
  iconOnly = false,
  buttonClassName,
  buttonStyle,
}: {
  campaigns: Campaign[];
  creatorId: string;
  redirectTo?: string;
  className?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline";
  iconOnly?: boolean;
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  if (campaigns.length === 0) {
    return (
      <Button asChild size={size} variant="outline" className={className}>
        <Link href="/campaigns">Create campaign</Link>
      </Button>
    );
  }

  if (campaigns.length === 1) {
    return (
      <form action={inviteToCampaign} className={className}>
        <input type="hidden" name="campaign_id" value={campaigns[0].id} />
        <input type="hidden" name="creator_id" value={creatorId} />
        {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}
        {iconOnly ? (
          <button
            type="submit"
            aria-label={CAMPAIGN_INVITE_CTA}
            className="grid size-8 place-items-center rounded-full bg-white/90 shadow-card text-muted-foreground transition-all hover:scale-110 hover:bg-primary hover:text-primary-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        ) : buttonClassName ? (
          <button type="submit" className={buttonClassName} style={buttonStyle}>{CAMPAIGN_INVITE_CTA}</button>
        ) : (
          <Button type="submit" size={size} variant={variant}>{CAMPAIGN_INVITE_CTA}</Button>
        )}
      </form>
    );
  }

  return (
    <div ref={menuRef} className={`relative ${className ?? ""}`}>
      {iconOnly ? (
        <button
          type="button"
          aria-label={CAMPAIGN_INVITE_CTA}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="grid size-8 place-items-center rounded-full bg-white/90 shadow-card text-muted-foreground transition-all hover:scale-110 hover:bg-primary hover:text-primary-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      ) : buttonClassName ? (
        <button type="button" className={buttonClassName} style={buttonStyle} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {CAMPAIGN_INVITE_CTA}
        </button>
      ) : (
        <Button type="button" size={size} variant={variant} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {CAMPAIGN_INVITE_CTA}
        </Button>
      )}
      {open && (
        <ul
          role="menu"
          className="absolute z-20 mt-1 min-w-[12rem] rounded-lg border border-[var(--border)] bg-background py-1 shadow-lg text-foreground"
        >
          {campaigns.map((c) => (
            <li key={c.id} role="none">
              <form action={inviteToCampaign} role="menuitem">
                <input type="hidden" name="campaign_id" value={c.id} />
                <input type="hidden" name="creator_id" value={creatorId} />
                {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}
                <button
                  type="submit"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  {c.title}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BulkInviteToCampaign({
  campaigns,
  formId,
}: {
  campaigns: Campaign[];
  formId: string;
}) {
  if (campaigns.length === 0) {
    return (
      <Button asChild size="sm" className="shrink-0">
        <Link href="/campaigns">Create campaign</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {campaigns.length > 1 && (
        <select
          name="campaign_id"
          form={formId}
          required
          aria-label="Campaign to invite to"
          className="h-8 rounded-lg border bg-background px-2 text-sm"
          defaultValue=""
        >
          <option value="" disabled>Select campaign</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      )}
      {campaigns.length === 1 && (
        <input type="hidden" name="campaign_id" value={campaigns[0].id} form={formId} />
      )}
      <Button type="submit" form={formId} size="sm" className="shrink-0">
        {CAMPAIGN_INVITE_CTA}
      </Button>
    </div>
  );
}
