import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { NICHES, COUNTRIES, LANGUAGES } from "@/lib/constants";

interface ProfileFormProps {
  profile: {
    handle: string;
    bio: string | null;
    niches: string[] | null;
    country: string | null;
    languages: string[] | null;
    status: string;
    shipping_address: string | null;
    city: string | null;
    age: number | null;
    gender: string | null;
    interested_in_paid: boolean;
  } | null;
  action: (formData: FormData) => void;
  statusAction?: (formData: FormData) => void;
  mode: "wizard" | "settings";
  suggestedHandle?: string;
  error?: string;
  saved?: string;
}

export function ProfileForm({ profile, action, statusAction, mode, suggestedHandle, error, saved }: ProfileFormProps) {
  const p = profile;
  return (
    <>
      {mode === "settings" && p && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          Status: <Badge variant="secondary">{p.status}</Badge>
          {p.status === "live" && (
            <>
              , public at{" "}
              <a className="text-primary underline" href={`/c/${p.handle}`}>
                /c/{p.handle}
              </a>
            </>
          )}
        </p>
      )}
      {mode === "wizard" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Your handle becomes your public storefront URL. Brands will find you at /c/your-handle.
        </p>
      )}
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

      <form action={action} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="handle">
            {mode === "wizard" ? "Handle" : "Handle (your public URL: /c/…)"}{" "}
            <span aria-hidden className="text-[var(--destructive)]">*</span>
          </Label>
          {mode === "wizard" && (
            <p className="text-xs text-muted-foreground">
              This is your public URL: clipline.app/c/your-handle.
            </p>
          )}
          <Input
            id="handle"
            name="handle"
            defaultValue={p?.handle ?? suggestedHandle ?? ""}
            required
            placeholder={mode === "wizard" ? "e.g. caseyclips" : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            name="bio"
            defaultValue={p?.bio ?? ""}
            rows={4}
            placeholder={mode === "wizard" ? "What you make and who it's for." : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Niches (up to 8)</Label>
          <MultiSelect
            name="niches"
            options={NICHES}
            defaultValue={p?.niches ?? []}
            max={8}
            placeholder={mode === "wizard" ? "e.g. food, lifestyle" : "Select niches…"}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Country</Label>
          <select
            id="country"
            name="country"
            defaultValue={p?.country ?? ""}
            className="h-10 rounded-lg border bg-background px-3 text-sm"
          >
            <option value="">Select country…</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Languages (up to 5)</Label>
          <MultiSelect
            name="languages"
            options={LANGUAGES}
            defaultValue={p?.languages ?? []}
            max={5}
            placeholder="Select languages…"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shipping_address">Shipping address</Label>
          <Textarea
            id="shipping_address"
            name="shipping_address"
            rows={2}
            defaultValue={p?.shipping_address ?? ""}
            placeholder="Required for barter campaigns"
          />
          <p className="text-xs text-muted-foreground">Required if you accept barter deals.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={p?.city ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="age">Age</Label>
            <Input id="age" name="age" type="number" min={13} max={120} defaultValue={p?.age ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gender">Gender</Label>
            <select
              id="gender"
              name="gender"
              defaultValue={p?.gender ?? ""}
              className="h-10 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-binary</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="interested_in_paid"
            defaultChecked={p?.interested_in_paid ?? false}
            className="size-4 accent-primary"
          />
          Interested in paid campaigns
        </label>
        {mode === "wizard" ? (
          <SubmitButton className="mt-2 self-start" pendingLabel="Saving…">
            Save and continue
          </SubmitButton>
        ) : (
          <Button type="submit" className="mt-2">
            Save profile
          </Button>
        )}
      </form>

      {mode === "settings" && p && statusAction && (
        <form action={statusAction} className="mt-6">
          <input type="hidden" name="status" value={p.status === "live" ? "draft" : "live"} />
          <Button type="submit" variant="outline" className="w-full">
            {p.status === "live" ? "Unpublish (back to draft)" : "Publish storefront"}
          </Button>
        </form>
      )}
    </>
  );
}
