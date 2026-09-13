// Shared parse+upsert core for the creator profile form, used by both the
// dashboard profile action and the onboarding wizard's profile step so the
// two never drift. Callers own auth, revalidation, and redirects.

import { createServerSupabase } from "@/lib/supabase/server";
import { parseHandle, parseTags, parseOptionalText, parseIntInRange } from "@/lib/storefront/validation";

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

  const addressResult = parseOptionalText(String(formData.get("shipping_address") ?? ""), 500);
  if (!addressResult.ok) return { ok: false, error: "Shipping address is too long (max 500 characters)" };
  const cityResult = parseOptionalText(String(formData.get("city") ?? ""), 100);
  if (!cityResult.ok) return { ok: false, error: "City is too long (max 100 characters)" };
  const genderResult = parseOptionalText(String(formData.get("gender") ?? ""), 30);
  if (!genderResult.ok) return { ok: false, error: "Gender is too long (max 30 characters)" };
  const ageRaw = String(formData.get("age") ?? "").trim();
  const age = ageRaw ? parseIntInRange(ageRaw, 13, 120) : null;
  if (ageRaw && age === null) return { ok: false, error: "Age must be between 13 and 120" };
  const interestedInPaid = formData.get("interested_in_paid") === "on";

  const { data: existing } = await supabase
    .from("creator_profiles")
    .select("handle")
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase.from("creator_profiles").upsert({
    user_id: userId, handle, bio: bioResult.value, country: countryResult.value, niches, languages,
    shipping_address: addressResult.value, city: cityResult.value, gender: genderResult.value,
    age, interested_in_paid: interestedInPaid,
  });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "That handle is taken" : error.message };
  }

  return { ok: true, handle, previousHandle: existing?.handle ?? null };
}
