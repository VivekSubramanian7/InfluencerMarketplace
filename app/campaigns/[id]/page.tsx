import { requireUser } from "@/lib/auth/require";
import { touchCursor } from "@/lib/feature-cursors";
import { AuthenticatedShell } from "@/components/authenticated-shell";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; invited?: string }>;
}) {
  const { id } = await params;
  const { user, role } = await requireUser(`/campaigns/${id}`);
  await touchCursor("campaigns");
  const { error, saved, invited } = await searchParams;

  return (
    <AuthenticatedShell userId={user.id} role={role}>
      <CampaignDetail campaignId={id} error={error} saved={saved} invited={invited} />
    </AuthenticatedShell>
  );
}
