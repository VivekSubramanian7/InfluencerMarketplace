import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-8 py-20">
      <h1 className="text-4xl font-semibold leading-tight mb-4">
        Book sponsored videos from micro-influencers — without the DM chaos.
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        Creators list productized video offerings with transparent prices.
        Brands browse, book, and track delivery in one place. YouTube, TikTok,
        and Instagram Reels.
      </p>
      <div className="flex gap-4 mb-16">
        <Link href="/signup" className="bg-black text-white rounded px-5 py-3">
          Get started
        </Link>
        <Link href="/login" className="border rounded px-5 py-3">
          Log in
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <section className="border rounded p-6">
          <h2 className="font-medium mb-2">For creators</h2>
          <p className="text-sm text-gray-600">
            A storefront that makes you look professional: set your prices,
            show verified audience stats, and manage every deal in one pipeline.
            Free — you keep 100% of your rate.
          </p>
        </section>
        <section className="border rounded p-6">
          <h2 className="font-medium mb-2">For brands</h2>
          <p className="text-sm text-gray-600">
            Find vetted video creators by niche, audience, and budget. Book a
            slot, share your brief, and approve the result — no spreadsheets,
            no ghosting.
          </p>
        </section>
      </div>
    </main>
  );
}
