import { PROVIDERS, type Provider } from "./index";

/**
 * Provider freshness — `docs/gaps-plan.md` G4.
 *
 * 30 providers carry a `last_verified` date that nothing read. Free tiers change
 * quarterly, so the catalog's most concrete claims were rotting silently: a
 * seeded date looks exactly like an audited one, and there was no moment at
 * which anyone was told to look again.
 *
 * This is that moment. It is deliberately a hard failure rather than a warning —
 * a warning in a passing suite is a warning nobody reads.
 */

/** Past this, a free-tier claim is assumed stale rather than merely old. */
export const FRESHNESS_DAYS = 90;

export type StaleReason =
  /** Older than FRESHNESS_DAYS. The case this exists for. */
  | "stale"
  /** Not a `YYYY-MM-DD` date, so its age is unknowable. */
  | "unparseable"
  /**
   * Dated in the future.
   *
   * Worth its own reason because it is the one typo the check would otherwise
   * reward: `2027-08-04` for `2026-08-04` reads as fresh for a year, which is
   * strictly worse than the silent rot this replaces.
   */
  | "future";

export interface StaleProvider {
  id: string;
  last_verified: string;
  /** Whole days since verification. Negative for a future date, NaN if unparseable. */
  ageDays: number;
  reason: StaleReason;
}

const DAY_MS = 86_400_000;

/**
 * Whole days between a `YYYY-MM-DD` date and an instant.
 *
 * `NaN` when the string isn't a real date. Both sides are compared in UTC —
 * `Date.parse` reads a date-only string as UTC midnight, so measuring against a
 * local-midnight `now` would drift by a day either side of the boundary
 * depending on the machine's timezone.
 *
 * There was a `/^\d{4}-\d{2}-\d{2}$/` shape test here first. Mutation-testing
 * found it dead: deleting it broke nothing, because the round-trip below is
 * strictly stronger. Anything that survives a round trip through `toISOString`
 * *is* a `YYYY-MM-DD` date, by construction — so the regex could only ever
 * reject what the round trip already rejects.
 */
export function ageInDays(last_verified: string, now: Date): number {
  const then = Date.parse(`${last_verified}T00:00:00Z`);
  if (Number.isNaN(then)) return Number.NaN;

  // `Date.parse` does not reject an impossible day — it rolls it over, so
  // `2026-02-31` parses fine and reads as `2026-03-03`, three days fresher
  // than whatever was meant. This is the check that actually rejects it.
  if (new Date(then).toISOString().slice(0, 10) !== last_verified) {
    return Number.NaN;
  }

  return Math.floor((now.getTime() - then) / DAY_MS);
}

/**
 * Every provider whose verification date can no longer be trusted.
 *
 * Providers the builder added themselves are skipped: `makeCustomProvider`
 * leaves `last_verified` empty precisely because it never claims verification,
 * and flagging them would make the check fail on the user's own data — which
 * turns a catalog-maintenance signal into noise the user cannot act on.
 */
export function staleProviders(
  now: Date,
  providers: Provider[] = PROVIDERS,
): StaleProvider[] {
  const out: StaleProvider[] = [];

  for (const p of providers) {
    if (p.custom) continue;

    const ageDays = ageInDays(p.last_verified, now);
    const reason: StaleReason | null = Number.isNaN(ageDays)
      ? "unparseable"
      : ageDays < 0
        ? "future"
        : ageDays > FRESHNESS_DAYS
          ? "stale"
          : null;

    if (reason)
      out.push({ id: p.id, last_verified: p.last_verified, ageDays, reason });
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * What to do about it, in the failure message itself.
 *
 * A check that says `expected [ ... ] to equal []` tells whoever hits it in
 * three months nothing about which claim to go and re-read.
 */
export function describeStale(stale: StaleProvider[]): string {
  if (!stale.length) return "";

  const lines = stale.map((s) => {
    if (s.reason === "unparseable") {
      return `  ${s.id}: last_verified is ${JSON.stringify(s.last_verified)}, which is not a YYYY-MM-DD date`;
    }
    if (s.reason === "future") {
      return `  ${s.id}: last_verified ${s.last_verified} is ${-s.ageDays} days in the future`;
    }
    return `  ${s.id}: last_verified ${s.last_verified} is ${s.ageDays} days old`;
  });

  return [
    `${stale.length} provider${stale.length === 1 ? "" : "s"} past the ${FRESHNESS_DAYS}-day freshness bar:`,
    ...lines,
    "",
    "Re-check each one's free tier against the live service, then update",
    "last_verified in lib/catalog/providers/index.ts. Bumping the date without",
    "re-reading the tier is the failure this check exists to prevent.",
  ].join("\n");
}
