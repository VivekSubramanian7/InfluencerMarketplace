import Link from "next/link";
import { headers } from "next/headers";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { addProduct, createInvite, removeProduct } from "../actions";
import { BrandProfileForm } from "@/components/brand/brand-profile-form";
import { WebsiteIngest } from "@/components/brand/website-ingest";
import type { IngestProposal } from "@/lib/brand/ingest";
import { SiteNav } from "@/components/site-nav";
import { CopyInviteMessage } from "@/components/brand/copy-invite-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_TEMPLATE =
  "Hi! We came across your work and think you'd be a great fit for our brand. " +
  "We'd love to collaborate on a video.";

export default async function BrandSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user, role } = await requireRole("brand", "/brand/settings");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();

  const [{ data: profile }, { data: products }, { data: invites }, { data: ingestion }] = await Promise.all([
    supabase
      .from("brand_profiles")
      .select("company, website, description, notes, outreach_template, pref_niches, pref_types, pref_types_other, guidelines_path, rules_path")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("brand_products")
      .select("id, name, url, description")
      .eq("brand_id", user.id)
      .order("created_at"),
    supabase
      .from("creator_invites")
      .select("id, contact, token, status, created_at")
      .eq("brand_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("brand_ingestions")
      .select("website, payload")
      .eq("brand_id", user.id)
      .maybeSingle(),
  ]);

  const proposal = (ingestion?.payload as IngestProposal | undefined) ?? null;
  const existingNames = new Set((products ?? []).map((p) => p.name.toLowerCase()));
  const proposedProducts = (proposal?.products ?? []).filter(
    (p) => !existingNames.has(p.name.toLowerCase())
  );

  const host = (await headers()).get("host") ?? "clipline.app";
  const origin = (host.startsWith("localhost") ? "http://" : "https://") + host;
  const template = profile?.outreach_template || DEFAULT_TEMPLATE;

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link href="/brand" className="text-sm text-muted-foreground hover:text-foreground">
          ← Brand home
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Brand settings</h1>

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && (
          <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
            Saved.
          </p>
        )}

        <div className="mt-6 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Read from your website</h2>
          <div className="mt-2">
            <WebsiteIngest
              from="settings"
              website={ingestion?.website ?? profile?.website ?? null}
              proposal={proposal}
            />
          </div>
        </div>

        <div className="mt-6">
          <BrandProfileForm
            defaults={
              profile
                ? {
                    ...profile,
                    // proposal always wins when present — user just re-scraped
                    company: proposal?.company || profile.company,
                    website: ingestion?.website ?? profile.website,
                    description: proposal?.description || profile.description || null,
                    pref_niches: proposal?.niches.length
                      ? proposal.niches
                      : (profile.pref_niches ?? []),
                    pref_types: profile.pref_types ?? [],
                  }
                : proposal
                  ? {
                      company: proposal.company || null,
                      website: ingestion?.website ?? null,
                      description: proposal.description || null,
                      notes: proposal.tone ? `Tone of voice: ${proposal.tone}` : null,
                      outreach_template: null,
                      pref_niches: proposal.niches,
                      pref_types: [],
                      pref_types_other: null,
                      guidelines_path: null,
                      rules_path: null,
                    }
                  : null
            }
            from="settings"
            productsJson={proposedProducts.length > 0 ? JSON.stringify(proposedProducts) : null}
          />
        </div>

        <section className="mt-12">
          <h2 className="text-lg font-bold">Products</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The products creators will feature. Added manually for now — website
            extraction will propose these automatically later.
          </p>
          {(products ?? []).length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {(products ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 rounded-xl border p-4">
                  <span className="min-w-0">
                    <span className="font-medium">{p.name}</span>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-sm text-muted-foreground underline underline-offset-2"
                      >
                        link
                      </a>
                    )}
                    {p.description && (
                      <span className="block truncate text-sm text-muted-foreground">{p.description}</span>
                    )}
                  </span>
                  <form action={removeProduct}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button type="submit" variant="outline" size="sm">Remove</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addProduct} className="mt-4 flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="product-name">Product name</Label>
              <Input id="product-name" name="name" required maxLength={120} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="product-url">Product URL (optional)</Label>
              <Input id="product-url" name="url" type="url" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="product-description">Short description (optional)</Label>
              <Input id="product-description" name="description" maxLength={500} />
            </div>
            <Button type="submit" size="sm" className="self-start">Add product</Button>
          </form>
        </section>

        <section id="invites" className="mt-12">
          <h2 className="text-lg font-bold">Invite influencers who aren&apos;t on Clipline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We generate a personal join link. Send it however you already talk
            to them — when they sign up through it, a conversation with you
            opens automatically.
          </p>
          <form action={createInvite} className="mt-3 flex gap-2">
            <Input
              name="contact"
              required
              maxLength={200}
              placeholder="Their handle or email (for your records)"
              aria-label="Who is this invite for?"
              className="flex-1"
            />
            <Button type="submit">Create invite</Button>
          </form>
          {(invites ?? []).length > 0 && (
            <ul className="mt-4 flex flex-col gap-3">
              {(invites ?? []).map((i) => (
                <li key={i.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{i.contact}</span>
                    <Badge variant="secondary">
                      {i.status === "claimed" ? "Joined" : "Waiting"}
                    </Badge>
                  </div>
                  {i.status === "pending" && (
                    <CopyInviteMessage
                      text={`${template}\n\nJoin me on Clipline: ${origin}/signup?invite=${i.token}`}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
