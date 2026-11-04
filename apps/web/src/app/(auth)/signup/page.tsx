import type { Metadata } from "next";
import { AuthCard, SignupForm } from "@/features/auth";
import { createCsrfToken } from "@/features/auth/server";

export const metadata: Metadata = {
  title: "Sign up",
};

export default async function SignupPage() {
  const csrfToken = createCsrfToken();

  return (
    <AuthCard
      title="Create your account"
      description="Start taking projects from idea to production."
      footerText="Already have an account?"
      footerLinkLabel="Sign in"
      footerLinkHref="/login"
    >
      <SignupForm csrfToken={csrfToken} />
    </AuthCard>
  );
}
