/**
 * Workspace slugs — the URL-safe identifier derived from a workspace name.
 *
 * A slug ends up in a path, so it must not collide with an application route.
 * Reserved words below are checked before a slug is accepted.
 */

const MAX_SLUG_LENGTH = 48;
const FALLBACK_SLUG = "workspace";

/**
 * Names that would shadow a real route or an obvious future one. Kept
 * deliberately broad — freeing a word later is easy, reclaiming one that users
 * already have in their URLs is not.
 */
export const RESERVED_SLUGS = [
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "dashboard",
  "docs",
  "forgot-password",
  "help",
  "login",
  "logout",
  "new",
  "projects",
  "reset-password",
  "settings",
  "signup",
  "static",
  "status",
  "support",
  "verify-email",
  "workspace",
  "workspaces",
] as const;

export function isReservedSlug(candidate: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(
    candidate.trim().toLowerCase()
  );
}

/**
 * Derives a slug from a display name. Returns an empty string when nothing
 * usable survives — callers decide what to do about that.
 */
export function toSlug(name: string): string {
  const slug = name
    .normalize("NFKD") // split accented characters into base + mark
    .replace(/[̀-ͯ]/g, "") // drop the marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // anything else becomes a separator
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug.slice(0, MAX_SLUG_LENGTH).replace(/-$/, "");
}

/**
 * Derives a slug and makes it unique against slugs already in use, treating
 * reserved words as taken. `taken` is supplied by the caller because this
 * module does no I/O — the database lookup lives with the caller.
 */
export function uniqueSlug(name: string, taken: Set<string>): string {
  const base = toSlug(name) || FALLBACK_SLUG;

  const isFree = (candidate: string) =>
    !taken.has(candidate) && !isReservedSlug(candidate);

  if (isFree(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (isFree(candidate)) return candidate;
  }

  // Practically unreachable; better than looping forever.
  throw new Error(`Could not derive a free slug from "${name}"`);
}
