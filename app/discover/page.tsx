import { requireUser } from "@/lib/auth/require";

export default async function DiscoverPage() {
  await requireUser();
  return <main className="p-8">Discovery — coming in Phase 3.</main>;
}
