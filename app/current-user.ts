import { cookies } from "next/headers";
import { readToken, SESSION_COOKIE } from "@/lib/auth/session.ts";
import { findById, type PublicUser, publicUser } from "@/lib/auth/users.ts";

/**
 * Who is signed in, or null.
 *
 * The only place a page learns that. Deliberately not in `lib/auth/` — every
 * module under `lib/` is plain node with no framework import, which is what
 * lets `pnpm test` run them directly with no build step and no test runner.
 * `next/headers` would end that for the whole directory.
 *
 * The cookie is proof of the user id and nothing else. The account is re-read
 * every time rather than trusted from the token, so an account deleted from
 * `users.json` stops being signed in immediately instead of when its cookie
 * happens to expire — the same choice `getActive` makes about a folder that has
 * been deleted.
 */
export async function currentUser(): Promise<PublicUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const id = await readToken(token);
  if (!id) return null;

  const user = await findById(id);
  return user ? publicUser(user) : null;
}
