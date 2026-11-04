import type { Metadata } from "next";
import { AuthCard, ResetPasswordForm } from "@/features/auth";
import { createCsrfToken } from "@/features/auth/server";

export const metadata: Metadata = {
  title: "Reset password",
};

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  const csrfToken = createCsrfToken();

  return (
    <AuthCard
      title="Choose a new password"
      description="Pick something you have not used before."
      footerText="Changed your mind?"
      footerLinkLabel="Back to sign in"
      footerLinkHref="/login"
    >
      <ResetPasswordForm token={value} csrfToken={csrfToken} />
    </AuthCard>
  );
}
