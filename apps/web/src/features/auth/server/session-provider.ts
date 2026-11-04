import "server-only";

import type { AuthSession, AuthUser } from "@/features/auth/types";

/** The slice of a Supabase session this module needs. */
export type SupabaseSession = {
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
    email_confirmed_at?: string | null;
  };
  expires_at?: number | null;
};

/**
 * Maps a Supabase session to the app's AuthSession shape.
 *
 * Hard gate (D3): a user whose email is not confirmed is treated as signed
 * out — they land on /verify-email, never inside the app.
 */
export function mapSupabaseSession(
  session: SupabaseSession
): AuthSession | null {
  const { user } = session;
  if (!user.email) return null;
  if (!user.email_confirmed_at) return null;

  const name =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : user.email;

  const authUser: AuthUser = {
    id: user.id,
    name,
    email: user.email,
    emailVerified: true,
  };

  return {
    user: authUser,
    expiresAt: new Date((session.expires_at ?? 0) * 1000).toISOString(),
  };
}
