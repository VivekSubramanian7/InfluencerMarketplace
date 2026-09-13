"use client";
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

type Product = {
  name: string;
  url?: string;
  description?: string;
  target_age_min?: number;
  target_age_max?: number;
  target_gender?: string;
  target_location?: string;
};

function updateProduct(
  setProducts: Dispatch<SetStateAction<Product[]>>,
  i: number,
  patch: Partial<Product>
) {
  setProducts((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
}

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
          <li key={i} className="flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm">
            <div className="flex items-start justify-between gap-3">
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
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                min={13}
                max={100}
                placeholder="Age min"
                value={p.target_age_min ?? ""}
                onChange={(e) =>
                  updateProduct(setProducts, i, {
                    target_age_min: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="h-10 w-24 rounded-lg border bg-background px-3 text-sm"
                aria-label={`Minimum age for ${p.name}`}
              />
              <input
                type="number"
                min={13}
                max={100}
                placeholder="Age max"
                value={p.target_age_max ?? ""}
                onChange={(e) =>
                  updateProduct(setProducts, i, {
                    target_age_max: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="h-10 w-24 rounded-lg border bg-background px-3 text-sm"
                aria-label={`Maximum age for ${p.name}`}
              />
              <select
                value={p.target_gender ?? ""}
                onChange={(e) =>
                  updateProduct(setProducts, i, {
                    target_gender: e.target.value || undefined,
                  })
                }
                className="h-10 rounded-lg border bg-background px-3 text-sm"
                aria-label={`Target gender for ${p.name}`}
              >
                <option value="">Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="all">All</option>
              </select>
              <input
                type="text"
                placeholder="Location (optional)"
                maxLength={200}
                value={p.target_location ?? ""}
                onChange={(e) =>
                  updateProduct(setProducts, i, {
                    target_location: e.target.value || undefined,
                  })
                }
                className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm"
                aria-label={`Target location for ${p.name}`}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
