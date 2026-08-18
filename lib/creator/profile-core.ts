// Shared parse+upsert core for the creator profile form, used by both the
// dashboard profile action and the onboarding wizard's profile step so the
// two never drift. Callers own auth, revalidation, and redirects.

import { createServerSupabase } from "@/lib/supabase/server";
import { parseHandle, parseTags, parseOptionalText } from "@/lib/storefront/validation";

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

export type ProfileUpsertResult =
  | { ok: true; handle: string; previousHandle: string | null }
  | { ok: false; error: string };

export async function upsertCreatorProfileFromForm(
  supabase: Supabase,
  userId: string,
  formData: FormData
): Promise<ProfileUpsertResult> {
  const handle = parseHandle(String(formData.get("handle") ?? ""));
  if (!handle) return { ok: false, error: "Handle must be 3-30 chars: a-z, 0-9, _" };

  const bioResult = parseOptionalText(String(formData.get("bio") ?? ""), 1000);
  if (!bioResult.ok) return { ok: false, error: "Bio is too long (max 1000 characters)" };
  const countryResult = parseOptionalText(String(formData.get("country") ?? ""), 60);
  if (!countryResult.ok) return { ok: false, error: "Country is too long (max 60 characters)" };
  const niches = parseTags(String(formData.get("niches") ?? ""));
  const languages = parseTags(String(formData.get("languages") ?? ""), 5);

  const { data: existing } = await supabase
    .from("creator_profiles")
    .select("handle")
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase.from("creator_profiles").upsert({
    user_id: userId, handle, bio: bioResult.value, country: countryResult.value, niches, languages,
  });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "That handle is taken" : error.message };
  }

  return { ok: true, handle, previousHandle: existing?.handle ?? null };
}
