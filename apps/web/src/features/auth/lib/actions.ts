"use server";

import { cookies, headers } from "next/headers";
import { loginSchema, signupSchema } from "@/features/auth/lib/schemas";
import { env, isProduction } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/server/supabase";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  clearedCookieOptions,
  csrfCookieOptions,
  sessionCookieOptions,
} from "@/features/auth/lib/cookies";
import { isTrustedOrigin, verifyCsrfToken } from "@/features/auth/lib/csrf";
import { BruteForceGuard } from "@/features/auth/lib/brute-force";
import {
  MemoryRateLimitStore,
  RateLimiter,
} from "@/features/auth/lib/rate-limit";
import { SESSION_ABSOLUTE_MS } from "@/features/auth/lib/session-policy";

/**
 * Success results may carry a `message` (forgot-password and resend use it to
 * surface the account-neutral copy) — absent on plain successes like login.
 */
export type AuthActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

const CSRF_FAILURE: AuthActionResult = {
  ok: false,
  message: "Your session expired. Refresh the page and try again.",
};

const LOCKED: AuthActionResult = {
  ok: false,
  message: "Too many attempts. Try again later.",
};

const INVALID_CREDENTIALS: AuthActionResult = {
  ok: false,
  message: "Email or password is incorrect.",
};

const GENERIC_ERROR: AuthActionResult = {
  ok: false,
  message: "Something went wrong. Try again.",
};

const SIGNUP_FAILED: AuthActionResult = {
  ok: false,
  message: "We could not create that account. Check your details and try again.",
};

// Login request volume: 5 attempts per minute per email + client IP, and 5
// consecutive failures before a lockout that doubles (60s base, 1h cap).
// Values match the conventions tested in rate-limit.test.ts and
// brute-force.test.ts.
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 60_000;
const BRUTE_FORCE_MAX_ATTEMPTS = 5;
const BRUTE_FORCE_BASE_LOCKOUT_MS = 60_000;
const BRUTE_FORCE_MAX_LOCKOUT_MS = 3_600_000;

// Module-scope singletons: the stores must outlive any single request, or every
// request would start with a clean counter and the limits would never engage.
// In-memory means per-process — shared across requests in one server instance;
// the serverless caveat is documented in docs/blocker.md.
const limiter = new RateLimiter({
  limit: LOGIN_RATE_LIMIT,
  windowMs: LOGIN_RATE_WINDOW_MS,
  store: new MemoryRateLimitStore(),
});

const bruteForce = new BruteForceGuard({
  maxAttempts: BRUTE_FORCE_MAX_ATTEMPTS,
  baseLockoutMs: BRUTE_FORCE_BASE_LOCKOUT_MS,
  maxLockoutMs: BRUTE_FORCE_MAX_LOCKOUT_MS,
  store: new MemoryRateLimitStore(),
});

/**
 * Only genuine credential failures count toward the brute-force lockout; a
 * network blip or a Supabase outage must not burn an attempt.
 */
function isInvalidCredentials(error: {
  message: string;
  code?: string;
}): boolean {
  return (
    error.code === "invalid_credentials" ||
    error.message.includes("Invalid login credentials")
  );
}

type AuthLike = {
  signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<{ error: { message: string; code?: string } | null; data: unknown }>;
  signUp(input: {
    email: string;
    password: string;
    options: { data: { name: string }; emailRedirectTo?: string };
  }): Promise<{
    error: { message: string } | null;
    data: { user: { id: string } | null };
  }>;
  signOut(): Promise<{ error: { message: string; code?: string } | null }>;
  resetPasswordForEmail(input: {
    email: string;
  }): Promise<{ error: { message: string } | null }>;
  updateUser(input: {
    password: string;
  }): Promise<{ error: { message: string } | null }>;
  resend(input: {
    type: string;
    email: string;
  }): Promise<{ error: { message: string } | null }>;
};

export type AuthActionsDeps = {
  auth: AuthLike;
  verifyCsrfToken: (token: string) => Promise<boolean>;
  origin: string;
  /** Client IP from the first x-forwarded-for hop; composites the lockout key. */
  clientKey: string;
  setCookie: (name: string, value: string) => Promise<void>;
  clearCookie: (name: string) => Promise<void>;
  recordFailure: (key: string) => Promise<void>;
  recordSuccess: (key: string) => Promise<void>;
  checkBruteForce: (key: string) => Promise<{ locked: boolean }>;
  consumeRateLimit: (key: string) => Promise<{ ok: boolean }>;
};

// Async because Next.js requires every export of a "use server" module to be
// an async function — the factory itself is pure and never touches the
// request, but it has to obey the module's rules to live here.
export async function createAuthActions(deps: AuthActionsDeps) {
  async function guardRequest(
    csrfToken: string
  ): Promise<AuthActionResult | null> {
    // The origin check needs a configured app URL to compare against. Until
    // one exists (empty locally), the double-submit token check below is the
    // defence that stays on; isTrustedOrigin fails closed, so an unconfigured
    // allowedOrigin would otherwise reject every request.
    if (
      env.NEXT_PUBLIC_APP_URL &&
      !isTrustedOrigin({ origin: deps.origin }, env.NEXT_PUBLIC_APP_URL)
    ) {
      return CSRF_FAILURE;
    }
    if (!(await deps.verifyCsrfToken(csrfToken))) return CSRF_FAILURE;
    return null;
  }

  async function login(values: {
    email: string;
    password: string;
    csrfToken: string;
  }): Promise<AuthActionResult> {
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) return { ok: false, message: "Invalid input." };

    const guard = await guardRequest(values.csrfToken);
    if (guard) return guard;

    const email = values.email.trim().toLowerCase();
    // Key on email + client IP: an attacker who knows the email cannot lock
    // the victim out without also holding the IP (see brute-force.ts).
    const key = `${email}|${deps.clientKey}`;
    if ((await deps.checkBruteForce(key)).locked) return LOCKED;
    if (!(await deps.consumeRateLimit(key)).ok) return LOCKED;

    const { error } = await deps.auth.signInWithPassword({
      email,
      password: values.password,
    });
    if (error) {
      // M-c: an unverified account is not a credential failure — the email is
      // known-good, the user just has not clicked the link yet. Nudge instead
      // of recording a brute-force attempt (which would punish them for
      // trying the right password before verifying).
      if (error.code === "email_not_confirmed") {
        return {
          ok: false,
          message: "Check your email to verify your account.",
        };
      }
      if (isInvalidCredentials(error)) {
        await deps.recordFailure(key);
        return INVALID_CREDENTIALS;
      }
      return GENERIC_ERROR;
    }

    await deps.recordSuccess(key);

    // Existence marker for middleware's cheap check — the session provider
    // reads Supabase's own cookie, see src/lib/server/init.ts.
    await deps.setCookie(SESSION_COOKIE, "supabase");
    return { ok: true };
  }

  async function logout(): Promise<AuthActionResult> {
    try {
      await deps.auth.signOut();
    } catch (error) {
      // A signOut failure must not strand the cookies: the clears below still
      // run, and the user is signed out of the app either way.
      console.error(
        "signOut failed",
        error instanceof Error ? error.message : error
      );
    } finally {
      await deps.clearCookie(SESSION_COOKIE);
      await deps.clearCookie(CSRF_COOKIE);
    }
    return { ok: true };
  }

  async function forgotPassword(
    email: string,
    csrfToken: string
  ): Promise<AuthActionResult> {
    const guard = await guardRequest(csrfToken);
    if (guard) return guard;

    const { error } = await deps.auth.resetPasswordForEmail({
      email: email.trim().toLowerCase(),
    });
    // Same message either way — never confirm whether an account exists.
    if (error) console.error("resetPasswordForEmail failed", error.message);
    return {
      ok: true,
      message: "If that email is registered, a reset link is on its way.",
    };
  }

  async function resetPassword(
    password: string,
    csrfToken: string
  ): Promise<AuthActionResult> {
    const guard = await guardRequest(csrfToken);
    if (guard) return guard;

    const { error } = await deps.auth.updateUser({ password });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  async function resendVerification(
    email: string,
    csrfToken: string
  ): Promise<AuthActionResult> {
    const guard = await guardRequest(csrfToken);
    if (guard) return guard;

    const { error } = await deps.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
    });
    // M-a: the raw Supabase message (e.g. "No user found with this email")
    // is an account-existence oracle. Log it server-side; tell the user
    // nothing about whether the account exists.
    if (error) {
      console.error("resendVerification failed", error.message);
      return {
        ok: false,
        message: "We could not send that email. Try again in a moment.",
      };
    }
    return { ok: true };
  }

  async function signup(values: {
    name: string;
    email: string;
    password: string;
    csrfToken: string;
  }): Promise<AuthActionResult> {
    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) return { ok: false, message: "Invalid input." };

    const guard = await guardRequest(values.csrfToken);
    if (guard) return guard;

    const { error } = await deps.auth.signUp({
      email: values.email.trim().toLowerCase(),
      password: values.password,
      options: {
        data: { name: values.name.trim() },
        ...(env.NEXT_PUBLIC_APP_URL
          ? { emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/verify-email` }
          : {}),
      },
    });
    if (error) return SIGNUP_FAILED;

    return { ok: true };
  }

  return {
    login,
    signup,
    logout,
    forgotPassword,
    resetPassword,
    resendVerification,
  };
}

/** The bound actions used by the real forms. */
async function realDeps(): Promise<AuthActionsDeps> {
  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();
  const h = await headers();

  return {
    auth: supabase.auth as never,
    verifyCsrfToken: async (token) => {
      const csrf = cookieStore.get(CSRF_COOKIE)?.value ?? "";
      return verifyCsrfToken(csrf, token);
    },
    origin: h.get("origin") ?? "",
    clientKey: h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    setCookie: async (name, value) => {
      cookieStore.set(
        name,
        value,
        sessionCookieOptions({
          maxAgeMs: SESSION_ABSOLUTE_MS,
          isProduction,
        })
      );
    },
    clearCookie: async (name) => {
      cookieStore.set(name, "", clearedCookieOptions());
    },
    recordFailure: async (key) => {
      await bruteForce.recordFailure(key);
    },
    recordSuccess: async (key) => {
      await bruteForce.recordSuccess(key);
    },
    checkBruteForce: async (key) => {
      return bruteForce.check(key);
    },
    consumeRateLimit: async (key) => {
      return { ok: (await limiter.consume(key)).allowed };
    },
  };
}

// The token must outlive the time it takes to fill the form but no longer —
// short-lived CSRF tokens shrink the replay window.
const CSRF_COOKIE_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Writes the double-submit copy of the CSRF token to its cookie. The page can
 * issue the token but cannot set cookies during render (Server Components
 * cannot modify cookies — Next 16), so the form calls this on mount. Next's
 * own origin check on server-action POSTs stops a cross-site page from
 * invoking this, which is what keeps the cookie trustworthy.
 */
export async function issueCsrfToken(csrfToken: string): Promise<void> {
  (await cookies()).set(
    CSRF_COOKIE,
    csrfToken,
    csrfCookieOptions({ maxAgeMs: CSRF_COOKIE_MAX_AGE_MS })
  );
}

export async function loginAction(values: {
  email: string;
  password: string;
  csrfToken: string;
}): Promise<AuthActionResult> {
  return (await createAuthActions(await realDeps())).login(values);
}

export async function signupAction(values: {
  name: string;
  email: string;
  password: string;
  csrfToken: string;
}): Promise<AuthActionResult> {
  return (await createAuthActions(await realDeps())).signup(values);
}

export async function logoutAction(): Promise<AuthActionResult> {
  return (await createAuthActions(await realDeps())).logout();
}

export async function forgotPasswordAction(
  email: string,
  csrfToken: string
): Promise<AuthActionResult> {
  return (await createAuthActions(await realDeps())).forgotPassword(
    email,
    csrfToken
  );
}

export async function resetPasswordAction(
  password: string,
  csrfToken: string
): Promise<AuthActionResult> {
  return (await createAuthActions(await realDeps())).resetPassword(
    password,
    csrfToken
  );
}

export async function resendVerificationAction(
  email: string,
  csrfToken: string
): Promise<AuthActionResult> {
  return (await createAuthActions(await realDeps())).resendVerification(
    email,
    csrfToken
  );
}
