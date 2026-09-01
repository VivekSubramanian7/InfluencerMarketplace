import "server-only";
import { createClient } from "@supabase/supabase-js";

// The ONLY service-role client in the codebase. Bypasses RLS — restrict
// usage to the social stats sync path, lib/notify (notifications have no
// authenticated insert grant), and the cron routes; wizard/server actions
// must keep using the cookie-scoped client from ./server.
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
