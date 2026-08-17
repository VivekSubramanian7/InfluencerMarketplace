export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <main className="mx-auto max-w-sm py-16">
      <h1 className="text-2xl font-semibold mb-4">Something went wrong</h1>
      <p className="text-red-600">{message ?? "Unknown auth error."}</p>
      <a className="underline" href="/login">Back to login</a>
    </main>
  );
}
