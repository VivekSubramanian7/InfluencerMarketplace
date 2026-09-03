import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  dedicated_video: "Dedicated video",
  integration: "Integration (60-90s)",
  short_form_post: "Short-form post",
  ugc_video: "UGC video (no posting)",
};

interface Offering {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  price_cents: number;
  turnaround_days?: number;
  revision_limit?: number;
  active?: boolean;
}

interface OfferingsPanelProps {
  offerings: Offering[];
  saveAction: (formData: FormData) => void;
  toggleAction?: (formData: FormData) => void;
  deleteAction?: (formData: FormData) => void;
  mode: "wizard" | "settings";
  continueHref?: string;
  error?: string;
  saved?: string;
}

export function OfferingsPanel({
  offerings,
  saveAction,
  toggleAction,
  deleteAction,
  mode,
  continueHref,
  error,
  saved,
}: OfferingsPanelProps) {
  return (
    <>
      {mode === "wizard" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Productize what brands can book: a clear title, a set price, a turnaround.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
          {mode === "wizard" ? "Offering added! Add another or continue." : "Saved."}
        </p>
      )}

      {mode === "settings" ? (
        <ul className="mt-6 mb-10 flex flex-col gap-3">
          {offerings.map((o) => (
            <li key={o.id} className="rounded-xl border p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-bold">{o.title}</span>
                <span className="font-extrabold tabular-nums text-primary">
                  ${(o.price_cents / 100).toFixed(2)}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                {TYPE_LABELS[o.type] ?? o.type} · {o.turnaround_days}d turnaround ·{" "}
                {o.revision_limit} revisions ·{" "}
                <Badge variant="secondary">{o.active ? "active" : "hidden"}</Badge>
              </p>
              <div className="mt-3 flex gap-2">
                {toggleAction && (
                  <form action={toggleAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="active" value={o.active ? "false" : "true"} />
                    <Button type="submit" variant="outline" size="sm">
                      {o.active ? "Hide" : "Activate"}
                    </Button>
                  </form>
                )}
                {deleteAction && (
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <ConfirmSubmitButton
                      label="Delete"
                      confirmLabel="Delete for good"
                      message="This removes the offering permanently."
                    />
                  </form>
                )}
              </div>
            </li>
          ))}
          {offerings.length === 0 && (
            <li className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No offerings yet. Add your first below.
            </li>
          )}
        </ul>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {offerings.map((o) => (
            <li key={o.id} className="flex items-baseline justify-between gap-4 rounded-xl border p-4">
              <span className="min-w-0 truncate">
                <span className="font-bold">{o.title}</span>{" "}
                <span className="text-sm text-muted-foreground">{TYPE_LABELS[o.type] ?? o.type}</span>
              </span>
              <span className="shrink-0 font-extrabold tabular-nums text-primary">
                ${(o.price_cents / 100).toFixed(2)}
              </span>
            </li>
          ))}
          {offerings.length === 0 && (
            <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No offerings yet. Add your first below.
            </li>
          )}
        </ul>
      )}

      <section className={mode === "wizard" ? "mt-6 rounded-xl border p-5" : "mt-0"}>
        <h2 className="font-bold">{mode === "settings" ? "Add an offering" : "Add an offering"}</h2>
        <form action={saveAction} className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              name="type"
              className="h-10 rounded-lg border bg-background px-3 text-sm"
              defaultValue="dedicated_video"
            >
              {Object.entries(TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              placeholder={mode === "wizard" ? "Honest product review video" : undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          {mode === "wizard" ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" name="price" inputMode="decimal" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="turnaround_days">Turnaround (days)</Label>
                <Input id="turnaround_days" name="turnaround_days" type="number" defaultValue={14} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="revision_limit">Revisions</Label>
                <Input id="revision_limit" name="revision_limit" type="number" defaultValue={1} />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" name="price" inputMode="decimal" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="turnaround_days">Turnaround (days)</Label>
                <Input id="turnaround_days" name="turnaround_days" type="number" defaultValue={14} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="revision_limit">Included revisions</Label>
                <Input id="revision_limit" name="revision_limit" type="number" defaultValue={1} />
              </div>
            </>
          )}
          {mode === "wizard" ? (
            <SubmitButton variant="outline" className="self-start" pendingLabel="Adding…">
              Add offering
            </SubmitButton>
          ) : (
            <Button type="submit" className="mt-2">
              Save offering
            </Button>
          )}
        </form>
      </section>

      {mode === "wizard" && continueHref && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
          <p className="text-sm text-muted-foreground">
            {offerings.length > 0
              ? `${offerings.length} ${offerings.length === 1 ? "offering" : "offerings"} added`
              : "Nothing added yet, you can do this later"}
          </p>
          <Button asChild>
            <Link href={continueHref}>Continue → Show your best work</Link>
          </Button>
        </div>
      )}
    </>
  );
}
