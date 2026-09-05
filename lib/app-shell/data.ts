import { createServerSupabase } from "@/lib/supabase/server";
import { getUnreadFlags } from "@/lib/feature-cursors";
import type { Role } from "@/lib/auth/home";

export async function getAppShellData(userId: string, role: Role) {
  const supabase = await createServerSupabase();
  const [
    unreadFlags,
    { data: profile },
    brandProfileRes,
    creatorProfileRes,
    { data: authData },
  ] = await Promise.all([
    role === "admin"
      ? Promise.resolve({ inbox: false, deals: false, campaigns: false })
      : getUnreadFlags(userId, role),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    role === "brand"
      ? supabase.from("brand_profiles").select("company").eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null as { company: string } | null }),
    role === "creator"
      ? supabase.from("creator_profiles").select("handle").eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null as { handle: string } | null }),
    supabase.auth.getUser(),
  ]);

  const brandProfile = brandProfileRes.data;
  const creatorProfile = creatorProfileRes.data;

  const workspaceName =
    role === "brand"
      ? brandProfile?.company ?? profile?.display_name ?? "Your brand"
      : role === "creator"
        ? profile?.display_name ??
          (creatorProfile?.handle ? `@${creatorProfile.handle}` : "Your studio")
        : "Admin";

  return {
    role,
    userId,
    unreadInbox: unreadFlags.inbox,
    unreadDeals: unreadFlags.deals,
    unreadCampaigns: unreadFlags.campaigns,
    displayName: profile?.display_name ?? null,
    email: authData.user?.email ?? "",
    workspaceName,
    workspaceRole: role as "creator" | "brand" | "admin",
  };
}
