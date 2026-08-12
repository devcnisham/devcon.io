import { MAX_PASSWORD } from "./password.ts";

/**
 * What counts as a usable email and password.
 *
 * Codes rather than sentences, with the sentences in one table beside them —
 * the same shape `lib/workspaces.ts` uses for import errors. A code survives a
 * round trip through a URL, which is how these pages report failure without a
 * client component holding the state.
 */

export type AuthError =
  | "email-empty"
  | "email-invalid"
  | "email-too-long"
  | "password-empty"
  | "password-short"
  | "password-long"
  | "email-taken"
  | "credentials";

export const AUTH_MESSAGE: Record<AuthError, string> = {
  "email-empty": "Enter your email address.",
  "email-invalid": "That does not look like an email address.",
  "email-too-long": "That email address is too long.",
  "password-empty": "Enter a password.",
  "password-short": `Use at least ${8} characters.`,
  "password-long": `Keep it under ${MAX_PASSWORD} characters.`,
  "email-taken": "An account with that email already exists.",
  // Deliberately one message for both halves — see `signIn`.
  credentials: "That email and password do not match an account.",
};

export const MIN_PASSWORD = 8;

/** The `local@domain` cap most mail systems agree on. */
export const MAX_EMAIL = 254;

/**
 * Lower-cased and trimmed, so `Nisham@Example.com` and `nisham@example.com`
 * cannot become two accounts.
 *
 * The local part is technically case-sensitive in the RFC and case-insensitive
 * at every mail provider anyone actually uses. Following the RFC here would
 * mean two accounts that look identical in a list, which is a worse failure
 * than the pedantry is worth.
 */
export function normalizeEmail(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}

/**
 * Structural, not a claim that the address exists.
 *
 * No regex trying to implement RFC 5322 — those are famously wrong in both
 * directions, and the only real proof an address works is sending to it, which
 * this has no way to do. So it rejects what is definitely broken and lets the
 * rest through, and the message says "does not look like" rather than "is not".
 */
export function validateEmail(raw: string): AuthError | null {
  const email = normalizeEmail(raw);
  if (!email) return "email-empty";
  if (email.length > MAX_EMAIL) return "email-too-long";
  if (/\s/.test(email)) return "email-invalid";

  const at = email.indexOf("@");
  // Exactly one `@`, with something either side.
  if (at <= 0 || at !== email.lastIndexOf("@")) return "email-invalid";

  const domain = email.slice(at + 1);
  if (!domain.includes(".")) return "email-invalid";
  if (domain.startsWith(".") || domain.endsWith(".")) return "email-invalid";
  if (domain.includes("..")) return "email-invalid";

  return null;
}

/**
 * Length only, on purpose.
 *
 * No "one uppercase, one symbol" rule. Composition rules push people toward
 * `Password1!` and are no longer recommended by NIST; length is what scrypt
 * actually benefits from. The upper bound is a denial-of-service guard, not a
 * security one — see `MAX_PASSWORD`.
 */
export function validatePassword(raw: string): AuthError | null {
  const password = raw ?? "";
  if (!password) return "password-empty";
  if (password.length < MIN_PASSWORD) return "password-short";
  if (password.length > MAX_PASSWORD) return "password-long";
  return null;
}
