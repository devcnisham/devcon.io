"use client";

import * as React from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import {
  issueCsrfToken,
  resendVerificationAction,
} from "@/features/auth/lib/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Post-signup screen: tells the user to check their inbox and lets them resend
 * the verification email, rate-limited client-side by a cooldown.
 */
export function VerifyEmailCard({
  email,
  csrfToken,
}: {
  email?: string;
  csrfToken: string;
}) {
  const [state, setState] = React.useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [message, setMessage] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // A page render cannot write the CSRF cookie (Server Components cannot
  // modify cookies), so the token is written to its cookie copy on mount.
  React.useEffect(() => {
    void issueCsrfToken(csrfToken);
  }, [csrfToken]);

  async function resend() {
    setState("sending");
    setMessage(null);
    try {
      const result = await resendVerificationAction(email ?? "", csrfToken);
      if (!result.ok) {
        setState("error");
        setMessage(result.message);
        return;
      }
      setState("sent");
      setMessage(result.message ?? "Verification email sent again.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setState("error");
      setMessage("Something went wrong. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="bg-muted flex size-12 items-center justify-center rounded-full">
          <MailCheck className="size-5" />
        </div>
        <p className="text-sm">
          We sent a verification link
          {email ? (
            <>
              {" "}
              to <span className="font-medium">{email}</span>
            </>
          ) : null}
          . Open it to activate your account.
        </p>
      </div>

      {state === "error" && message ? (
        <AuthAlert variant="error" message={message} />
      ) : null}
      {state === "sent" ? (
        <AuthAlert
          variant="success"
          message={message ?? "Verification email sent again."}
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={resend}
          disabled={state === "sending" || cooldown > 0}
          aria-busy={state === "sending"}
        >
          {state === "sending" ? (
            <>
              <Spinner />
              Sending…
            </>
          ) : cooldown > 0 ? (
            `Resend in ${cooldown}s`
          ) : (
            "Resend verification email"
          )}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="w-full"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          Back to sign in
        </Button>
      </div>
    </div>
  );
}
