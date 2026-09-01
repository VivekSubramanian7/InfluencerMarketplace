"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseOptionalText, parseMediaUrl, parseTags, parseText } from "@/lib/storefront/validation";
import { OFFERING_TYPES, type OfferingType } from "@/lib/discovery/filters";
import { ingestWebsite } from "@/lib/brand/ingest";
import { friendlyDbError } from "@/lib/errors";

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

  const company = parseOptionalText(String(formData.get("company") ?? ""), 120);
  const description = parseOptionalText(String(formData.get("description") ?? ""), 2000);
  const notes = parseOptionalText(String(formData.get("notes") ?? ""), 4000);
  const template = parseOptionalText(String(formData.get("outreach_template") ?? ""), 2000);
  if (!company.ok || !description.ok || !notes.ok || !template.ok) {
    fail("One of the text fields is over its length limit");
  }

  const websiteRaw = String(formData.get("website") ?? "").trim();
  const website = websiteRaw ? parseMediaUrl(websiteRaw) : null;
  if (websiteRaw && !website) fail("Website must be a valid http(s) URL");

  const prefNiches = parseTags(String(formData.get("pref_niches") ?? ""), 8);
  const prefTypes = formData
    .getAll("pref_types")
    .map(String)
    .filter((t): t is OfferingType => (OFFERING_TYPES as readonly string[]).includes(t));
  const prefTypesOther = parseOptionalText(String(formData.get("pref_types_other") ?? ""), 500);

  const paths: { guidelines_path?: string; rules_path?: string } = {};
  for (const slot of ["guidelines", "rules"] as const) {
    const file = formData.get(slot);
    if (file instanceof File && file.size > 0) {
      const up = await uploadDoc(supabase, user.id, file, slot);
      if (!up.ok) fail(up.error);
      else paths[`${slot}_path`] = up.path;
    }
  }

  const { error } = await supabase.from("brand_profiles").upsert(
    {
      user_id: user.id,
      company: company.ok ? company.value : null,
      website,
      description: description.ok ? description.value : null,
      notes: notes.ok ? notes.value : null,
      outreach_template: template.ok ? template.value : null,
      pref_niches: prefNiches,
      pref_types: prefTypes,
      pref_types_other: prefTypesOther.ok ? prefTypesOther.value : null,
      ...paths,
    },
    { onConflict: "user_id" }
  );
  if (error) fail(friendlyDbError(error));

  // products proposed by website ingestion, confirmed by this save
  const productsJson = String(formData.get("products_json") ?? "");
  if (productsJson) {
    let proposed: { name?: string; url?: string; description?: string }[] = [];
    try {
      proposed = JSON.parse(productsJson);
    } catch {
      proposed = [];
    }
    const rows = (Array.isArray(proposed) ? proposed : [])
      .filter((p) => typeof p?.name === "string" && p.name.trim())
      .slice(0, 12)
      .map((p) => ({
        brand_id: user.id,
        name: p.name!.trim().slice(0, 120),
        url: p.url && /^https?:\/\//i.test(p.url) ? p.url.slice(0, 500) : null,
        description: p.description ? p.description.slice(0, 500) : null,
      }));
    if (rows.length > 0) await supabase.from("brand_products").insert(rows);
  }

  // proposal consumed — the saved form is now the source of truth
  await supabase.from("brand_ingestions").delete().eq("brand_id", user.id);

  revalidatePath("/brand");
  redirect(from === "onboarding" ? "/discover" : "/brand/settings?saved=1");
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
  if (!name || !description.ok || (urlRaw && !url)) {
    redirect("/brand/settings?error=" +
      encodeURIComponent("Product needs a name (≤120 chars); URL must be http(s)"));
  }
  const { error } = await supabase.from("brand_products").insert({
    brand_id: user.id,
    name,
    url,
    description: description.ok ? description.value : null,
  });
  if (error) {
    redirect("/brand/settings?error=" + encodeURIComponent(friendlyDbError(error)));
  }
  redirect("/brand/settings?saved=1");
}

export async function removeProduct(formData: FormData) {
  const { user } = await requireRole("brand");
  const supabase = await createServerSupabase();
  await supabase
    .from("brand_products")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
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
  const { error } = await supabase
    .from("brand_blocklist")
    .insert({ brand_id: user.id, creator_id: creatorId });
  if (error && error.code !== "23505") {
    redirect(`${back}?error=` + encodeURIComponent(friendlyDbError(error)));
  }
  revalidatePath("/brand");
  redirect("/brand?saved=1");
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
