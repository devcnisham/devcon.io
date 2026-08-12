import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Sessions, as a signed token in an httpOnly cookie.
 *
 * No session table. The token carries a user id and an expiry and is signed
 * with a key that never leaves this machine, so a request can be checked
 * without a read — which matters when the store is a JSON file.
 *
 * **The signing key is generated on first use and written to
 * `~/.devcon/session.key`, never to the repo.** `.gitignore` was this repo's
 * first commit because `.env.local` holds a live token; a secret committed here
 * would be the same failure with the same consequence. Nothing reads it from an
 * environment variable either, so there is no `.env` for it to leak into.
 *
 * The token carries **when it was issued** as well as when it expires, and that
 * is the whole revocation mechanism: a user row can say "nothing issued before
 * this instant counts", which is what makes changing a password actually end
 * the other sessions instead of only changing what the next login checks
 * against. `currentUser` enforces it, because it already re-reads the account.
 *
 * What this still does not do: revoke a single session. Signing out clears the
 * cookie, and a token copied before that stays valid until it expires or until
 * something bumps the account's cutoff. Per-session revocation needs a session
 * table this version does not have — stated rather than implied, because
 * "signed out" that does not revoke is the kind of claim this repo exists to
 * catch.
 */

export const SESSION_COOKIE = "devcon_session";

/** Seven days. Long enough not to annoy, short enough that a stale copy dies. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const KEY_FILE = join(homedir(), ".devcon", "session.key");

/**
 * The signing key, made once and reused.
 *
 * 32 random bytes. Cached per process so a page render does not read a file to
 * check a cookie, and `??=` rather than a check-then-assign so two concurrent
 * requests on a cold server cannot both generate a key and have one overwrite
 * the other's — the losing request's cookies would verify against a key no
 * longer on disk.
 */
let keyPromise: Promise<Buffer> | null = null;

async function loadKey(file: string): Promise<Buffer> {
  try {
    const hex = (await readFile(file, "utf8")).trim();
    const key = Buffer.from(hex, "hex");
    // A truncated or hand-edited key is replaced rather than used. A short key
    // still signs and still verifies, so nothing would report the weakness.
    if (key.length === 32) return key;
  } catch {
    // No key yet is the normal first run, not an error.
  }

  const key = randomBytes(32);
  await mkdir(dirname(file), { recursive: true });
  // 0600. A signing key readable by other accounts on the machine is a signing
  // key anyone on the machine can forge sessions with.
  await writeFile(file, `${key.toString("hex")}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return key;
}

export function sessionKey(file = KEY_FILE): Promise<Buffer> {
  keyPromise ??= loadKey(file);
  return keyPromise;
}

/** Only for tests, which need a key per temp directory. */
export function resetSessionKey(): void {
  keyPromise = null;
}

function sign(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/**
 * `userId.expiresAt.signature`.
 *
 * The id is not a secret and does not need to be hidden — the signature is what
 * makes the token unforgeable. Encrypting it would suggest the id is sensitive
 * and hide that it is not.
 */
export async function createToken(
  userId: string,
  file = KEY_FILE,
  now = Date.now(),
): Promise<string> {
  const payload = `${userId}.${now}.${now + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload, await sessionKey(file))}`;
}

/** What a valid token says. `issuedAt` is what a cutoff is compared against. */
export interface Session {
  userId: string;
  issuedAt: number;
}

/**
 * The session in a token, or null.
 *
 * Null for every failure — malformed, wrong signature, expired, altered. A
 * caller cannot accidentally treat "expired" as "valid but old", and there is
 * no error path that returns an id.
 */
export async function readToken(
  token: string | undefined | null,
  file = KEY_FILE,
  now = Date.now(),
): Promise<Session | null> {
  if (!token) return null;

  // The id is a UUID and contains no dots, so exactly four parts.
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, issuedRaw, expiresRaw, signature] = parts;
  if (!userId || !issuedRaw || !expiresRaw || !signature) return null;

  const issuedAt = Number(issuedRaw);
  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt)) {
    return null;
  }

  const expected = sign(
    `${userId}.${issuedRaw}.${expiresRaw}`,
    await sessionKey(file),
  );
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // Length-check first: timingSafeEqual throws on a mismatch, and a throw here
  // would turn a forged cookie into a 500 instead of a signed-out page.
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  // Checked after the signature, so an expired token still costs a comparison
  // and cannot be told apart from a forged one by timing.
  if (expiresAt <= now) return null;

  return { userId, issuedAt };
}

/**
 * Whether a token survives the account's revocation cutoff.
 *
 * A function rather than two lines inside `currentUser`, because `currentUser`
 * imports `next/headers` and so cannot be reached by `pnpm test` — the check
 * would have been deletable with the whole suite still green, which is the
 * failure this repo keeps recording. Here it is testable and mutation-verified.
 *
 * `undefined` means nothing has been revoked, which is what every row written
 * before feature 002 means. Defaulting to 0 rather than to "now" matters: the
 * other way round would sign out every existing account the moment this
 * shipped.
 */
export function sessionIsCurrent(
  session: Session,
  sessionsValidFrom: number | undefined,
): boolean {
  return session.issuedAt >= (sessionsValidFrom ?? 0);
}

/** The options every session cookie is set with, in one place. */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  // `secure` is deliberately off: devcon runs on http://localhost, and a secure
  // cookie is never sent over http, so turning it on would silently break every
  // session on the only host this currently serves. It has to go on the day
  // this is served over https — see v2/task.md 44.
  secure: false,
  maxAge: SESSION_TTL_MS / 1000,
} as const;
