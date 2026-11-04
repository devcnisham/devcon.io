/**
 * Which routes need a session, which need the absence of one, and where to
 * send a visitor who is in the wrong state.
 *
 * Pure and I/O-free so it can run in the edge middleware and in a server
 * layout from the same source of truth — two enforcement points, one policy.
 *
 * This decides on the *presence* of a session cookie only. A cookie is not
 * proof of a valid session; the layout check validates it properly. Middleware
 * is the cheap first pass, not the security boundary.
 */

export const PROTECTED_PREFIXES = ["/dashboard", "/projects", "/settings"];

export const GUEST_ONLY_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

export const DEFAULT_SIGNED_IN_PATH = "/dashboard";
export const SIGN_IN_PATH = "/login";

export type RouteDecision =
  { action: "allow" } | { action: "redirect"; to: string };

/** Matches a section root and anything beneath it, but not `/settings-public`. */
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Only same-origin relative paths are accepted as a post-login destination.
 * An absolute URL, or a protocol-relative `//host` (which browsers treat as
 * absolute), would turn the login page into an open redirect.
 */
function safeNextPath(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

export function decideRoute(input: {
  pathname: string;
  search?: string;
  hasSessionCookie: boolean;
  authEnabled: boolean;
}): RouteDecision {
  const { pathname, search = "", hasSessionCookie, authEnabled } = input;

  // Inert until an auth backend exists. Without this, every protected route
  // would redirect to a login page that cannot sign anyone in.
  if (!authEnabled) return { action: "allow" };

  if (PROTECTED_PREFIXES.some((prefix) => isUnder(pathname, prefix))) {
    if (hasSessionCookie) return { action: "allow" };

    const next = encodeURIComponent(`${pathname}${search}`);
    return { action: "redirect", to: `${SIGN_IN_PATH}?next=${next}` };
  }

  if (GUEST_ONLY_PATHS.some((path) => isUnder(pathname, path))) {
    if (!hasSessionCookie) return { action: "allow" };

    const requested = new URLSearchParams(search).get("next");
    return {
      action: "redirect",
      to: safeNextPath(requested) ?? DEFAULT_SIGNED_IN_PATH,
    };
  }

  // Everything else — landing page, verify-email, 404s — is open. A signed-in
  // but unverified user must still be able to reach /verify-email.
  return { action: "allow" };
}
