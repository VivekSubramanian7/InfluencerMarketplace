import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* Product-in-action panel: a stylized deal pipeline on the deep band —
   trust machinery made visible (the brand story), no fake creator stats. */
function DealPanel() {
  return (
    <div className="relative w-full max-w-md rounded-2xl bg-band p-6 text-band-foreground shadow-2xl">
      <p className="mb-4 text-sm font-semibold text-band-foreground/70">
        Deal · 60s vertical feature
      </p>
      <ol className="space-y-3">
        {[
          { label: "Booked with brief", done: true },
          { label: "Creator accepted", done: true },
          { label: "Preview submitted", done: true },
          { label: "Published — awaiting approval", done: false },
        ].map((step) => (
          <li key={step.label} className="flex items-center gap-3">
            <span
              aria-hidden
              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                step.done
                  ? "bg-ok text-white"
                  : "border-2 border-amber text-amber"
              }`}
            >
              {step.done ? "✓" : "•"}
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
      <div className="mt-5 rounded-lg bg-white/10 p-3 text-sm">
        <p className="font-semibold">Auto-approve in 3 days</p>
        <p className="text-band-foreground/70">
          Ghosting isn&rsquo;t possible — timers keep both sides honest.
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-2xl font-extrabold tabular-nums">$150.00</span>
        <Badge className="bg-amber text-amber-foreground hover:bg-amber">
          1 revision included
        </Badge>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-xl font-black tracking-tight">
          Clipline
        </span>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero: copy left, deal machinery right */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-24">
          <div>
            <h1 className="text-[clamp(2.4rem,6vw,4.2rem)] font-black leading-[1.05] tracking-[-0.03em]">
              Book video creators.
              <br />
              <span className="text-muted-foreground">Skip the DM chaos.</span>
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
              Creators list real offerings at real prices. Brands book with a
              brief and track every deal from accepted to published — with
              anti-ghosting timers and reviews on both sides.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="px-7 text-base">
                <Link href="/signup">Get started free</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="px-7 text-base">
                <Link href="/c/mayafilms">See a live storefront</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Free for creators — you keep 100% of your rate.
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <DealPanel />
          </div>
        </section>

        {/* Two audiences, one deal machine */}
        <section className="border-y bg-secondary/60">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold">For creators</h2>
              <p className="mt-3 max-w-[48ch] leading-relaxed text-muted-foreground">
                A storefront that makes you look like a business, not a DM.
                Set your formats and prices once; every booking arrives with a
                structured brief, a deadline, and a revision cap you chose.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  "Productized offerings — dedicated videos, integrations, UGC",
                  "A deal pipeline instead of spreadsheet archaeology",
                  "Reviews that compound into your public rating",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <span aria-hidden className="mt-0.5 font-bold text-primary">→</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-2xl font-bold">For brands</h2>
              <p className="mt-3 max-w-[48ch] leading-relaxed text-muted-foreground">
                Find vetted video creators by niche, country, format, and
                budget. Book in two minutes with a brief the creator can
                actually execute — then watch the deal move, step by step.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  "Transparent pricing on every storefront",
                  "Preview before publish, revisions built in",
                  "Anti-ghosting timers on every deal",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <span aria-hidden className="mt-0.5 font-bold text-primary">→</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* How a deal runs — the real sequence, numbered because it IS one */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <h2 className="text-3xl font-bold">How a deal runs</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Book", "Pick an offering, send a brief. The price is the price."],
              ["Create", "The creator accepts, produces, and submits a preview link."],
              ["Approve", "Request changes within the revision cap, or approve the live post."],
              ["Review", "Both sides rate the collab. Ratings build the public record."],
            ].map(([title, body], i) => (
              <div key={title}>
                <span className="text-4xl font-extrabold tabular-nums text-primary/30">
                  {i + 1}
                </span>
                <h3 className="mt-2 text-lg font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing band — the drench moment */}
        <section className="bg-primary">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-6 py-16 md:flex-row md:items-center md:justify-between">
            <h2 className="max-w-[24ch] text-3xl font-extrabold text-primary-foreground">
              Your next collab shouldn&rsquo;t live in your DMs.
            </h2>
            <Button
              asChild
              size="lg"
              className="bg-white px-8 text-base text-primary hover:bg-white/90"
            >
              <Link href="/signup">Create your account</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
        <span className="font-bold text-foreground">Clipline</span>
        <div className="flex gap-6">
          <Link className="hover:text-foreground" href="/discover">
            Find creators
          </Link>
          <Link className="hover:text-foreground" href="/signup">
            Become a creator
          </Link>
          <Link className="hover:text-foreground" href="/login">
            Log in
          </Link>
        </div>
      </footer>
    </>
  );
}
