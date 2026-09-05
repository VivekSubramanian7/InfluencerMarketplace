import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { getAppShellData } from "@/lib/app-shell/data";
import type { Role } from "@/lib/auth/home";

export async function AuthenticatedShell({
  userId,
  role,
  children,
  pane,
}: {
  userId: string;
  role: Role;
  children: ReactNode;
  pane?: ReactNode;
}) {
  const shell = await getAppShellData(userId, role);
  return <AppShell {...shell} pane={pane}>{children}</AppShell>;
}
