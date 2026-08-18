import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { saveCreatorProfile, setProfileStatus } from "./actions";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default async function CreatorProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { user, role } = await requireRole("creator", "/dashboard/profile");
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabase();
  const { data: p } = await supabase
    .from("creator_profiles")
    .select("handle, bio, niches, country, languages, status")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Your creator profile</h1>
        {p && (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            Status: <Badge variant="secondary">{p.status}</Badge>
            {p.status === "live" && (
              <>
                — public at{" "}
                <a className="text-primary underline" href={`/c/${p.handle}`}>
                  /c/{p.handle}
                </a>
              </>
            )}
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

        <form action={saveCreatorProfile} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="handle">Handle (your public URL: /c/…)</Label>
            <Input id="handle" name="handle" defaultValue={p?.handle ?? ""} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" defaultValue={p?.bio ?? ""} rows={4} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="niches">Niches (comma-separated, up to 8)</Label>
            <Input id="niches" name="niches" defaultValue={(p?.niches ?? []).join(", ")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="country">Country</Label>
            <Input id="country" name="country" defaultValue={p?.country ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="languages">Languages (comma-separated, up to 5)</Label>
            <Input id="languages" name="languages" defaultValue={(p?.languages ?? []).join(", ")} />
          </div>
          <Button type="submit" className="mt-2">
            Save profile
          </Button>
        </form>

        {p && (
          <form action={setProfileStatus} className="mt-6">
            <input type="hidden" name="status" value={p.status === "live" ? "draft" : "live"} />
            <Button type="submit" variant="outline" className="w-full">
              {p.status === "live" ? "Unpublish (back to draft)" : "Publish storefront"}
            </Button>
          </form>
        )}
      </main>
    </>
  );
}
