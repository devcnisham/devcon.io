import Link from "next/link";
import { AUTH_MESSAGE, type AuthError } from "@/lib/auth/validate.ts";

/**
 * The chrome for `/login` and `/signup`.
 *
 * One centred card rather than the dashboard's sidebar: there is nowhere to
 * navigate to yet, and a nav rail full of links that need an account is a menu
 * of dead ends.
 *
 * Zero client JavaScript, like every other page here. A real `<form>` posting
 * to a server action does everything a controlled React form would, and the
 * error comes back through the URL — so the browser's own validation, password
 * manager and back button all work without a bundle.
 */

export function AuthShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="rounded font-mono text-[var(--color-text)] text-sm tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          devcon
        </Link>

        <h1 className="mt-8 font-medium text-[var(--color-text)] text-xl tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-[13.5px] text-[var(--color-muted)] leading-relaxed">
          {intro}
        </p>

        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}

/**
 * What went wrong, from `?error=<code>`.
 *
 * `role="alert"` so it is announced rather than only seen — the field it refers
 * to points at it with `aria-describedby`, so a screen reader gets the reason
 * on focus as well.
 */
export function ErrorBanner({ code }: { code?: string }) {
  const message = AUTH_MESSAGE[code as AuthError];
  if (!message) return null;

  return (
    <p
      id="auth-error"
      role="alert"
      className="mb-5 rounded-lg border border-[var(--color-fail)]/40 bg-[var(--color-fail)]/10 px-3 py-2.5 text-[13px] text-[var(--color-fail)]"
    >
      {message}
    </p>
  );
}

export function Field({
  label,
  name,
  type,
  autoComplete,
  defaultValue,
  hint,
  invalid,
}: {
  label: string;
  name: string;
  type: "email" | "password";
  autoComplete: string;
  defaultValue?: string;
  hint?: string;
  invalid?: boolean;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block font-mono text-[10.5px] text-[var(--color-muted)] uppercase tracking-[0.18em]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "auth-error" : undefined}
        className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] px-3 py-2.5 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-muted)]/50 focus:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
      />
      {hint && (
        <span className="mt-1.5 block text-[11.5px] text-[var(--color-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}

export function Submit({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="mt-2 w-full rounded-lg bg-[var(--color-text)] px-3 py-2.5 font-medium text-[14px] text-[var(--color-ink)] transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      {children}
    </button>
  );
}

export function AltLink({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p className="mt-6 text-[13px] text-[var(--color-muted)]">
      {prompt}{" "}
      <Link
        href={href}
        className="rounded text-[var(--color-text)] underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        {label}
      </Link>
    </p>
  );
}
