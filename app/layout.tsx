import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { PostHogProvider } from "@/components/posthog-provider";
import "./globals.css";

// Import the cached helper — does not redirect, just returns null if no user
async function getUser() {
  try {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    if (!sub) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", sub)
      .single();
    return { id: sub, role: profile?.role ?? null };
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  title: "Clipline | Book video creators",
  description:
    "Book sponsored videos from vetted micro-influencers on YouTube, TikTok, and Instagram.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();

  return (
    <html lang="en" className="h-full scroll-smooth antialiased font-sans">
      <link
        rel="stylesheet"
        precedence="default"
        href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap"
      />
      <body className="min-h-full flex flex-col">
        <PostHogProvider userId={user?.id} userRole={user?.role}>
          {children}
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  );
}
