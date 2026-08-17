import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { saveCreatorProfile, setProfileStatus } from "./actions";
import { SiteNav } from "@/components/site-nav";

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
      <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold mb-2">Your creator profile</h1>
      {p && (
        <p className="mb-4 text-sm">
          Status: <span className="font-medium">{p.status}</span>
          {p.status === "live" && (
            <> — public at <a className="underline" href={`/c/${p.handle}`}>/c/{p.handle}</a></>
          )}
        </p>
      )}
      {error && <p className="mb-4 text-red-600">{error}</p>}
      {saved && <p className="mb-4 text-green-700">Saved.</p>}

      <form action={saveCreatorProfile} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Handle (your public URL: /c/…)</span>
          <input name="handle" defaultValue={p?.handle ?? ""} className="border rounded p-2" required />
        </label>
        <label className="flex flex-col gap-1">
          <span>Bio</span>
          <textarea name="bio" defaultValue={p?.bio ?? ""} rows={4} className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Niches (comma-separated, up to 8)</span>
          <input name="niches" defaultValue={(p?.niches ?? []).join(", ")} className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Country</span>
          <input name="country" defaultValue={p?.country ?? ""} className="border rounded p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span>Languages (comma-separated, up to 5)</span>
          <input name="languages" defaultValue={(p?.languages ?? []).join(", ")} className="border rounded p-2" />
        </label>
        <button className="bg-black text-white rounded p-2">Save profile</button>
      </form>

      {p && (
        <form action={setProfileStatus} className="mt-6">
          <input type="hidden" name="status" value={p.status === "live" ? "draft" : "live"} />
          <button className="border rounded p-2 w-full">
            {p.status === "live" ? "Unpublish (back to draft)" : "Publish storefront"}
          </button>
        </form>
      )}
      </main>
    </>
  );
}
