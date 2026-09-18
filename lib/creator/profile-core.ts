// Shared parse+upsert core for the creator profile form, used by both the
// dashboard profile action and the onboarding wizard's profile step so the
// two never drift. Callers own auth, revalidation, and redirects.

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { NICHES, COUNTRIES, LANGUAGES } from "@/lib/constants";

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

const nichesSet = new Set<string>(NICHES);
const countriesSet = new Set(COUNTRIES);
const languagesSet = new Set(LANGUAGES);

const profileSchema = z.object({
  handle: z.string().trim().toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, "Handle must be 3-30 chars: a-z, 0-9, _"),
  bio: z.string().trim().max(1000, "Bio is too long (max 1000 characters)")
    .transform((v) => v || null),
  niches: z.array(z.string())
    .transform((arr) => [...new Set(arr.filter((v) => nichesSet.has(v)))].slice(0, 8)),
  country: z.string().trim()
    .transform((v) => v || null)
    .refine((v) => v === null || countriesSet.has(v), "Invalid country"),
  languages: z.array(z.string())
    .transform((arr) => [...new Set(arr.filter((v) => languagesSet.has(v)))].slice(0, 5)),
  shipping_address: z.string().trim().max(500, "Shipping address is too long (max 500 characters)")
    .transform((v) => v || null),
  city: z.string().trim().max(100, "City is too long (max 100 characters)")
    .transform((v) => v || null),
  gender: z.string().trim().max(30)
    .transform((v) => v || null),
  age: z.string().trim().transform((v, ctx) => {
    if (!v) return null;
    const n = parseInt(v, 10);
    if (Number.isNaN(n) || n < 13 || n > 120) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Age must be between 13 and 120" });
      return z.NEVER;
    }
    return n;
  }),
  interested_in_paid: z.boolean(),
});

export type ProfileUpsertResult =
  | { ok: true; handle: string; previousHandle: string | null }
  | { ok: false; error: string };

export async function upsertCreatorProfileFromForm(
  supabase: Supabase,
  userId: string,
  formData: FormData
): Promise<ProfileUpsertResult> {
  const parsed = profileSchema.safeParse({
    handle: String(formData.get("handle") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    niches: formData.getAll("niches").map(String),
    country: String(formData.get("country") ?? ""),
    languages: formData.getAll("languages").map(String),
    shipping_address: String(formData.get("shipping_address") ?? ""),
    city: String(formData.get("city") ?? ""),
    gender: String(formData.get("gender") ?? ""),
    age: String(formData.get("age") ?? ""),
    interested_in_paid: formData.get("interested_in_paid") === "on",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const { handle, bio, niches, country, languages, shipping_address, city, gender, age, interested_in_paid } = parsed.data;

  const { data: existing } = await supabase
    .from("creator_profiles")
    .select("handle")
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase.from("creator_profiles").upsert({
    user_id: userId, handle, bio, country, niches, languages,
    shipping_address, city, gender, age, interested_in_paid,
  });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "That handle is taken" : error.message };
  }

  return { ok: true, handle, previousHandle: existing?.handle ?? null };
}
