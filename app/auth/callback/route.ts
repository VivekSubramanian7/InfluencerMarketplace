import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { identifyServerUser } from "@/lib/analytics";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      // Identify user with PostHog
      identifyServerUser(data.user.id, { role: profile?.role ?? "unknown" });

      let target = "/discover";
      if (profile?.role === "creator") {
        const { data: cp } = await supabase
          .from("creator_profiles")
          .select("user_id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        target = cp ? "/dashboard" : "/onboarding";
      }
      return NextResponse.redirect(`${origin}${target}`);
    }
  }
  return NextResponse.redirect(`${origin}/auth/error?message=Could+not+sign+in`);
}
