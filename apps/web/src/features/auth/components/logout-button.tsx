"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import { logoutAction } from "@/features/auth/lib/actions";

/**
 * Sign-out trigger: clears the session and CSRF cookies server-side, then
 * sends the user to the sign-in page.
 */
export function LogoutButton({
  variant = "ghost",
  className,
}: {
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  async function signOut() {
    setPending(true);
    setError(null);
    try {
      await logoutAction();
      router.push("/login");
    } catch {
      // Keep the user on the page with feedback rather than a stuck spinner;
      // the server-side clear already ran, so retrying is safe.
      setError("Could not sign out. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <AuthAlert variant="error" message={error} /> : null}
      <Button
        variant={variant}
        className={className}
        onClick={signOut}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? <Spinner /> : <LogOut className="size-4" />}
        {pending ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
