"use client";
import { useState } from "react";

type Product = { name: string; url?: string; description?: string };

export function ProposedProducts({ initial }: { initial: Product[] }) {
  const [products, setProducts] = useState(initial);

  if (products.length === 0) return null;

  const remove = (i: number) => setProducts((prev) => prev.filter((_, j) => j !== i));

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        Products found. Remove any you don&apos;t want, then save.
      </p>
      <input type="hidden" name="products_json" value={JSON.stringify(products)} />
      <ul className="flex flex-col gap-1.5">
        {products.map((p, i) => (
          <li key={i} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium">{p.name}</span>
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-xs text-muted-foreground underline underline-offset-2"
                >
                  link
                </a>
              )}
              {p.description && (
                <span className="block truncate text-xs text-muted-foreground">{p.description}</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${p.name}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
