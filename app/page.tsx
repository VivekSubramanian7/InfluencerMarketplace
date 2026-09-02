import Link from "next/link";
import {
  ArrowRightIcon,
  CheckedIcon,
  ClockIcon,
  StarIcon,
  LockIcon,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function DealPanel() {
  const steps = [
    { label: "Booked with brief", done: true },
    { label: "Creator accepted", done: true },
    { label: "Preview submitted", done: true },
    { label: "Published, awaiting approval", done: false },
  ];
  return (
    <div className="relative w-full max-w-md rounded-3xl bg-band p-7 text-band-foreground shadow-2xl ring-1 ring-white/10">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-semibold text-band-foreground/70">
          Deal · 60s vertical feature
        </p>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
          <ClockIcon size={12} aria-hidden />
          3d auto-approve
        </span>
      </div>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center gap-3">
            <span
              aria-hidden
              className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-all ${
                step.done
                  ? "bg-ok text-white shadow-[0_0_8px_rgba(46,125,79,0.3)]"
                  : "border-2 border-amber text-amber"
              }`}
            >
              {step.done ? <CheckedIcon size={14} /> : i + 1}
            </span>
            <span
              className={
                step.done ? "text-band-foreground" : "font-semibold text-amber"
              }
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 rounded-xl bg-white/[0.07] p-4 text-sm backdrop-blur-sm">
        <p className="font-semibold">Auto-approve in 3 days</p>
        <p className="mt-0.5 text-band-foreground/70">
          Ghosting isn&rsquo;t possible. Timers keep both sides honest.
        </p>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-3xl font-black tabular-nums tracking-tight">$150</span>
        <Badge className="bg-amber text-amber-foreground hover:bg-amber">
          1 revision included
        </Badge>
      </div>
    </div>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white px-4 py-2 text-sm font-medium shadow-card">
      <span className="text-muted-foreground" aria-hidden>{icon}</span>
      {label}
    </span>
  );
}

export default function LandingPage() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-xl font-black tracking-tight">
          Clipline
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link href="/discover">Discover</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="hero-orb -right-20 top-10 hidden md:block" aria-hidden />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[1.15fr_0.85fr] md:py-28">
            <div>
              <div className="mb-6 flex flex-wrap gap-2">
                <TrustBadge icon={<LockIcon size={16} />} label="Anti-ghosting timers" />
                <TrustBadge icon={<StarIcon size={16} />} label="Mutual reviews" />
              </div>
              <h1 className="text-[clamp(2.6rem,6.5vw,4.5rem)] font-black leading-[1.02] tracking-[-0.035em]">
                Book video creators.
                <br />
                <span className="text-muted-foreground">
                  Skip the DM chaos.
                </span>
              </h1>
              <p className="mt-7 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
                Creators list real offerings at real prices. Brands book with a
                brief and track every deal from accepted to published, with
                anti-ghosting timers and reviews on both sides.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg" className="gap-2 px-7 text-base">
                  <Link href="/signup">
                    Get started free
                    <ArrowRightIcon size={16} />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="px-7 text-base">
                  <Link href="/c/mayafilms">See a live storefront</Link>
                </Button>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                Free for creators. You keep 100% of your rate.
              </p>
            </div>
            <div className="relative flex justify-center md:justify-end">
              <DealPanel />
            </div>
          </div>
        </section>

        <div className="section-divider mx-auto max-w-6xl" aria-hidden />

        {/* Two audiences */}
        <section className="bg-secondary/40">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:gap-16">
            {[
              {
                title: "For creators",
                desc: "A storefront that makes you look like a business, not a DM. Set your formats and prices once; every booking arrives with a structured brief, a deadline, and a revision cap you chose.",
                points: [
                  "Productized offerings: dedicated videos, integrations, UGC",
                  "A deal pipeline instead of spreadsheet archaeology",
                  "Reviews that compound into your public rating",
                ],
              },
              {
                title: "For brands",
                desc: "Find vetted video creators by niche, country, format, and budget. Book in two minutes with a brief the creator can actually execute, then watch the deal move step by step.",
                points: [
                  "Transparent pricing on every storefront",
                  "Preview before publish, revisions built in",
                  "Anti-ghosting timers on every deal",
                ],
              },
            ].map(({ title, desc, points }) => (
              <div key={title} className="rounded-3xl bg-card p-8 shadow-card">
                <h2 className="text-2xl font-bold">{title}</h2>
                <p className="mt-3 max-w-[48ch] leading-relaxed text-muted-foreground">
                  {desc}
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {points.map((t) => (
                    <li key={t} className="flex gap-3">
                      <span
                        aria-hidden
                        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                      >
                        <CheckedIcon size={12} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* How a deal runs */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
          <div className="text-center">
            <h2 className="text-3xl font-bold md:text-4xl">How a deal runs</h2>
            <p className="mx-auto mt-3 max-w-[48ch] text-muted-foreground">
              Four steps, fully tracked. No side-channel chaos.
            </p>
          </div>
          <div className="card-grid mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Book", "Pick an offering, send a brief. The price is the price."],
              ["Create", "The creator accepts, produces, and submits a preview link."],
              ["Approve", "Request changes within the revision cap, or approve the live post."],
              ["Review", "Both sides rate the collab. Ratings build the public record."],
            ].map(([title, body], i) => (
              <div
                key={title}
                className="rounded-2xl border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground tabular-nums">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="section-divider mx-auto max-w-6xl" aria-hidden />

        {/* Closing band */}
        <section className="bg-primary">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-6 py-20 text-center md:py-24">
            <h2 className="max-w-[28ch] text-3xl font-black text-primary-foreground md:text-4xl">
              Every day without a storefront is a deal lost.
            </h2>
            <p className="max-w-[44ch] text-primary-foreground/70">
              Creators who wait lose bookings to those who don&rsquo;t.
              Brands miss vetted creators while scrolling DMs.
            </p>
            <Button
              asChild
              size="lg"
              className="gap-2 bg-white px-8 text-base text-primary hover:bg-white/90"
            >
              <Link href="/signup">
                Don&rsquo;t miss out, sign up free
                <ArrowRightIcon size={16} />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <span className="font-bold text-foreground">Clipline</span>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <Link className="transition-colors hover:text-foreground" href="/discover">
              Find creators
            </Link>
            <Link className="transition-colors hover:text-foreground" href="/signup">
              Become a creator
            </Link>
            <Link className="transition-colors hover:text-foreground" href="/login">
              Log in
            </Link>
            <Link className="transition-colors hover:text-foreground" href="/legal/terms">
              Terms
            </Link>
            <Link className="transition-colors hover:text-foreground" href="/legal/privacy">
              Privacy
            </Link>
            <Link className="transition-colors hover:text-foreground" href="/legal/refunds">
              Refunds
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
