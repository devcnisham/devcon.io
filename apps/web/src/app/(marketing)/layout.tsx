import Link from "next/link";
import { Terminal } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-14 items-center gap-4 border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Terminal className="size-5" />
          {siteConfig.name}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Log in
          </Button>
          <Button nativeButton={false} render={<Link href="/signup" />}>
            Sign up
          </Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="text-muted-foreground border-t px-6 py-4 text-sm">
        © {new Date().getFullYear()} {siteConfig.name}
      </footer>
    </div>
  );
}
