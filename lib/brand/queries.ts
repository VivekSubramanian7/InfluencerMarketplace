import { createPublicClient } from "@/lib/supabase/public";

export interface BrandProfile {
  userId: string;
  slug: string;
  company: string | null;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  displayName: string | null;
  reviews: Array<{ rating: number; body: string | null; createdAt: string }>;
  avgRating: number | null;
  ratingCount: number;
}

export async function getBrandProfile(slug: string): Promise<BrandProfile | null> {
  const supabase = createPublicClient();

  const { data: bp, error: bpError } = await supabase
    .from("brand_profiles")
    .select("user_id, slug, company, description, website, logo_url")
    .eq("slug", slug)
    .maybeSingle();
  if (bpError) throw new Error("brand profile query failed: " + bpError.message);
  if (!bp?.slug) return null;

  const [
    { data: prof, error: profError },
    { data: reviews, error: reviewsError },
    { data: allRatings, error: allRatingsError },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", bp.user_id).maybeSingle(),
    supabase
      .from("public_brand_reviews")
      .select("rating, body, created_at")
      .eq("brand_id", bp.user_id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("public_brand_reviews")
      .select("rating")
      .eq("brand_id", bp.user_id),
  ]);
  if (profError) throw new Error("brand profile query failed: " + profError.message);
  if (reviewsError) throw new Error("brand reviews query failed: " + reviewsError.message);
  if (allRatingsError) throw new Error("brand rating query failed: " + allRatingsError.message);

  return {
    userId: bp.user_id,
    slug: bp.slug,
    company: bp.company,
    description: bp.description,
    website: bp.website,
    logoUrl: bp.logo_url,
    displayName: prof?.display_name ?? null,
    reviews: (reviews ?? []).map((r) => ({
      rating: r.rating,
      body: r.body,
      createdAt: r.created_at,
    })),
    avgRating: (allRatings ?? []).length > 0
      ? Math.round(
          ((allRatings ?? []).reduce((sum, r) => sum + r.rating, 0) / (allRatings ?? []).length) * 10,
        ) / 10
      : null,
    ratingCount: (allRatings ?? []).length,
  };
}
