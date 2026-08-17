import { requireUser } from "@/lib/auth/require";
import { SiteNav } from "@/components/site-nav";
import { fileReport } from "./actions";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ deal?: string; error?: string }>;
}) {
  const { role } = await requireUser("/report");
  const { deal, error } = await searchParams;

  return (
    <>
      <SiteNav role={role} />
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-semibold mb-2">Report a problem</h1>
        <p className="text-sm text-gray-600 mb-6">
          Tell us what went wrong{deal ? " with this deal" : ""}. Our team reviews every report.
        </p>
        {error && <p className="mb-4 text-red-600">{error}</p>}
        <form action={fileReport} className="flex flex-col gap-4">
          <input type="hidden" name="deal_id" value={deal ?? ""} />
          <textarea name="reason" rows={6} required className="border rounded p-2"
            placeholder="What happened?" />
          <button className="bg-black text-white rounded p-2">Submit report</button>
        </form>
      </main>
    </>
  );
}
