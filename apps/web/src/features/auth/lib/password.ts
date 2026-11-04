import "server-only";
import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing. Argon2id with OWASP-recommended parameters.
 *
 * Plaintext passwords are never logged, stored, or returned. Only the hash
 * leaves this module.
 */

// `Algorithm.Argon2id` is an ambient const enum, which `isolatedModules`
// forbids importing. 2 is its value; the regex in needsRehash pins the
// algorithm name independently, so a drift here cannot pass unnoticed.
const ARGON2ID = 2;

const PARAMS = {
  algorithm: ARGON2ID,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, PARAMS);
}

/**
 * Constant-time comparison, delegated to argon2. A malformed or foreign hash
 * resolves to false rather than throwing — a login route must not distinguish
 * "bad password" from "corrupt record" in its response.
 */
export async function verifyPassword(
  hashed: string,
  plaintext: string
): Promise<boolean> {
  try {
    return await verify(hashed, plaintext, PARAMS);
  } catch {
    return false;
  }
}

/**
 * True when the stored hash was produced with weaker parameters than the
 * current policy, or by a different algorithm. Callers rehash on next
 * successful login, when the plaintext is briefly available.
 */
export function needsRehash(hashed: string): boolean {
  const match = /^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(hashed);
  if (!match) return true;

  const [, version, memoryCost, timeCost, parallelism] = match;

  return (
    Number(version) < 19 ||
    Number(memoryCost) < PARAMS.memoryCost ||
    Number(timeCost) < PARAMS.timeCost ||
    Number(parallelism) < PARAMS.parallelism
  );
}
