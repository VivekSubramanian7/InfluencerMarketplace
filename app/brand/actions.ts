"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseOptionalText, parseMediaUrl, parseTags, parseText, parseIntInRange } from "@/lib/storefront/validation";
import { OFFERING_TYPES, type OfferingType } from "@/lib/discovery/filters";
import { ingestWebsite } from "@/lib/brand/ingest";
import { friendlyDbError } from "@/lib/errors";
import { NICHES } from "@/lib/constants";

const nichesSet = new Set<string>(NICHES);

const brandProfileSchema = z.object({
  company: z.string().trim().min(1, "Company name is required").max(120, "Company name is too long (max 120 chars)"),
  website: z.string().trim().transform((v) => v || null)
    .refine((v) => {
      if (v === null) return true;
      try { const u = new URL(v); return u.protocol === "http:" || u.protocol === "https:"; }
      catch { return false; }
    }, "Website must be a valid http(s) URL"),
  description: z.string().trim().max(2000, "Description is too long").transform((v) => v || null),
  notes: z.string().trim().max(4000, "Notes are too long").transform((v) => v || null),
  outreach_template: z.string().trim().max(2000, "Template is too long").transform((v) => v || null),
  pref_niches: z.array(z.string())
    .transform((arr) => [...new Set(arr.filter((v) => nichesSet.has(v)))].slice(0, 8)),
  pref_types: z.array(z.string())
    .transform((arr) => arr.filter((t): t is OfferingType => (OFFERING_TYPES as readonly string[]).includes(t))),
  pref_types_other: z.string().trim().max(500).transform((v) => v || null),
});

const DOC_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const DOC_MAX_BYTES = 10 * 1024 * 1024;

async function uploadDoc(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  file: File,
  slot: "guidelines" | "rules"
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!DOC_MIME_TYPES.has(file.type)) {
    return { ok: false, error: "Documents must be PDF, Word, or plain text" };
  }
  if (file.size > DOC_MAX_BYTES) {
    return { ok: false, error: "Documents are limited to 10 MB" };
  }
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  // ponytail: fixed slot path + upsert; switching extensions strands the old
  // object — add cleanup if doc churn ever matters.
  const path = `${userId}/${slot}${ext}`;
  const { error } = await supabase.storage
    .from("brand-docs")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { ok: false, error: "Upload failed: " + error.message };
  return { ok: true, path };
}

export async function saveBrandProfile(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const from = formData.get("from") === "onboarding" ? "onboarding" : "settings";
  const errorPath = from === "onboarding" ? "/brand/onboarding" : "/brand/settings";
  const fail = (msg: string): never =>
    redirect(`${errorPath}?error=` + encodeURIComponent(msg));

  const parsed = brandProfileSchema.safeParse({
    company: String(formData.get("company") ?? ""),
    website: String(formData.get("website") ?? ""),
    description: String(formData.get("description") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    outreach_template: String(formData.get("outreach_template") ?? ""),
    pref_niches: formData.getAll("pref_niches").map(String),
    pref_types: formData.getAll("pref_types").map(String),
    pref_types_other: String(formData.get("pref_types_other") ?? ""),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0].message);
  }
  const { company: companyName, website, description, notes, outreach_template: template,
    pref_niches: prefNiches, pref_types: prefTypes, pref_types_other: prefTypesOther } = parsed.data;

  const { data: uniqueSlug } = await supabase.rpc("generate_unique_brand_slug", {
    p_company: companyName,
    p_exclude_brand_id: user.id,
  });

  const gscRaw = String(formData.get("gsc_property") ?? "").trim();
  const gscProperty = gscRaw ? parseMediaUrl(gscRaw) : null;
  if (gscRaw && !gscProperty) fail("Search Console URL must be a valid http(s) URL");

  const paths: { guidelines_path?: string; rules_path?: string } = {};
  for (const slot of ["guidelines", "rules"] as const) {
    const file = formData.get(slot);
    if (file instanceof File && file.size > 0) {
      const up = await uploadDoc(supabase, user.id, file, slot);
      if (!up.ok) fail(up.error);
      else paths[`${slot}_path`] = up.path;
    }
  }

  // products proposed by website ingestion, confirmed by this save
  const productsJson = String(formData.get("products_json") ?? "");
  let products: {
    name: string;
    url: string | null;
    description: string | null;
    target_age_min: number | null;
    target_age_max: number | null;
    target_gender: string | null;
    target_location: string | null;
  }[] = [];
  if (productsJson) {
    let proposed: {
      name?: string;
      url?: string;
      description?: string;
      target_age_min?: unknown;
      target_age_max?: unknown;
      target_gender?: unknown;
      target_location?: unknown;
    }[] = [];
    try {
      proposed = JSON.parse(productsJson);
    } catch {
      proposed = [];
    }
    products = (Array.isArray(proposed) ? proposed : [])
      .filter((p) => typeof p?.name === "string" && p.name.trim())
      .slice(0, 12)
      .map((p) => ({
        name: p.name!.trim().slice(0, 120),
        url: p.url && /^https?:\/\//i.test(p.url) ? p.url.slice(0, 500) : null,
        description: p.description ? p.description.slice(0, 500) : null,
        target_age_min:
          typeof p.target_age_min === "number" && p.target_age_min >= 13 && p.target_age_min <= 100
            ? p.target_age_min
            : null,
        target_age_max:
          typeof p.target_age_max === "number" && p.target_age_max >= 13 && p.target_age_max <= 100
            ? p.target_age_max
            : null,
        target_gender:
          ["male", "female", "all"].includes(p.target_gender as string)
            ? (p.target_gender as string)
            : null,
        target_location:
          typeof p.target_location === "string" && p.target_location.trim()
            ? p.target_location.trim().slice(0, 200)
            : null,
      }));
  }

  // Atomic: upsert profile + insert products + delete ingestion in one transaction
  const { error } = await supabase.rpc("save_brand_profile", {
    p_company: companyName,
    p_slug: uniqueSlug ?? null,
    p_website: website,
    p_description: description,
    p_notes: notes,
    p_outreach_template: template,
    p_pref_niches: prefNiches,
    p_pref_types: prefTypes,
    p_pref_types_other: prefTypesOther,
    p_gsc_property: gscProperty,
    p_guidelines_path: paths.guidelines_path ?? null,
    p_rules_path: paths.rules_path ?? null,
    p_products: products.length > 0 ? JSON.stringify(products) : "[]",
  });
  if (error) fail(friendlyDbError(error));

  revalidatePath("/brand");
  redirect(from === "onboarding" ? "/campaigns?first=1" : "/brand/settings?saved=1");
}

export async function readWebsite(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const from = formData.get("from") === "onboarding" ? "onboarding" : "settings";
  const back = from === "onboarding" ? "/brand/onboarding" : "/brand/settings";

  const url = parseMediaUrl(String(formData.get("website") ?? ""));
  if (!url) {
    redirect(`${back}?error=` + encodeURIComponent("Enter a valid http(s) website URL first"));
  }

  let payload;
  try {
    payload = await ingestWebsite(url);
  } catch (err) {
    redirect(`${back}?error=` + encodeURIComponent(
      err instanceof Error ? err.message : "We couldn't read that site — fill the form in manually"));
  }

  const { error } = await supabase
    .from("brand_ingestions")
    .upsert({ brand_id: user.id, website: url, payload }, { onConflict: "brand_id" });
  if (error) redirect(`${back}?error=` + encodeURIComponent(friendlyDbError(error)));

  redirect(`${back}?proposal=1`);
}

export async function addProduct(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const name = parseText(String(formData.get("name") ?? ""), 120);
  const description = parseOptionalText(String(formData.get("description") ?? ""), 500);
  const urlRaw = String(formData.get("url") ?? "").trim();
  const url = urlRaw ? parseMediaUrl(urlRaw) : null;

  const ageMinRaw = String(formData.get("target_age_min") ?? "").trim();
  const ageMin = ageMinRaw ? parseIntInRange(ageMinRaw, 13, 100) : null;
  const ageMaxRaw = String(formData.get("target_age_max") ?? "").trim();
  const ageMax = ageMaxRaw ? parseIntInRange(ageMaxRaw, 13, 100) : null;
  const targetGender = String(formData.get("target_gender") ?? "").trim() || null;
  const targetLocationResult = parseOptionalText(String(formData.get("target_location") ?? ""), 200);

  if (ageMin !== null && ageMax !== null && ageMin > ageMax) {
    redirect("/brand/settings?error=" + encodeURIComponent("Age range minimum must be less than maximum"));
  }

  if (!name || !description.ok || (urlRaw && !url)) {
    redirect("/brand/settings?error=" +
      encodeURIComponent("Product needs a name (≤120 chars); URL must be http(s)"));
  }
  const { error } = await supabase.from("brand_products").insert({
    brand_id: user.id,
    name,
    url,
    description: description.ok ? description.value : null,
    target_age_min: ageMin,
    target_age_max: ageMax,
    target_gender: targetGender && ["male", "female", "all"].includes(targetGender) ? targetGender : null,
    target_location: targetLocationResult.ok ? targetLocationResult.value : null,
  });
  if (error) {
    redirect("/brand/settings?error=" + encodeURIComponent(friendlyDbError(error)));
  }
  redirect("/brand/settings?saved=1");
}

export async function removeProduct(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const productId = String(formData.get("id") ?? "");

  const { count } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("status", "open");
  if (count && count > 0) {
    redirect("/brand/settings?error=" +
      encodeURIComponent("This product is used by an active campaign — close or edit the campaign first"));
  }

  await supabase
    .from("brand_products")
    .delete()
    .eq("id", productId)
    .eq("brand_id", user.id);
  redirect("/brand/settings?saved=1");
}

export async function createInvite(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const contact = parseText(String(formData.get("contact") ?? ""), 200);
  if (!contact) {
    redirect("/brand/settings?error=" +
      encodeURIComponent("Who is the invite for? A handle or email, up to 200 characters"));
  }
  const { error } = await supabase
    .from("creator_invites")
    .insert({ brand_id: user.id, contact });
  if (error) {
    redirect("/brand/settings?error=" + encodeURIComponent(friendlyDbError(error)));
  }
  redirect("/brand/settings?saved=1#invites");
}

export async function blockCreator(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  const creatorId = String(formData.get("creator_id") ?? "");
  const back = String(formData.get("back") ?? "/brand");

  const { count: activeDeals } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("brand_id", user.id)
    .not("status", "in", "(completed,cancelled)");

  const { error } = await supabase
    .from("brand_blocklist")
    .insert({ brand_id: user.id, creator_id: creatorId });
  if (error && error.code !== "23505") {
    redirect(`${back}?error=` + encodeURIComponent(friendlyDbError(error)));
  }
  revalidatePath("/brand");
  if (activeDeals && activeDeals > 0) {
    redirect("/brand/settings?blocklisted=1&warning=" + encodeURIComponent("This creator has active deals — they will continue until completed"));
  }
  redirect("/brand/settings?blocklisted=1");
}

export async function unblockCreator(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  await supabase
    .from("brand_blocklist")
    .delete()
    .eq("brand_id", user.id)
    .eq("creator_id", String(formData.get("creator_id") ?? ""));
  revalidatePath("/brand");
  redirect("/brand?saved=1");
}
