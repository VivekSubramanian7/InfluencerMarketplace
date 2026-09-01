import { requireRole } from "@/lib/auth/require";

export default async function BrandLayout({ children }: { children: React.ReactNode }) {
  await requireRole("brand", "/brand");
  return children;
}
