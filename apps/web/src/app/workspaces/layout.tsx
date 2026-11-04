import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/features/auth/server/session";

export default async function WorkspacesLayout({
  children,
}: LayoutProps<"/workspaces">) {
  await requireSession("/workspaces");

  return <AppShell>{children}</AppShell>;
}
