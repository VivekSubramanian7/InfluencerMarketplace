import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface ProfileFormProps {
  profile: {
    handle: string;
    bio: string | null;
    niches: string[] | null;
    country: string | null;
    languages: string[] | null;
    status: string;
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
          <Label htmlFor="handle">{mode === "wizard" ? "Handle" : "Handle (your public URL: /c/…)"}</Label>
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
          <Label htmlFor="niches">Niches (comma-separated, up to 8)</Label>
          <Input
            id="niches"
            name="niches"
            defaultValue={(p?.niches ?? []).join(", ")}
            placeholder={mode === "wizard" ? "food, lifestyle" : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" defaultValue={p?.country ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="languages">Languages (comma-separated, up to 5)</Label>
          <Input id="languages" name="languages" defaultValue={(p?.languages ?? []).join(", ")} />
        </div>
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
