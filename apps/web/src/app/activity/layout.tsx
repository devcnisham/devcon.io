import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/features/auth/server/session";

export default async function ActivityLayout({
  children,
}: LayoutProps<"/activity">) {
  await requireSession("/activity");

  return <AppShell>{children}</AppShell>;
}
