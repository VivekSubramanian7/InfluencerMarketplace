import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

type Role = "creator" | "brand" | "admin";

export function gateDecision(
  user: { id: string } | null,
  actualRole: Role | null,
  requiredRole: Role | null
): { ok: true } | { redirect: string } {
  if (!user) return { redirect: "/login" };
  if (requiredRole && actualRole !== requiredRole) return { redirect: "/" };
  return { ok: true };
}

async function getUserAndRole() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { user: null, role: null as Role | null };
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", data.user.id).single();
  return { user: data.user, role: (profile?.role ?? null) as Role | null };
}

export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

export async function requireUser(currentPath?: string) {
  const { user, role } = await getUserAndRole();
  const d = gateDecision(user, role, null);
  if ("redirect" in d) {
    redirect(d.redirect === "/login" && currentPath
      ? `/login?next=${encodeURIComponent(currentPath)}`
      : d.redirect);
  }
  if (!role) redirect("/");
  return { user: user!, role };
}

export async function requireRole(required: Role, currentPath?: string) {
  const { user, role } = await getUserAndRole();
  const d = gateDecision(user, role, required);
  if ("redirect" in d) {
    redirect(d.redirect === "/login" && currentPath
      ? `/login?next=${encodeURIComponent(currentPath)}`
      : d.redirect);
  }
  return { user: user!, role: role! };
}
