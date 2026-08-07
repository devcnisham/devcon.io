/**
 * Public site identity, in one place.
 *
 * The strings here are used by the page, the metadata, the OG image, the
 * sitemap and the structured data. They were previously either absent or
 * duplicated in prose, which is how a tagline ends up saying three different
 * things in three places.
 */

/**
 * Where this is actually served from.
 *
 * Env-driven, and defaulting to localhost rather than hard-coding a guess.
 * Nothing in this repo records a deployed domain — the git remote is a GitHub
 * URL, not a host — and a canonical tag pointing at a domain that isn't yours
 * is worse than no canonical at all: it hands the ranking to whoever does own
 * it. Set `NEXT_PUBLIC_SITE_URL` at build time.
 *
 * A public origin is not a secret, so this does not touch rule 7. There is
 * still no input anywhere that accepts a key.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const SITE_NAME = "DevCon";

/** The H1. Kept here so the OG image cannot drift away from the page. */
export const SITE_TAGLINE = "Ship the project, not the plan.";

/**
 * 156 characters. The meta-description window is ~150–160 before Google
 * truncates, and this is the one piece of copy that has to survive being read
 * with no page around it.
 */
export const SITE_DESCRIPTION =
  "Turn an idea or an existing repo into a short, ordered sequence of steps to ship it. Everything that doesn't apply is hidden, with a reason attached.";

/** Shorter, for the OG card, where long lines wrap badly at 1200×630. */
export const SITE_OG_SUBTITLE =
  "The short, ordered sequence of steps to ship it — and a reason for everything it leaves out.";
