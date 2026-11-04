"use client";

import { useEffect } from "react";
import { AuthCard } from "@/features/auth";
import { AuthAlert } from "@/features/auth";
import { Button } from "@/components/ui/button";

/** Route-level error boundary for the auth screens. */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replaced by Sentry once monitoring lands.
    console.error(error);
  }, [error]);

  return (
    <AuthCard
      title="Something went wrong"
      description="We could not load this page."
      footerText="Still stuck?"
      footerLinkLabel="Back to sign in"
      footerLinkHref="/login"
    >
      <AuthAlert
        variant="error"
        message={error.message || "An unexpected error occurred."}
      />
      <Button size="lg" className="w-full" onClick={reset}>
        Try again
      </Button>
    </AuthCard>
  );
}
