import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { hashPassword, verifyPassword } from "./password.ts";
import { type AuthError, normalizeEmail } from "./validate.ts";

/**
 * The accounts.
 *
 * `~/.devcon/users.json`, beside `workspaces.json` and for the same reason:
 * user-level state never goes inside a tracked repo, where it would land in
 * someone's diff and their submission. A file of password hashes doing that
 * would be the worst version of the mistake this rule exists to prevent.
 *
 * **This is the local backend, and it is meant to be replaced.** The plan puts
 * a real one at Phase 6 — `v2/feature-phase.md` item 81. Everything above this
 * file talks to `createUser` and `authenticate` rather than to JSON, so
 * swapping the store is this file, not the pages.
 */

export interface User {
  id: string;
  /** Normalised — lower-cased, trimmed. The identity of the row. */
  email: string;
  /** `scrypt$…`. Never a password. */
  passwordHash: string;
  createdAt: number;
}

/** What a page may see. There is no route on which the hash is useful. */
export interface PublicUser {
  id: string;
  email: string;
  createdAt: number;
}

export const USERS = join(homedir(), ".devcon", "users.json");

export function publicUser(u: User): PublicUser {
  return { id: u.id, email: u.email, createdAt: u.createdAt };
}

function isUser(u: unknown): u is User {
  const r = u as Partial<User> | null;
  return (
    typeof r?.id === "string" &&
    typeof r.email === "string" &&
    typeof r.passwordHash === "string"
  );
}

/**
 * A hand-edited or half-written store must not take the page down with it —
 * the same choice `readStore` makes in `lib/workspaces.ts`.
 */
async function readUsers(file: string): Promise<User[]> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    return Array.isArray(parsed) ? parsed.filter(isUser) : [];
  } catch {
    return [];
  }
}

async function writeUsers(file: string, list: User[]): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  // 0600: this file holds password hashes. Default 0644 would leave them
  // readable by every account on the machine.
  await writeFile(file, `${JSON.stringify(list, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export async function countUsers(file = USERS): Promise<number> {
  return (await readUsers(file)).length;
}

export async function findByEmail(
  email: string,
  file = USERS,
): Promise<User | null> {
  const wanted = normalizeEmail(email);
  return (await readUsers(file)).find((u) => u.email === wanted) ?? null;
}

export async function findById(id: string, file = USERS): Promise<User | null> {
  return (await readUsers(file)).find((u) => u.id === id) ?? null;
}

/**
 * Create an account, or say the email is taken.
 *
 * Returns a result rather than throwing, because "this email exists" is an
 * ordinary outcome of a signup form and not an exceptional one.
 */
export async function createUser(
  email: string,
  password: string,
  file = USERS,
  now = Date.now(),
): Promise<{ ok: true; user: PublicUser } | { ok: false; error: AuthError }> {
  const normalized = normalizeEmail(email);
  const list = await readUsers(file);
  if (list.some((u) => u.email === normalized)) {
    return { ok: false, error: "email-taken" };
  }

  const user: User = {
    id: randomUUID(),
    email: normalized,
    passwordHash: await hashPassword(password),
    createdAt: now,
  };
  await writeUsers(file, [...list, user]);
  return { ok: true, user: publicUser(user) };
}

/**
 * Check an email and password.
 *
 * **A missing account still costs a hash.** Returning early when the email is
 * unknown would make "no such user" measurably faster than "wrong password",
 * and that difference is a way to enumerate who has an account. So an unknown
 * email is verified against a throwaway hash and fails on the comparison like
 * any other wrong password.
 */
export async function authenticate(
  email: string,
  password: string,
  file = USERS,
): Promise<PublicUser | null> {
  const user = await findByEmail(email, file);
  const stored = user?.passwordHash ?? (await decoyHash());
  const ok = await verifyPassword(password, stored);
  return ok && user ? publicUser(user) : null;
}

/**
 * A real scrypt hash of a password nobody has, so the unknown-email path does
 * the same work as the known one. Its value is irrelevant; only its cost is.
 *
 * Built on first use and cached, not at import. A top-level `await` here would
 * put a full scrypt on the import of this module — paid by every server start
 * and by every test file that touches it, to serve a path most requests never
 * take.
 */
let decoy: Promise<string> | null = null;
function decoyHash(): Promise<string> {
  decoy ??= hashPassword(randomUUID());
  return decoy;
}
