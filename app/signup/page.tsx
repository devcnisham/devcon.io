import { redirect } from "next/navigation";
import { MIN_PASSWORD } from "@/lib/auth/validate.ts";
import { oneParam } from "@/lib/ship/search.ts";
import { signUp } from "../auth-actions";
import { AltLink, AuthShell, ErrorBanner, Field, Submit } from "../auth-shell";
import { currentUser } from "../current-user";

/**
 * Create an account.
 *
 * No email confirmation and no password reset. Both need to send mail, devcon
 * has no way to, and a "reset link" that never arrives is worse than an absent
 * button. They are `v2/task.md` 45 and 46, not silent omissions.
 */
export const dynamic = "force-dynamic";

export default async function SignUp({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    email?: string | string[];
  }>;
}) {
  if (await currentUser()) redirect("/");

  const params = await searchParams;
  const error = oneParam(params.error);
  const email = oneParam(params.email);

  return (
    <AuthShell
      title="Create an account"
      intro="Stored on this machine only, under ~/.devcon. Your password is hashed with scrypt and never written down."
    >
      <ErrorBanner code={error} />

      <form action={signUp} noValidate>
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email}
          invalid={Boolean(error)}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD} characters. Length is what helps — there is no symbol rule.`}
          invalid={Boolean(error)}
        />
        <Submit>Create account</Submit>
      </form>

      <AltLink prompt="Already have one?" href="/login" label="Sign in" />
    </AuthShell>
  );
}
