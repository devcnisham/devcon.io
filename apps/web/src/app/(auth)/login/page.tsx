import type { Metadata } from "next";
import { AuthCard, LoginForm } from "@/features/auth";
import { createCsrfToken } from "@/features/auth/server";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage() {
  const csrfToken = createCsrfToken();

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your devstep workspace."
      footerText="New here?"
      footerLinkLabel="Create an account"
      footerLinkHref="/signup"
    >
      <LoginForm csrfToken={csrfToken} />
    </AuthCard>
  );
}
