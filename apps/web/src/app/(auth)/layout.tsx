import Link from "next/link";
import { Terminal } from "lucide-react";
import { requireGuest } from "@/features/auth/server/session";
import { siteConfig } from "@/config/site";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  // Sends an already-signed-in visitor onward. No-op until auth is enabled.
  await requireGuest();

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <Terminal className="size-5" />
        {siteConfig.name}
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
