import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthSession } from "@/features/auth/types";
import { AUTH_ENABLED } from "@/features/auth/lib/auth-enabled";
import { SESSION_COOKIE } from "@/features/auth/lib/cookies";
import {
  DEFAULT_SIGNED_IN_PATH,
  SIGN_IN_PATH,
} from "@/features/auth/lib/route-policy";

/**
 * Second enforcement pass, and the real one.
 *
 * Middleware only sees whether a cookie exists. This runs in the Node runtime
 * inside a layout or server action, so it can look the session up and validate
 * it. A forged cookie gets past middleware and dies here.
 *
 * There is no session provider yet — storage is deferred until Supabase
 * exists. Until then `getSession` returns null, and enabling AUTH_ENABLED
 * without a provider throws rather than quietly letting requests through.
 */

type SessionProvider = (token: string) => Promise<AuthSession | null>;

let provider: SessionProvider | null = null;

/** Called once by the auth backend when it lands. */
export function setSessionProvider(next: SessionProvider): void {
  provider = next;
}

export async function getSession(): Promise<AuthSession | null> {
  if (!AUTH_ENABLED) return null;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  // No cookie is a definitive "no session" — it needs no provider to answer,
  // and answering it here keeps the signed-out paths (login, signup) working
  // even before a backend exists.
  if (!token) return null;

  if (!provider) {
    // A cookie is present but nothing can answer "is this valid?". Fail
    // closed, loudly — never treat an unverifiable token as valid.
    throw new Error(
      "NEXT_PUBLIC_AUTH_ENABLED is true but no session provider is registered. " +
        "Call setSessionProvider() during server startup, or unset the flag."
    );
  }

  return provider(token);
}

/**
 * For layouts behind the app shell. Redirects a signed-out visitor to the
 * login page, preserving where they were headed.
 *
 * While AUTH_ENABLED is false this is a no-op — see auth-enabled.ts for why
 * enforcing early would lock the app.
 */
export async function requireSession(
  returnTo?: string
): Promise<AuthSession | null> {
  if (!AUTH_ENABLED) return null;

  const session = await getSession();
  if (session) return session;

  const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
  redirect(`${SIGN_IN_PATH}${next}`);
}

/** For the auth screens. Sends an already-signed-in visitor onward. */
export async function requireGuest(): Promise<void> {
  if (!AUTH_ENABLED) return;

  const session = await getSession();
  if (session) redirect(DEFAULT_SIGNED_IN_PATH);
}
