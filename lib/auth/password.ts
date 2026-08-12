import {
  randomBytes,
  type ScryptOptions,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing.
 *
 * `node:crypto`'s scrypt, and no dependency. bcrypt and argon2 are both better
 * understood by more people, and both are native modules that would have to
 * compile on every machine this runs on — for a local tool whose whole install
 * is `pnpm install`, that is a real cost against a marginal gain.
 *
 * **Nothing here ever sees a stored password.** Only a hash goes to disk, the
 * salt is per-user, and the comparison is constant-time. A plaintext password
 * exists in memory for the length of one request and is never logged, never
 * put in a URL, and never written to `~/.devcon`.
 */

/**
 * `promisify`'s own overloads stop at three arguments, so the options object —
 * which is where N, r and p live, and therefore the entire cost of the hash —
 * does not typecheck without saying the shape here.
 */
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Cost parameters, written into every hash rather than assumed.
 *
 * A hash that does not record how it was made cannot be upgraded: raising N
 * later would make every existing password unverifiable, so the choice would be
 * frozen forever by the first user. Storing them means an old hash keeps
 * verifying with old parameters while new ones use the new cost.
 *
 * N=16384 needs 128·N·r = 16 MB, which is inside node's 32 MB scrypt default.
 * Raising N past 32768 without also raising `maxmem` fails at runtime rather
 * than being slow, which is the kind of thing that only shows up under load.
 */
const N = 16_384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

/**
 * The longest password this will hash.
 *
 * Not a security rule — a denial-of-service one. scrypt's cost is fixed by N,
 * r and p rather than by input length, but there is no reason to run megabytes
 * of form data through it, and an unbounded field is an unbounded write.
 */
export const MAX_PASSWORD = 200;

/**
 * `scrypt$N$r$p$salt$hash`, base64url, no padding.
 *
 * Self-describing on purpose. A bare hex digest tells a later reader nothing
 * about how to check it.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(plain, salt, KEYLEN, {
    N,
    r: R,
    p: P,
  });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

/**
 * Constant-time verify.
 *
 * Returns false for a malformed or unknown-algorithm stored value rather than
 * throwing. A corrupt row in `users.json` must fail one login, not take the
 * page down — and it must fail *closed*.
 */
export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const parts = (stored ?? "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  // A hand-edited cost of 2^40 would hang the process rather than fail a login.
  if (!Number.isInteger(n) || n < 2 || n > 1 << 20) return false;
  if (!Number.isInteger(r) || r < 1 || r > 32) return false;
  if (!Number.isInteger(p) || p < 1 || p > 16) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64url");
    expected = Buffer.from(parts[5], "base64url");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await scryptAsync(plain, salt, expected.length, {
      N: n,
      r,
      p,
    });
  } catch {
    // Cost parameters node refuses — out of memory budget, for instance.
    return false;
  }

  // Lengths are equal by construction above, but timingSafeEqual throws rather
  // than returning false when they are not, and a throw here would be a 500 on
  // a wrong password.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
