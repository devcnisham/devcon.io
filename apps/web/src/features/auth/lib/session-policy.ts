/**
 * Session lifetime policy.
 *
 * Two independent limits, both enforced:
 *
 * - **Idle timeout** — a session dies after inactivity, so an unattended
 *   browser stops being a standing key.
 * - **Absolute lifetime** — a session dies at a fixed age no matter how busy
 *   it is, bounding the damage from a stolen cookie.
 *
 * Sliding the idle window alone would let an active attacker hold a session
 * open forever; the absolute limit is what stops that.
 */

export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SessionEvaluation =
  | { status: "valid" }
  | { status: "expired"; reason: "idle" | "absolute" }
  | { status: "invalid"; reason: "issued-in-future" };

export function evaluateSession(input: {
  issuedAt: number;
  lastActiveAt: number;
  now: number;
}): SessionEvaluation {
  const { issuedAt, lastActiveAt, now } = input;

  // Clock skew or a forged timestamp. Refuse rather than guess.
  if (now < issuedAt) {
    return { status: "invalid", reason: "issued-in-future" };
  }

  // Absolute is checked first: when both have passed it is the stronger
  // statement, and the one worth logging.
  if (now - issuedAt > SESSION_ABSOLUTE_MS) {
    return { status: "expired", reason: "absolute" };
  }

  if (now - lastActiveAt > SESSION_IDLE_MS) {
    return { status: "expired", reason: "idle" };
  }

  return { status: "valid" };
}

/** The expiry to write on refresh — the idle window, clamped by the hard cap. */
export function nextExpiry(input: { issuedAt: number; now: number }): number {
  return Math.min(
    input.now + SESSION_IDLE_MS,
    input.issuedAt + SESSION_ABSOLUTE_MS
  );
}
