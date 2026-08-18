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
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6 py-16">
      <Link
        href="/"
        className="mb-8 self-center text-xl font-extrabold tracking-tight text-primary"
      >
        Clipline
      </Link>
      <div className="rounded-xl border p-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Log in</h1>
        <form action={login} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="Email" required />
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
    </main>
  );
}
