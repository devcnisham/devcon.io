"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_OPTIONS,
  createToken,
  SESSION_COOKIE,
} from "@/lib/auth/session.ts";
import { authenticate, createUser } from "@/lib/auth/users.ts";
import {
  type AuthError,
  normalizeEmail,
  validateEmail,
  validatePassword,
} from "@/lib/auth/validate.ts";

/**
 * Sign up, sign in, sign out.
 *
 * Server actions rather than route handlers, for the reason `app/actions.ts`
 * already gives: these change state, and a `GET` that mutates is wrong the
 * first time something prefetches it. It is also what keeps these pages at zero
 * client JavaScript — the form posts, the server answers, no bundle.
 *
 * **A password is never put in a URL.** Failures come back as
 * `?error=<code>&email=<what was typed>`, which is how the page can re-fill the
 * form and say what went wrong with no client component holding state. The
 * email is not a secret; the password is, so it is dropped and retyped.
 */

const backTo = (path: string, params: Record<string, string>) =>
  redirect(`${path}?${new URLSearchParams(params)}`);

/** One place that turns a session into a cookie, used by both entry points. */
async function startSession(userId: string) {
  (await cookies()).set(
    SESSION_COOKIE,
    await createToken(userId),
    COOKIE_OPTIONS,
  );
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const fail = (error: AuthError) =>
    backTo("/signup", { error, email: normalizeEmail(email) });

  // Shape first, so an obviously broken address never reaches a scrypt hash.
  const badEmail = validateEmail(email);
  if (badEmail) return fail(badEmail);
  const badPassword = validatePassword(password);
  if (badPassword) return fail(badPassword);

  const created = await createUser(email, password);
  if (!created.ok) return fail(created.error);

  // Signed in on creation. Making someone type the same password again to
  // reach the page they just signed up for is friction with nothing behind it.
  await startSession(created.user.id);
  redirect("/");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const fail = (error: AuthError) =>
    backTo("/login", { error, email: normalizeEmail(email) });

  // Empty fields are told apart, because that is a typing mistake rather than a
  // wrong credential and saying so costs nothing.
  if (!normalizeEmail(email)) return fail("email-empty");
  if (!password) return fail("password-empty");

  const user = await authenticate(email, password);
  // **One message for a wrong password and an unknown account.** Distinguishing
  // them turns this form into a way to ask whether an email has an account
  // here. `authenticate` hashes either way so the timing does not answer it
  // either.
  if (!user) return fail("credentials");

  await startSession(user.id);
  redirect("/");
}

/**
 * Clears the cookie.
 *
 * **This does not revoke the token.** A copy taken before signing out stays
 * valid until it expires, because there is no server-side session store to
 * revoke it in — see `lib/auth/session.ts`. Stated rather than implied: "signed
 * out" that quietly means "the browser forgot" is the kind of claim this repo
 * exists to catch.
 */
export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
