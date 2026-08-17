import { createClient } from "@supabase/supabase-js";

// Cookie-free anon client for PUBLIC read paths (storefront, discovery).
// Never use in authenticated flows — it has no user session, and importing
// the cookie-bound server client would force these pages dynamic.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
