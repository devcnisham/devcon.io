"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_OPTIONS,
  createToken,
  SESSION_COOKIE,
} from "@/lib/auth/session.ts";
import {
  authenticate,
  changePassword,
  createUser,
  updateProfile,
} from "@/lib/auth/users.ts";
import {
  type AuthError,
  normalizeEmail,
  validateEmail,
  validatePassword,
} from "@/lib/auth/validate.ts";
import { currentUser } from "./current-user";

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

/** Set or clear the display name. Feature 002. */
export async function saveName(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const result = await updateProfile(
    user.id,
    String(formData.get("name") ?? ""),
  );
  if (!result.ok) return backTo("/profile", { error: result.error });
  return backTo("/profile", { saved: "name" });
}

export async function changeMyPassword(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const result = await changePassword(
    user.id,
    String(formData.get("current") ?? ""),
    String(formData.get("next") ?? ""),
  );
  if (!result.ok) return backTo("/profile", { error: result.error });

  // `changePassword` revoked every token issued before now, including the one
  // in this browser. Reissuing here is what keeps the session that made the
  // change signed in while the others end — without it, changing your password
  // would sign you out of the page you are standing on.
  await startSession(user.id);
  return backTo("/profile", { saved: "password" });
}

/**
 * Clears the cookie.
 *
 * **This does not revoke the token.** A copy taken before signing out stays
 * valid until it expires. The machinery to revoke it now exists — feature 002
 * added `sessionsValidFrom`, which is what makes a password change end other
 * sessions — but signing out deliberately does not use it: bumping the cutoff
 * here would sign you out of every other device every time you signed out of
 * one, which is not what the button says. Per-session revocation needs a
 * session table this version does not have.
 */
export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
