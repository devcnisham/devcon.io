import { redirect } from "next/navigation";
import { oneParam } from "@/lib/ship/search.ts";
import { signIn } from "../auth-actions";
import { AltLink, AuthShell, ErrorBanner, Field, Submit } from "../auth-shell";
import { currentUser } from "../current-user";

/**
 * Sign in.
 *
 * Reads a cookie, so it cannot be prerendered.
 */
export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    email?: string | string[];
  }>;
}) {
  // Already signed in — a login form for someone who is logged in is a way to
  // lose your session by accident.
  if (await currentUser()) redirect("/");

  const params = await searchParams;
  const error = oneParam(params.error);
  const email = oneParam(params.email);

  return (
    <AuthShell
      title="Sign in"
      intro="devcon keeps your accounts on this machine, under ~/.devcon. Nothing is sent anywhere."
    >
      <ErrorBanner code={error} />

      <form action={signIn} noValidate>
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
          autoComplete="current-password"
          invalid={Boolean(error)}
        />
        <Submit>Sign in</Submit>
      </form>

      <AltLink prompt="No account yet?" href="/signup" label="Create one" />
    </AuthShell>
  );
}
