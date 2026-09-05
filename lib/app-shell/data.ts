import { createServerSupabase } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/home";

export async function getAppShellData(userId: string, role: Role) {
  const supabase = await createServerSupabase();
  const [
    { count: unreadNotifications },
    { count: unreadInbox },
    { data: profile },
    brandProfileRes,
    creatorProfileRes,
    { data: authData },
  ] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", userId)
      .eq("status", "invited"),
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
    unreadInbox: unreadInbox ?? 0,
    unreadNotifications: unreadNotifications ?? 0,
    displayName: profile?.display_name ?? null,
    email: authData.user?.email ?? "",
    workspaceName,
    workspaceRole: role as "creator" | "brand" | "admin",
  };
}
