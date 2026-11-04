import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/features/auth/server/session";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  // Second enforcement pass. Middleware already rejected visitors with no
  // session cookie; this validates the session itself. No-op until
  // NEXT_PUBLIC_AUTH_ENABLED is set.
  await requireSession("/dashboard");

  return <AppShell>{children}</AppShell>;
}
