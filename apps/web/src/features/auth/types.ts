/**
 * Auth types owned by this feature.
 *
 * NOTE: this phase is UI-only. No auth client, no session, no route guards are
 * wired yet — these types describe the shapes the UI renders against so that
 * the backend phase can satisfy them without reshaping components.
 */

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  avatarUrl?: string;
};

export type AuthSession = {
  user: AuthUser;
  expiresAt: string;
};

/** What every auth form reports back to its page. */
export type AuthFormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "success"; message?: string };
