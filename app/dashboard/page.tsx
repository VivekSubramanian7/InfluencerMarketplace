import { requireRole } from "@/lib/auth/require";

export default async function DashboardPage() {
  await requireRole("creator");
  return <main className="p-8">Creator dashboard — coming in Phase 2.</main>;
}
