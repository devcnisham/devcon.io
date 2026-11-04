import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/features/auth/server/session";

export default async function SettingsLayout({
  children,
}: LayoutProps<"/settings">) {
  // Second enforcement pass. Middleware already rejected visitors with no
  // session cookie; this validates the session itself. No-op until
  // NEXT_PUBLIC_AUTH_ENABLED is set.
  await requireSession("/settings");

  return <AppShell>{children}</AppShell>;
}
