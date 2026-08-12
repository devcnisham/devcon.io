import { redirect } from "next/navigation";
import {
  AUTH_MESSAGE,
  type AuthError,
  MIN_PASSWORD,
} from "@/lib/auth/validate.ts";
import { oneParam } from "@/lib/ship/search.ts";
import { changeMyPassword, saveName } from "../auth-actions";
import { Field, Submit } from "../auth-shell";
import { currentUser } from "../current-user";
import { HomeShell } from "../home-shell";

/**
 * Your account — feature 002, phase 0.
 *
 * Two forms and no client JavaScript, like everything else here. Each posts to
 * its own server action and comes back through the URL, so the page can report
 * one outcome without a component holding state.
 *
 * **The email is shown and not editable.** Changing it changes the identity of
 * the row, and doing that honestly needs a confirmation sent to the new address
 * — devcon cannot send mail, so the choice is an unverified change or a field
 * that lies. Neither ships; `v2/task.md` 47 records it.
 */
export const dynamic = "force-dynamic";

/** A date a person can read, in the timezone of the machine rendering it. */
function on(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const SAVED: Record<string, string> = {
  name: "Name saved.",
  password:
    "Password changed. Any other session signed in as you has been ended.",
};

export default async function Profile({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    saved?: string | string[];
  }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const error = AUTH_MESSAGE[oneParam(params.error) as AuthError];
  const saved = SAVED[oneParam(params.saved) ?? ""];

  return (
    <HomeShell
      here="/profile"
      title="Your account"
      intro="Stored on this machine, under ~/.devcon. Nothing here is sent anywhere."
    >
      {error && (
        <p
          id="auth-error"
          role="alert"
          className="mb-6 rounded-lg border border-[var(--color-fail)]/40 bg-[var(--color-fail)]/10 px-3 py-2.5 text-[13px] text-[var(--color-fail)]"
        >
          {error}
        </p>
      )}
      {saved && !error && (
        <p
          role="status"
          className="mb-6 rounded-lg border border-[var(--color-pass)]/40 bg-[var(--color-pass)]/10 px-3 py-2.5 text-[13px] text-[var(--color-pass)]"
        >
          {saved}
        </p>
      )}

      <dl className="mb-10 grid gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-2">
        <div className="bg-[var(--color-ink)] p-4">
          <dt className="font-mono text-[10.5px] text-[var(--color-muted)] uppercase tracking-[0.18em]">
            Email
          </dt>
          <dd className="mt-1.5 break-all text-[14px] text-[var(--color-text)]">
            {user.email}
          </dd>
          <dd className="mt-1 text-[11.5px] text-[var(--color-muted)]">
            Not editable — devcon cannot send a confirmation.
          </dd>
        </div>
        <div className="bg-[var(--color-ink)] p-4">
          <dt className="font-mono text-[10.5px] text-[var(--color-muted)] uppercase tracking-[0.18em]">
            Account created
          </dt>
          <dd className="mt-1.5 text-[14px] text-[var(--color-text)]">
            {on(user.createdAt)}
          </dd>
          {user.updatedAt && (
            <dd className="mt-1 text-[11.5px] text-[var(--color-muted)]">
              Last changed {on(user.updatedAt)}
            </dd>
          )}
        </div>
      </dl>

      <section className="mb-10">
        <h2 className="mb-1 font-medium text-[15px] text-[var(--color-text)]">
          Display name
        </h2>
        <p className="mb-4 max-w-md text-[13px] text-[var(--color-muted)] leading-relaxed">
          Optional. Shown instead of your email. Leave it empty to go back to
          the email.
        </p>
        <form action={saveName} className="max-w-sm" noValidate>
          <Field
            label="Name"
            name="name"
            type="text"
            autoComplete="name"
            required={false}
            defaultValue={user.name ?? ""}
          />
          <Submit>Save name</Submit>
        </form>
      </section>

      <section>
        <h2 className="mb-1 font-medium text-[15px] text-[var(--color-text)]">
          Change password
        </h2>
        <p className="mb-4 max-w-md text-[13px] text-[var(--color-muted)] leading-relaxed">
          Your current password is required even though you are signed in — a
          session left open on a shared machine is the case this defends
          against. Changing it ends every other signed-in session.
        </p>
        <form action={changeMyPassword} className="max-w-sm" noValidate>
          <Field
            label="Current password"
            name="current"
            type="password"
            autoComplete="current-password"
          />
          <Field
            label="New password"
            name="next"
            type="password"
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD} characters.`}
          />
          <Submit>Change password</Submit>
        </form>
      </section>
    </HomeShell>
  );
}
