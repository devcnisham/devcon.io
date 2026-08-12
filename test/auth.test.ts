import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { hashPassword, verifyPassword } from "../lib/auth/password.ts";
import {
  COOKIE_OPTIONS,
  createToken,
  readToken,
  resetSessionKey,
  SESSION_TTL_MS,
  sessionIsCurrent,
} from "../lib/auth/session.ts";
import {
  authenticate,
  changePassword,
  createUser,
  displayName,
  findByEmail,
  updateProfile,
} from "../lib/auth/users.ts";
import {
  AUTH_MESSAGE,
  type AuthError,
  MIN_PASSWORD,
  normalizeEmail,
  validateEmail,
  validateName,
  validatePassword,
} from "../lib/auth/validate.ts";

/**
 * Authentication — feature 001, phase 0.
 *
 * Every store function takes its file, so nothing here touches the real
 * `~/.devcon`. That is the same shape `lib/workspaces.ts` uses and the reason
 * this can be tested at all.
 *
 * The assertions that matter most are the negative ones: that a password never
 * reaches disk, that a tampered cookie is rejected, and that an unknown email
 * costs the same work as a known one. A login form that "works" is easy; those
 * three are where it actually is or is not authentication.
 */

let dir = "";
const file = () => join(dir, "users.json");
const keyFile = () => join(dir, "session.key");

const PASSWORD = "correct-horse-battery-staple";

before(() => {
  dir = mkdtempSync(join(tmpdir(), "devcon-auth-"));
});

after(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  resetSessionKey();
});

describe("password hashing", () => {
  test("a hash is self-describing, so its cost can be raised later", async () => {
    const h = await hashPassword(PASSWORD);
    const parts = h.split("$");
    assert.equal(parts.length, 6);
    assert.equal(parts[0], "scrypt");
    // N, r, p — a hash that does not record these can never be upgraded
    // without invalidating every existing password.
    assert.ok(Number(parts[1]) >= 16_384, `N was ${parts[1]}`);
    assert.ok(Number(parts[2]) >= 8);
    assert.ok(Number(parts[3]) >= 1);
  });

  test("the same password hashes differently every time", async () => {
    // Or the store leaks which accounts share a password.
    const a = await hashPassword(PASSWORD);
    const b = await hashPassword(PASSWORD);
    assert.notEqual(a, b);
  });

  test("the hash does not contain the password", async () => {
    const h = await hashPassword(PASSWORD);
    assert.ok(!h.includes(PASSWORD));
    // …nor as base64 of itself, which a lazy "encoder" would produce.
    assert.ok(!h.includes(Buffer.from(PASSWORD).toString("base64url")));
  });

  test("the right password verifies and a wrong one does not", async () => {
    const h = await hashPassword(PASSWORD);
    assert.equal(await verifyPassword(PASSWORD, h), true);
    assert.equal(await verifyPassword(`${PASSWORD}x`, h), false);
    assert.equal(await verifyPassword("", h), false);
  });

  test("one changed character fails", async () => {
    const h = await hashPassword(PASSWORD);
    // The digest is the last field; flipping a character must not still verify.
    const parts = h.split("$");
    const last = parts[5];
    parts[5] = (last[0] === "A" ? "B" : "A") + last.slice(1);
    assert.equal(await verifyPassword(PASSWORD, parts.join("$")), false);
  });

  test("a corrupt stored value fails closed, and never throws", async () => {
    // One bad row in users.json must fail one login, not take the page down —
    // and it must fail closed rather than open.
    for (const bad of [
      "",
      "not-a-hash",
      "scrypt$16384$8$1$onlyfive",
      "bcrypt$16384$8$1$c2FsdA$aGFzaA",
      "scrypt$0$8$1$c2FsdA$aGFzaA",
      "scrypt$16384$0$1$c2FsdA$aGFzaA",
      "scrypt$16384$8$0$c2FsdA$aGFzaA",
      // A hand-edited cost that would hang the process if it were honoured.
      "scrypt$1099511627776$8$1$c2FsdA$aGFzaA",
      "scrypt$16384$8$1$$",
    ]) {
      assert.equal(
        await verifyPassword(PASSWORD, bad),
        false,
        `accepted or threw on: ${bad}`,
      );
    }
  });
});

describe("what counts as an email and a password", () => {
  test("email case and padding never make two accounts", () => {
    assert.equal(normalizeEmail("  Nisham@Example.COM "), "nisham@example.com");
  });

  test("addresses that are definitely broken are rejected", () => {
    const bad: [string, AuthError][] = [
      ["", "email-empty"],
      ["   ", "email-empty"],
      ["nisham", "email-invalid"],
      ["@example.com", "email-invalid"],
      ["nisham@", "email-invalid"],
      ["nisham@example", "email-invalid"],
      ["nisham@@example.com", "email-invalid"],
      ["nisham@.com", "email-invalid"],
      ["nisham@example.", "email-invalid"],
      ["nisham@exam..ple.com", "email-invalid"],
      ["nis ham@example.com", "email-invalid"],
      [`${"a".repeat(250)}@example.com`, "email-too-long"],
    ];
    assert.ok(bad.length > 0);
    for (const [input, expected] of bad) {
      assert.equal(validateEmail(input), expected, `for: ${input}`);
    }
  });

  test("ordinary addresses are accepted", () => {
    const good = [
      "nisham@example.com",
      "nisham+devcon@example.co.uk",
      "n.i.s@sub.example.dev",
      "NISHAM@EXAMPLE.COM",
    ];
    assert.ok(good.length > 0);
    for (const input of good) {
      assert.equal(validateEmail(input), null, `rejected: ${input}`);
    }
  });

  test("passwords are judged on length and nothing else", () => {
    assert.equal(validatePassword(""), "password-empty");
    assert.equal(
      validatePassword("a".repeat(MIN_PASSWORD - 1)),
      "password-short",
    );
    assert.equal(validatePassword("a".repeat(MIN_PASSWORD)), null);
    assert.equal(validatePassword("a".repeat(201)), "password-long");
    // No composition rule: an all-lowercase passphrase is fine and a short
    // `Aa1!` is not, which is the way round that matches how scrypt works.
    assert.equal(validatePassword("correct horse battery staple"), null);
    assert.equal(validatePassword("Aa1!"), "password-short");
  });

  test("every error code has a message", () => {
    const codes = Object.keys(AUTH_MESSAGE) as AuthError[];
    assert.ok(codes.length > 0);
    for (const c of codes) {
      assert.ok(AUTH_MESSAGE[c]?.length > 0, `no message for ${c}`);
    }
  });
});

describe("the account store", () => {
  test("a new account is created and can be found", async () => {
    const r = await createUser("Nisham@Example.com", PASSWORD, file());
    assert.equal(r.ok, true);
    if (!r.ok) return;
    // Stored normalised, so the list cannot hold two rows that look identical.
    assert.equal(r.user.email, "nisham@example.com");
    assert.ok(r.user.id.length > 0);

    const found = await findByEmail("NISHAM@EXAMPLE.COM", file());
    assert.equal(found?.id, r.user.id);
  });

  test("the password is not on disk, in any form", async () => {
    const raw = readFileSync(file(), "utf8");
    assert.ok(!raw.includes(PASSWORD), "the plaintext password was written");
    assert.ok(!raw.includes(Buffer.from(PASSWORD).toString("base64")));
    // And the hash is there, so this is not passing because the file is empty.
    assert.match(raw, /scrypt\$/);
  });

  test("the store is not readable by other accounts on the machine", () => {
    // 0600. A file of password hashes at the default 0644 is readable by every
    // user on the machine.
    assert.equal(statSync(file()).mode & 0o077, 0);
  });

  test("the same email cannot be taken twice, whatever its case", async () => {
    const again = await createUser("nisham@example.com", PASSWORD, file());
    assert.equal(again.ok, false);
    if (again.ok) return;
    assert.equal(again.error, "email-taken");

    const mixed = await createUser("NiShAm@ExAmPlE.com", PASSWORD, file());
    assert.equal(mixed.ok, false);
  });

  test("a public user carries no hash", async () => {
    const r = await createUser("second@example.com", PASSWORD, file());
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.ok(!("passwordHash" in r.user), "the hash escaped to a caller");
  });

  test("the right password authenticates", async () => {
    const u = await authenticate("nisham@example.com", PASSWORD, file());
    assert.ok(u, "a correct password was rejected");
    assert.equal(u.email, "nisham@example.com");
  });

  test("a wrong password and an unknown email both return null", async () => {
    assert.equal(
      await authenticate("nisham@example.com", "wrong", file()),
      null,
    );
    assert.equal(
      await authenticate("nobody@example.com", PASSWORD, file()),
      null,
    );
  });

  test("an unknown email still costs a hash, so accounts cannot be enumerated", async () => {
    // Asserted in the slow direction only. `test/check.test.ts` records why:
    // asserting that something is *fast* is a timing race on a loaded machine.
    // This asserts a floor, which an early `return null` for an unknown email
    // would break on any machine — the whole point of the decoy hash.
    const started = Date.now();
    await authenticate("definitely-nobody@example.com", PASSWORD, file());
    const ms = Date.now() - started;
    assert.ok(ms >= 10, `unknown email answered in ${ms}ms — no work was done`);
  });

  test("a missing store is no accounts, not a crash", async () => {
    const missing = join(dir, "nope", "users.json");
    assert.equal(await findByEmail("nisham@example.com", missing), null);
    assert.equal(
      await authenticate("nisham@example.com", PASSWORD, missing),
      null,
    );
  });
});

describe("the profile — feature 002", () => {
  const profileFile = () => join(dir, "profile-users.json");
  let id = "";

  before(async () => {
    const r = await createUser("profile@example.com", PASSWORD, profileFile());
    if (r.ok) id = r.user.id;
  });

  test("a name is optional, and absent rather than empty when cleared", async () => {
    const set = await updateProfile(id, "  Nisham   Ahmed ", profileFile());
    assert.equal(set.ok, true);
    if (!set.ok) return;
    // Whitespace collapsed, so a name cannot be stored two ways that look the
    // same in a list.
    assert.equal(set.user.name, "Nisham Ahmed");

    const cleared = await updateProfile(id, "   ", profileFile());
    assert.equal(cleared.ok, true);
    if (!cleared.ok) return;
    // Absent, not "". A caller should never have to treat empty as a third case.
    assert.equal(cleared.user.name, undefined);
    assert.ok(
      !Object.hasOwn(
        JSON.parse(readFileSync(profileFile(), "utf8"))[0],
        "name",
      ),
      "an empty name was written to disk",
    );
  });

  test("what to show is the name if there is one, else the email", async () => {
    assert.equal(
      displayName({ id, email: "profile@example.com", createdAt: 0 }),
      "profile@example.com",
    );
    assert.equal(
      displayName({
        id,
        email: "profile@example.com",
        createdAt: 0,
        name: "Nisham",
      }),
      "Nisham",
    );
  });

  test("real names are accepted, and only the undisplayable are not", () => {
    // Every one of these is rejected by some real signup form, and every one
    // is a real name.
    const real = [
      "Nisham",
      "Ada Lovelace",
      "Seán Ó Briain",
      "Иван Петров",
      "山田太郎",
      "Anne-Marie O'Neill",
      "Prince",
      "李",
    ];
    assert.ok(real.length > 0);
    for (const n of real) {
      assert.equal(validateName(n), null, `rejected a real name: ${n}`);
    }

    assert.equal(validateName(""), null, "empty means no name, not an error");
    assert.equal(validateName("a".repeat(81)), "name-long");
    assert.equal(validateName("Nis ham"), "name-control");
    assert.equal(validateName("Nisham"), "name-control");
    // A bidi override makes the stored name and the rendered name disagree.
    assert.equal(validateName("Nisham‮"), "name-control");
    assert.equal(validateName("Nisham⁦x⁩"), "name-control");
    // A newline breaks every list the name appears in — and `normalizeName`
    // collapses it to a space first, so this is checked after normalising.
    assert.equal(validateName("Nisham\nAhmed"), null);
  });

  test("a password change needs the current one", async () => {
    const wrong = await changePassword(
      id,
      "not-my-password",
      "a-brand-new-password",
      profileFile(),
    );
    assert.equal(wrong.ok, false);
    if (wrong.ok) return;
    assert.equal(wrong.error, "password-wrong");

    // …and the old password still works, so nothing was half-applied.
    assert.ok(
      await authenticate("profile@example.com", PASSWORD, profileFile()),
    );
  });

  test("the new password must pass the same rules and differ from the old", async () => {
    const short = await changePassword(id, PASSWORD, "short", profileFile());
    assert.equal(short.ok, false);
    if (!short.ok) assert.equal(short.error, "password-short");

    const same = await changePassword(id, PASSWORD, PASSWORD, profileFile());
    assert.equal(same.ok, false);
    if (!same.ok) assert.equal(same.error, "password-same");
  });

  test("changing it rotates the hash and retires the old password", async () => {
    const NEXT = "an-entirely-different-passphrase";
    const before = JSON.parse(readFileSync(profileFile(), "utf8"))[0]
      .passwordHash;

    const ok = await changePassword(id, PASSWORD, NEXT, profileFile());
    assert.equal(ok.ok, true, ok.ok ? "" : ok.error);

    const after = JSON.parse(readFileSync(profileFile(), "utf8"))[0];
    assert.notEqual(after.passwordHash, before);
    assert.ok(!readFileSync(profileFile(), "utf8").includes(NEXT));

    assert.ok(await authenticate("profile@example.com", NEXT, profileFile()));
    assert.equal(
      await authenticate("profile@example.com", PASSWORD, profileFile()),
      null,
      "the old password still works",
    );
  });

  test("…and revokes every session issued before it", async () => {
    // The point of the whole `sessionsValidFrom` field. Without it a password
    // change leaves every existing token working, including the one belonging
    // to whoever the change was meant to lock out.
    const row = JSON.parse(readFileSync(profileFile(), "utf8"))[0];
    assert.ok(
      typeof row.sessionsValidFrom === "number",
      "no cutoff was written, so nothing was revoked",
    );

    resetSessionKey();
    const older = await createToken(
      id,
      keyFile(),
      row.sessionsValidFrom - 1000,
    );
    const newer = await createToken(
      id,
      keyFile(),
      row.sessionsValidFrom + 1000,
    );

    // `readToken` alone still accepts both — it proves the signature and the
    // expiry and deliberately does not read the store. The cutoff is enforced
    // where the account is already being read, which is `currentUser`.
    const a = await readToken(older, keyFile());
    const b = await readToken(newer, keyFile());
    assert.ok(a && b, "a validly signed token stopped being readable");

    // The token issued before the change is refused; the one after survives.
    assert.equal(sessionIsCurrent(a, row.sessionsValidFrom), false);
    assert.equal(sessionIsCurrent(b, row.sessionsValidFrom), true);
  });

  test("an account that has revoked nothing keeps every session", () => {
    // `undefined` is what every row written by feature 001 has. Treating it as
    // "now" instead of "never" would sign out every existing account the moment
    // this shipped.
    const s = { userId: "u", issuedAt: 0 };
    assert.equal(sessionIsCurrent(s, undefined), true);
    assert.equal(sessionIsCurrent(s, 1), false);
    // A token issued at exactly the cutoff is kept — the reissued one lands
    // there, and rejecting it would sign out the session doing the changing.
    assert.equal(sessionIsCurrent({ userId: "u", issuedAt: 5 }, 5), true);
  });

  test("editing an account that has since been deleted says so", async () => {
    const gone = await updateProfile("no-such-id", "X", profileFile());
    assert.equal(gone.ok, false);
    if (!gone.ok) assert.equal(gone.error, "no-account");
  });

  test("a row written before profiles existed still loads", async () => {
    // No `name`, no `updatedAt`, no `sessionsValidFrom` — exactly what
    // feature 001 wrote. It must keep working rather than need a migration.
    const legacy = join(dir, "legacy-users.json");
    const hash = await hashPassword(PASSWORD);
    writeFileSync(
      legacy,
      JSON.stringify([
        {
          id: "legacy-1",
          email: "legacy@example.com",
          passwordHash: hash,
          createdAt: 1,
        },
      ]),
    );

    const u = await authenticate("legacy@example.com", PASSWORD, legacy);
    assert.ok(u, "a pre-profile row stopped authenticating");
    assert.equal(u.name, undefined);

    // And a token older than any cutoff is fine, because there is no cutoff.
    const row = JSON.parse(readFileSync(legacy, "utf8"))[0];
    assert.equal(row.sessionsValidFrom, undefined);
  });
});

describe("sessions", () => {
  test("a token round-trips to the user it was made for", async () => {
    resetSessionKey();
    const token = await createToken("user-1", keyFile());
    assert.equal((await readToken(token, keyFile()))?.userId, "user-1");
  });

  test("the signing key is written to disk, not to the repo, and is 0600", () => {
    const mode = statSync(keyFile()).mode;
    assert.equal(mode & 0o077, 0, "the session key is readable by other users");
    // 32 bytes as hex. A short key still signs and still verifies, so nothing
    // else would report it.
    assert.equal(readFileSync(keyFile(), "utf8").trim().length, 64);
  });

  test("a tampered token is rejected", async () => {
    resetSessionKey();
    const token = await createToken("user-1", keyFile());
    const [id, exp, sig] = token.split(".");

    // A different user, same signature.
    assert.equal(await readToken(`user-2.${exp}.${sig}`, keyFile()), null);
    // A later expiry, same signature — the obvious forgery.
    assert.equal(
      await readToken(`${id}.${Number(exp) + 60_000}.${sig}`, keyFile()),
      null,
    );
    // A flipped signature character.
    const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    assert.equal(await readToken(`${id}.${exp}.${flipped}`, keyFile()), null);
  });

  test("a malformed token is null rather than a 500", async () => {
    resetSessionKey();
    for (const bad of [
      undefined,
      null,
      "",
      "nonsense",
      "one.two",
      "a.b.c.d",
      "..",
      "user-1..sig",
      "user-1.not-a-number.sig",
    ]) {
      assert.equal(await readToken(bad, keyFile()), null, `accepted: ${bad}`);
    }
  });

  test("an expired token is rejected", async () => {
    resetSessionKey();
    const past = Date.now() - SESSION_TTL_MS - 1;
    const token = await createToken("user-1", keyFile(), past);
    assert.equal(await readToken(token, keyFile()), null);
    // …and was valid when it was made, so this is expiry and not a bad signature.
    assert.equal(
      (await readToken(token, keyFile(), past + 1000))?.userId,
      "user-1",
    );
  });

  test("a token signed with another key does not verify", async () => {
    resetSessionKey();
    const token = await createToken("user-1", keyFile());

    const other = join(dir, "other.key");
    resetSessionKey();
    assert.equal(await readToken(token, other), null);

    // The original key still works, so the token itself was fine.
    resetSessionKey();
    assert.equal((await readToken(token, keyFile()))?.userId, "user-1");
  });

  test("the cookie cannot be read by JavaScript and does not cross sites", () => {
    assert.equal(
      COOKIE_OPTIONS.httpOnly,
      true,
      "an XSS could read the session",
    );
    assert.equal(COOKIE_OPTIONS.sameSite, "lax");
    assert.equal(COOKIE_OPTIONS.path, "/");
  });
});
