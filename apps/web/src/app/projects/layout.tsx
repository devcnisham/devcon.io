import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/features/auth/server/session";

export default async function ProjectsLayout({
  children,
}: LayoutProps<"/projects">) {
  // Second enforcement pass. Middleware already rejected visitors with no
  // session cookie; this validates the session itself. Live since
  // NEXT_PUBLIC_AUTH_ENABLED was set (Task 11).
  await requireSession("/projects");

  return <AppShell>{children}</AppShell>;
}
