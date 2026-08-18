import Link from "next/link";
import { requireRole } from "@/lib/auth/require";

// Minimal chrome: no SiteNav — the wizard is a focused flow with one exit.
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("creator", "/onboarding");
  return (
    <>
      <nav className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-lg font-black tracking-tight">
            Clipline
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Dashboard
          </Link>
        </div>
      </nav>
      {children}
    </>
  );
}
