import { requireUser } from "@/lib/auth/require";
import { SiteNav } from "@/components/site-nav";
import { fileReport } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Report a problem</h1>
        <p className="mt-1 text-muted-foreground">
          Tell us what went wrong{deal ? " with this deal" : ""}. Our team reviews every report.
        </p>
        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <form action={fileReport} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="deal_id" value={deal ?? ""} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">What happened?</Label>
            <Textarea id="reason" name="reason" rows={6} required placeholder="What happened?" />
          </div>
          <Button type="submit" className="mt-2">
            Submit report
          </Button>
        </form>
      </main>
    </>
  );
}
