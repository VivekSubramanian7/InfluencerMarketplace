"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/require";

export async function signup(formData: FormData) {
  const supabase = await createServerSupabase();
  const role = formData.get("role") === "creator" ? "creator" : "brand";
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
    options: { data: { role, display_name: String(formData.get("display_name") ?? "") } },
  });
  if (error) redirect(`/auth/error?message=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect(role === "creator" ? "/onboarding" : "/discover");
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
  revalidatePath("/", "layout");
  let creatorHome = "/dashboard";
  if (profile?.role === "creator") {
    // no creator profile yet → resume onboarding
    const { data: cp } = await supabase
      .from("creator_profiles").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (!cp) creatorHome = "/onboarding";
  }
  const target = safeNext(String(formData.get("next") ?? "")) ??
    (profile?.role === "creator" ? creatorHome : profile?.role === "admin" ? "/admin" : "/discover");
  redirect(target);
}

export async function logout() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
