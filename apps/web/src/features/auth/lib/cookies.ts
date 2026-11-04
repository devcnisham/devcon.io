/**
 * Cookie flags for auth cookies.
 *
 * Both names carry the `__Host-` prefix, which browsers enforce: the cookie is
 * rejected unless it is Secure, has `Path=/`, and sets no `Domain`. That last
 * part is the point — without it, any subdomain (including one an attacker
 * controls via a takeover) can set a cookie the main site would honour.
 */

export const SESSION_COOKIE = "__Host-devstep_session";
export const CSRF_COOKIE = "__Host-devstep_csrf";

export type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
};

/** Cookie maxAge is expressed in whole seconds; never negative. */
function toMaxAgeSeconds(maxAgeMs: number): number {
  return Math.max(0, Math.floor(maxAgeMs / 1000));
}

/**
 * `secure` is unconditional, not production-only: `__Host-` requires it, so a
 * development-only exception would make the cookie silently vanish. Use
 * https://localhost, or drop the prefix locally — do not weaken this flag.
 *
 * `sameSite: "lax"` rather than "strict" so that following a link into the app
 * (a verification email, an external link) arrives authenticated. Lax already
 * withholds the cookie from cross-site POSTs, which is the CSRF-relevant case,
 * and the CSRF token covers what remains.
 */
export function sessionCookieOptions(input: {
  maxAgeMs: number;
  isProduction?: boolean;
}): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: toMaxAgeSeconds(input.maxAgeMs),
  };
}

/**
 * The CSRF cookie is deliberately readable by scripts: the double-submit
 * pattern requires the page to copy it into a header or form field. It carries
 * no authority on its own — an attacker who reads it still cannot use it,
 * because same-origin policy stops their page from reading it at all.
 */
export function csrfCookieOptions(input: {
  maxAgeMs: number;
  isProduction?: boolean;
}): CookieOptions {
  return {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: toMaxAgeSeconds(input.maxAgeMs),
  };
}

/**
 * Options for deleting a cookie. The browser matches on name, path, and
 * domain — clearing with different flags leaves the original in place.
 */
export function clearedCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}
