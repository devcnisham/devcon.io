import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * CSRF defence, two independent layers.
 *
 * 1. Double-submit token — the same random value is sent as a cookie and as a
 *    form field or header. An attacker's page can force the cookie to ride
 *    along but cannot read it to populate the second copy.
 * 2. Origin check — the request's Origin (or Referer) must match this app.
 *
 * Both are required. Neither alone is sufficient.
 */

const TOKEN_BYTES = 32;

export function createCsrfToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Constant-time comparison of the cookie copy against the submitted copy.
 * Lengths are compared first, which leaks only the length — `timingSafeEqual`
 * throws on a length mismatch, so it cannot be called blindly.
 */
export function verifyCsrfToken(
  cookieToken: string | undefined,
  submittedToken: string | undefined
): boolean {
  if (!cookieToken || !submittedToken) return false;

  const a = Buffer.from(cookieToken, "utf8");
  const b = Buffer.from(submittedToken, "utf8");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/**
 * Compares the parsed origin, not the raw string. String prefix matching would
 * accept `https://devstep.app.evil.example`, and a subdomain is a different
 * origin regardless. Missing headers fail closed.
 */
export function isTrustedOrigin(
  headers: { origin?: string; referer?: string },
  allowedOrigin: string
): boolean {
  const candidate = headers.origin ?? headers.referer;
  if (!candidate) return false;

  try {
    return new URL(candidate).origin === new URL(allowedOrigin).origin;
  } catch {
    return false;
  }
}
