import Link from "next/link";
import type { AuthSession } from "@/features/auth/types";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Presentational route guards.
 *
 * These decide what to RENDER for a given session — they do not fetch, read, or
 * verify anything, and they are not a security boundary. Session state is
 * passed in explicitly; when the auth backend lands, a layout resolves the
 * session server-side and the real redirect happens there, with these kept for
 * the visual states.
 */

function GuardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-40 w-full" />
      <span className="sr-only">Checking your session…</span>
    </div>
  );
}

/** Renders children only for a signed-in session. */
export function RequireAuth({
  session,
  pending = false,
  children,
}: {
  session: AuthSession | null;
  pending?: boolean;
  children: React.ReactNode;
}) {
  if (pending) return <GuardSkeleton />;

  if (!session) {
    return (
      <Empty>
        <EmptyTitle>Sign in to continue</EmptyTitle>
        <EmptyDescription>
          This page is part of your workspace. Sign in to view it.
        </EmptyDescription>
        <Button nativeButton={false} render={<Link href="/login" />}>
          Sign in
        </Button>
      </Empty>
    );
  }

  return <>{children}</>;
}

/** Renders children only for a signed-OUT visitor — login, signup, reset. */
export function RequireGuest({
  session,
  pending = false,
  children,
}: {
  session: AuthSession | null;
  pending?: boolean;
  children: React.ReactNode;
}) {
  if (pending) return <GuardSkeleton />;

  if (session) {
    return (
      <Empty>
        <EmptyTitle>You are already signed in</EmptyTitle>
        <EmptyDescription>Signed in as {session.user.email}.</EmptyDescription>
        <Button nativeButton={false} render={<Link href="/dashboard" />}>
          Go to dashboard
        </Button>
      </Empty>
    );
  }

  return <>{children}</>;
}
