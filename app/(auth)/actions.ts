"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/require";
import { trackServerEvent, identifyServerUser } from "@/lib/analytics";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function signup(formData: FormData) {
  const supabase = await createServerSupabase();
  const role = formData.get("role") === "creator" ? "creator" : "brand";
  // Preserve the goals the user picked pre-signup so the effort isn't discarded
  // (IKEA effect) — stored on the auth user so onboarding can tailor to them.
  const goals = String(formData.get("goals") ?? "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, 8);
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
    options: {
      data: {
        role,
        display_name: String(formData.get("display_name") ?? ""),
        goals,
      },
    },
  });
  if (error) redirect(`/auth/error?message=${encodeURIComponent(error.message)}`);

  // creator arrived through a brand's invite link → open their conversation
  const invite = String(formData.get("invite") ?? "");
  if (role === "creator" && UUID_RE.test(invite)) {
    await supabase.rpc("claim_creator_invite", { p_token: invite });
  }

  // Track signup completion
  const { data } = await supabase.auth.getUser();
  if (data.user?.id) {
    trackServerEvent("signup_completed", data.user.id, {
      role,
      method: "email",
    });
  }

  revalidatePath("/", "layout");
  redirect(role === "creator" ? "/onboarding" : "/brand/onboarding");
}

export async function login(formData: FormData) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) redirect(`/auth/error?message=${encodeURIComponent(error.message)}`);
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", data.user.id).single();

  // Identify user with PostHog
  identifyServerUser(data.user.id, { role: profile?.role ?? "unknown" });

  revalidatePath("/", "layout");
  let creatorHome = "/dashboard";
  if (profile?.role === "creator") {
    // no creator profile yet → resume onboarding
    const { data: cp } = await supabase
      .from("creator_profiles").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (!cp) creatorHome = "/onboarding";
  }
  let brandHome = "/brand";
  if (profile?.role === "brand") {
    // never onboarded → the brand form first
    const { data: bp } = await supabase
      .from("brand_profiles").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (!bp) brandHome = "/brand/onboarding";
  }
  const target = safeNext(String(formData.get("next") ?? "")) ??
    (profile?.role === "creator" ? creatorHome : profile?.role === "admin" ? "/admin" : brandHome);
  redirect(target);
}

export async function logout() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createServerSupabase();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/forgot?error=" + encodeURIComponent("Enter the email on your account"));
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset`,
  });
  if (error) redirect("/forgot?error=" + encodeURIComponent(error.message));
  redirect("/forgot?sent=1");
}

export async function updatePassword(formData: FormData) {
  const supabase = await createServerSupabase();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    redirect("/reset?error=" + encodeURIComponent("Use at least 8 characters"));
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset?error=" + encodeURIComponent(error.message));
  redirect("/login");
}
