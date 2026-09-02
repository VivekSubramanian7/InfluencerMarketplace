import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-black tracking-tight">
            Clipline
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" className="text-muted-foreground">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <span className="font-bold text-foreground">Clipline</span>
          <nav className="flex gap-6">
            <Link className="transition-colors hover:text-foreground" href="/discover">Find creators</Link>
            <Link className="transition-colors hover:text-foreground" href="/legal/terms">Terms</Link>
            <Link className="transition-colors hover:text-foreground" href="/legal/privacy">Privacy</Link>
            <Link className="transition-colors hover:text-foreground" href="/legal/refunds">Refunds</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
