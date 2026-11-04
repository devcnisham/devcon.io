import "server-only";

/**
 * Server-only surface of the auth feature.
 *
 * Everything here touches secrets, native crypto, or cookie headers and must
 * never reach the browser. The `server-only` import above turns a mistaken
 * client import into a build error rather than a silent leak.
 *
 * Phase 0.1.2 part 2: these are complete and tested, but nothing calls them
 * yet — there is no session, user record, or server action to apply them to.
 */

export { hashPassword, verifyPassword, needsRehash } from "./lib/password";
export { createCsrfToken, verifyCsrfToken, isTrustedOrigin } from "./lib/csrf";
export {
  RateLimiter,
  MemoryRateLimitStore,
  type RateLimitStore,
  type RateLimitResult,
} from "./lib/rate-limit";
export { BruteForceGuard, type BruteForceStatus } from "./lib/brute-force";
export {
  evaluateSession,
  nextExpiry,
  SESSION_IDLE_MS,
  SESSION_ABSOLUTE_MS,
  type SessionEvaluation,
} from "./lib/session-policy";
export {
  getSession,
  requireSession,
  requireGuest,
  setSessionProvider,
} from "./server/session";
export {
  decideRoute,
  PROTECTED_PREFIXES,
  GUEST_ONLY_PATHS,
  SIGN_IN_PATH,
  DEFAULT_SIGNED_IN_PATH,
  type RouteDecision,
} from "./lib/route-policy";
export { AUTH_ENABLED } from "./lib/auth-enabled";
export {
  SESSION_COOKIE,
  CSRF_COOKIE,
  sessionCookieOptions,
  csrfCookieOptions,
  clearedCookieOptions,
  type CookieOptions,
} from "./lib/cookies";
