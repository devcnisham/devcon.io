import type { Metadata } from "next";
import { AuthCard, ForgotPasswordForm } from "@/features/auth";
import { createCsrfToken } from "@/features/auth/server";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  const csrfToken = createCsrfToken();

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we will send you a reset link."
      footerText="Remembered it?"
      footerLinkLabel="Back to sign in"
      footerLinkHref="/login"
    >
      <ForgotPasswordForm csrfToken={csrfToken} />
    </AuthCard>
  );
}
