import { requireUser } from "@/lib/auth/require";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { fileReport } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ deal?: string; error?: string }>;
}) {
  const { user, role } = await requireUser("/report");
  const { deal, error } = await searchParams;

  return (
    <AuthenticatedShell userId={user.id} role={role}>
        <h1 className="text-2xl font-semibold tracking-tight">Report a problem</h1>
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
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              name="category"
              defaultValue="ghosting"
              className="h-10 rounded-full border bg-background px-4 text-sm"
            >
              <option value="ghosting">Creator or brand stopped responding</option>
              <option value="quality">Deliverable quality issue</option>
              <option value="payment">Payment dispute</option>
              <option value="content">Content doesn&apos;t match brief</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Details</Label>
            <Textarea id="reason" name="reason" rows={5} required placeholder="Tell us what happened…" />
          </div>
          <Button type="submit" className="mt-2">
            Submit report
          </Button>
        </form>
    </AuthenticatedShell>
  );
}
