export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight">Something went wrong</h1>
      <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {message ?? "Unknown auth error."}
      </p>
      <a className="mt-6 text-sm font-medium text-primary hover:underline" href="/login">
        Back to login
      </a>
    </main>
  );
}
