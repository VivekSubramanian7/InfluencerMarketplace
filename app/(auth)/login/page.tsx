import Link from "next/link";
import { login } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
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
            <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Log in to your account</p>
            <form action={login} className="mt-6 flex flex-col gap-4">
              <input type="hidden" name="next" value={next ?? ""} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="you@example.com" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="Password" required />
              </div>
              <Button type="submit" className="mt-2">
                Log in
              </Button>
            </form>
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
