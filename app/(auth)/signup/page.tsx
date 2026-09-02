import Link from "next/link";
import { signup } from "../actions";
import { SignupForm } from "./signup-form";
import { Button } from "@/components/ui/button";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return (
    <main className="flex min-h-svh">
      <div className="hidden w-2/5 bg-primary md:block" aria-hidden>
        <div className="flex h-full flex-col justify-between p-10 text-primary-foreground">
          <Link href="/" className="text-xl font-black tracking-tight">
            Clipline
          </Link>
          <div>
            <p className="max-w-[28ch] text-2xl font-bold leading-tight">
              Don&apos;t let your next deal die in DMs.
            </p>
            <p className="mt-3 text-sm text-primary-foreground/60">
              Free for creators. You keep 100% of your rate.
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
          <SignupForm invite={invite ?? null} signupAction={signup} />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
