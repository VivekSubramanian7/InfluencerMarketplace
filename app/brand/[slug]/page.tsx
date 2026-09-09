import { notFound } from "next/navigation";
import { getBrandProfile } from "@/lib/brand/queries";

export default async function BrandPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandProfile(slug);
  if (!brand) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          {brand.company ?? brand.displayName ?? "Brand"}
        </h1>
        {brand.description && (
          <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
            {brand.description}
          </p>
        )}
        {brand.website && (
          <a
            href={brand.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-medium underline underline-offset-2"
          >
            {brand.website.replace(/^https?:\/\//, "")}
          </a>
        )}
      </header>

      {brand.reviews.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold">
            Reviews from creators
            {brand.avgRating !== null && (
              <span className="ml-2">
                <span className="text-amber">★</span> {brand.avgRating}
              </span>
            )}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {brand.reviews.map((r, i) => (
              <li key={i} className="rounded-2xl bg-secondary p-5">
                <p aria-label={`${r.rating} out of 5 stars`} className="text-amber">
                  {"★".repeat(r.rating)}
                  <span className="text-border">{"★".repeat(5 - r.rating)}</span>
                </p>
                {r.body && <p className="mt-2 text-sm leading-relaxed">{r.body}</p>}
                <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                  {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
