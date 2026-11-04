import type { Metadata } from "next";
import { AuthCard, VerifyEmailCard } from "@/features/auth";
import { createCsrfToken } from "@/features/auth/server";

export const metadata: Metadata = {
  title: "Verify your email",
};

export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const { email } = await searchParams;
  const value = Array.isArray(email) ? email[0] : email;
  const csrfToken = createCsrfToken();

  return (
    <AuthCard
      title="Verify your email"
      description="One last step before you can sign in."
    >
      <VerifyEmailCard email={value} csrfToken={csrfToken} />
    </AuthCard>
  );
}
