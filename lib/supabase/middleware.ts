import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (all) => {
          all.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          all.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  // Refreshes expired tokens like getUser(), but verifies the JWT locally
  // (WebCrypto + cached JWKS) when the project uses asymmetric signing keys —
  // no Auth-server round trip per request. Falls back to getUser() internally
  // on symmetric-key projects, so behavior is never worse than before.
  await supabase.auth.getClaims();
  return response;
}
