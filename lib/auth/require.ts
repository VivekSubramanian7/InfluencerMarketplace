import { cache } from "react";
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

// cache(): layouts, pages, and nested components share one lookup per request
// instead of re-running the token check + role query each time.
const getUserAndRole = cache(async () => {
  const supabase = await createServerSupabase();
  // getClaims verifies the JWT signature (locally on asymmetric-key projects,
  // via getUser on symmetric ones) — safe for authorization, without the
  // guaranteed per-request Auth-server round trip getUser() always pays.
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return { user: null as { id: string } | null, role: null as Role | null };
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", sub).single();
  return { user: { id: sub }, role: (profile?.role ?? null) as Role | null };
});

export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
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
