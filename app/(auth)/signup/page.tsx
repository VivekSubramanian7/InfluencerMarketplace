import Link from "next/link";
import { signup } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6 py-16">
      <Link
        href="/"
        className="mb-8 self-center text-xl font-extrabold tracking-tight text-primary"
      >
        Clipline
      </Link>
      <div className="rounded-xl border p-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
        {invite && (
          <p className="mt-3 rounded-lg border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok">
            A brand invited you to Clipline — sign up as a creator and your
            conversation with them opens automatically.
          </p>
        )}
        <form action={signup} className="mt-6 flex flex-col gap-4">
          {invite && <input type="hidden" name="invite" value={invite} />}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">I am a…</Label>
            <select
              id="role"
              name="role"
              className="h-10 rounded-lg border bg-background px-3 text-sm"
              defaultValue="creator"
            >
              <option value="creator">Video creator</option>
              <option value="brand">Brand</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="display_name">Display name</Label>
            <Input id="display_name" name="display_name" placeholder="Display name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="Email" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Password"
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="mt-2">
            Sign up
          </Button>
        </form>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
