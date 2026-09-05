import Link from "next/link";
import { updatePassword } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-svh">
      <div className="hidden w-2/5 bg-primary md:block" aria-hidden>
        <div className="flex h-full flex-col justify-between p-10 text-primary-foreground">
          <Link href="/" className="text-xl font-black tracking-tight">
            Clipline
          </Link>
          <div>
            <p className="max-w-[28ch] text-2xl font-bold leading-tight">
              The marketplace where creators look like businesses.
            </p>
            <p className="mt-3 text-sm text-primary-foreground/60">
              Real offerings, real prices, real reviews.
            </p>
          </div>
          <p className="text-xs text-primary-foreground/40">
            © {new Date().getFullYear()} Clipline
          </p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 block text-center text-xl font-black tracking-tight text-primary md:hidden"
          >
            Clipline
          </Link>
          <div className="rounded-2xl bg-card p-8 shadow-card">
            <h1 className="text-2xl font-extrabold tracking-tight">Choose a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Use at least 8 characters.</p>
            {error && (
              <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <form action={updatePassword} className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">New password</Label>
                <Input id="password" name="password" type="password" minLength={8} required />
              </div>
              <Button type="submit" className="mt-2">
                Update password
              </Button>
            </form>
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
