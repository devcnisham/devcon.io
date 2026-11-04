/**
 * Public surface of the auth feature.
 *
 * Phase 0.1 is UI-only: forms, validation, and every visual state are real,
 * but there is no auth client, session, or route guard behind them yet.
 */

export { AuthCard } from "./components/auth-card";
export { AuthAlert } from "./components/auth-alert";
export { LoginForm } from "./components/login-form";
export { SignupForm } from "./components/signup-form";
export { ForgotPasswordForm } from "./components/forgot-password-form";
export { ResetPasswordForm } from "./components/reset-password-form";
export { VerifyEmailCard } from "./components/verify-email-card";
export { LogoutButton } from "./components/logout-button";
export { RequireAuth, RequireGuest } from "./components/auth-guard";

export {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  passwordStrength,
} from "./lib/schemas";

export type {
  LoginValues,
  SignupValues,
  ForgotPasswordValues,
  ResetPasswordValues,
} from "./lib/schemas";

export type { AuthActionResult } from "./lib/actions";

export type { AuthUser, AuthSession, AuthFormState } from "./types";

/* ---------------------------------------------------------------------------
 * Security primitives live in `./server`, NOT here.
 *
 * This barrel is imported by client components, so anything re-exported from
 * it is bundled for the browser. Password hashing, CSRF token generation, and
 * the cookie helpers are server-only — importing them here would ship argon2
 * and node:crypto to the client and break the build. See ./server.ts.
 * ------------------------------------------------------------------------- */
