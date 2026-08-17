"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

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
  redirect(role === "creator" ? "/dashboard" : "/discover");
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
  redirect(profile?.role === "creator" ? "/dashboard" : "/discover");
}

export async function logout() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
