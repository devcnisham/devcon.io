import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { promisify } from "node:util";
import { checkAll } from "../lib/ship/check.ts";
import { parseSpec } from "../lib/ship/parse.ts";
import {
  sandboxArgv,
  sandboxEnv,
  sandboxUnavailable,
} from "../lib/ship/sandbox.ts";

/**
 * The sandbox, attacked.
 *
 * This file exists because reading the profile is not enough to trust it. The
 * first version read as airtight — `(deny file-read* …)` after
 * `(allow file-read-data …)` — and handed back this repo's live OIDC token on
 * the first attack, because a wildcard deny does not override a specific allow.
 * Nothing here checks the profile's text. Every assertion runs a real command
 * through the real sandbox and looks at what came back.
 *
 * Two ways an attack test lies, both of which happened while writing this:
 *   - the bait did not exist, so "cannot read it" proved nothing
 *   - the pattern matched the *denial message* instead of the file's contents,
 *     so a blocked read was reported as a leak
 * Hence `SECRET`, written by this file, asserted against by content.
 */

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const run = promisify(execFile);

/** Distinctive enough that matching it cannot be an accident. */
const SECRET = "SANDBOX-BAIT-8f3a1c-IF-YOU-SEE-THIS-THE-SANDBOX-LEAKED";

/** Denied by the profile's `.env` carve-out, and inside the repo so it is writable. */
const BAIT_ENV = join(REPO, ".env.sandbox-test-bait");

interface Ran {
  code: number | string;
  signal?: string;
  out: string;
}

/** One command, through the same argv and environment the checker uses. */
async function sh(command: string): Promise<Ran> {
  const { file, args } = sandboxArgv(command, REPO);
  try {
    const { stdout, stderr } = await run(file, args, {
      cwd: REPO,
      timeout: 60_000,
      maxBuffer: 1024 * 256,
      env: sandboxEnv(),
    });
    return { code: 0, out: `${stdout}${stderr}` };
  } catch (e) {
    const err = e as {
      code?: number | string;
      signal?: string;
      stderr?: string;
      stdout?: string;
      message?: string;
    };
    // `err.message` is deliberately excluded: node puts the entire argv in it,
    // so it echoes back the attack's own text. An assertion looking for `WROTE`
    // matched `&& echo WROTE` from the command rather than from any output.
    return {
      code: err.code ?? -1,
      signal: err.signal,
      out: `${err.stderr ?? ""}${err.stdout ?? ""}`,
    };
  }
}

/**
 * Asserts on the secret's absence, never on the exit code.
 *
 * A denied command and a command that failed for its own reasons both exit
 * non-zero, so an exit code cannot tell them apart. Only the contents can.
 */
async function cannotReach(command: string) {
  const r = await sh(command);
  assert.ok(
    !r.out.includes(SECRET),
    `LEAKED via \`${command}\`\n${r.out.slice(0, 300)}`,
  );
  return r;
}

before(() => {
  writeFileSync(BAIT_ENV, `${SECRET}\n`);
  // The bait is only bait if it is really there and really readable unsandboxed.
  assert.ok(readFileSync(BAIT_ENV, "utf8").includes(SECRET));
});

after(() => {
  rmSync(BAIT_ENV, { force: true });
});

describe("availability", () => {
  test("refuses to report green where it cannot test anything", () => {
    // Without a sandbox, `sh()` cannot start a process at all: execFile throws
    // ENOENT, the output is empty, and every `cannotReach` assertion below
    // passes because nothing leaked — because nothing ran. That is a green
    // suite proving nothing, which is the failure this repo keeps hitting.
    //
    // So the suite fails loudly instead. A red run that says "cannot verify
    // here" is worth more than a green one that means nothing, and it is the
    // same choice `sandboxUnavailable` makes for real checks.
    const why = sandboxUnavailable();
    assert.equal(
      why,
      null,
      `The sandbox is unavailable, so these tests cannot verify it: ${why}`,
    );
  });

  test("is active on macOS, and says why when it is not", () => {
    const why = sandboxUnavailable();
    if (process.platform === "darwin") {
      assert.equal(why, null);
    } else {
      assert.ok(why, "must give a reason rather than running unconfined");
    }
  });

  test("the environment handed to a check carries no inherited variables", () => {
    const env = sandboxEnv();
    assert.deepEqual(
      Object.keys(env).sort(),
      [
        "DEVELOPER_DIR",
        "HOME",
        "LANG",
        "NODE_ENV",
        "PATH",
        "TMPDIR",
        "npm_config_userconfig",
      ],
      "an allowlist — Next loads .env.local into process.env, tokens included",
    );
  });
});

describe("a hostile check cannot read", () => {
  test("a .env file in the repo it is checking", async () => {
    await cannotReach(`cat ${JSON.stringify(BAIT_ENV)}`);
  });

  test("…nor reach it through a glob", async () => {
    await cannotReach("cat .env* 2>&1");
  });

  test("…nor through a shell redirect", async () => {
    await cannotReach(
      `while read l; do echo "$l"; done < ${JSON.stringify(BAIT_ENV)}`,
    );
  });

  test("…nor by copying it somewhere readable first", async () => {
    await cannotReach(`cp ${JSON.stringify(BAIT_ENV)} /tmp/x && cat /tmp/x`);
  });

  test("the .vercel directory", async () => {
    const r = await sh("cat .vercel/project.json");
    assert.doesNotMatch(r.out, /projectId|orgId/, r.out.slice(0, 200));
  });

  test("anything in the user's home directory", async () => {
    const r = await sh(`cat ${JSON.stringify(join(homedir(), ".npmrc"))}`);
    // Guarded: absent on a fresh machine, and asserting on a file that is not
    // there is how the first version of this suite passed while testing nothing.
    if (existsSync(join(homedir(), ".npmrc"))) {
      assert.match(r.out, /not permitted/i, r.out.slice(0, 200));
    }
    assert.notEqual(r.code, 0);
  });

  test("another repository on the same machine", async () => {
    const r = await sh("cat /Users/*/Desktop/projects/*/package.json 2>&1");
    assert.doesNotMatch(r.out, /"name"/, r.out.slice(0, 200));
  });
});

describe("a hostile check cannot write", () => {
  test("into .git", async () => {
    const r = await sh("echo x > .git/PWNED && echo WROTE");
    assert.doesNotMatch(r.out, /WROTE/);
    assert.ok(!existsSync(join(REPO, ".git/PWNED")));
  });

  test("…nor delete a ref", async () => {
    const r = await sh("rm -f .git/refs/heads/v2 && echo DELETED");
    assert.doesNotMatch(r.out, /DELETED/);
  });

  test("outside the repo", async () => {
    const target = join(homedir(), ".devcon-sandbox-should-not-exist");
    const r = await sh(`echo x > ${JSON.stringify(target)} && echo WROTE`);
    assert.doesNotMatch(r.out, /WROTE/);
    assert.ok(!existsSync(target), "a write escaped the repo");
  });

  test("over a .env file", async () => {
    const r = await sh(`echo overwritten > ${JSON.stringify(BAIT_ENV)}`);
    assert.notEqual(r.code, 0);
    assert.ok(readFileSync(BAIT_ENV, "utf8").includes(SECRET));
  });
});

describe("a hostile check cannot reach the network", () => {
  test("outbound HTTP fails", async () => {
    const r = await sh("curl -s -m 8 https://example.com");
    assert.doesNotMatch(r.out, /Example Domain/);
    assert.notEqual(r.code, 0);
  });

  test("DNS does not resolve", async () => {
    const r = await sh("nslookup github.com 2>&1");
    assert.doesNotMatch(
      r.out,
      /^Address:\s*\d+\.\d+\.\d+\.\d+/m,
      r.out.slice(0, 200),
    );
  });

  test("git cannot reach a remote", async () => {
    const r = await sh("git ls-remote --exit-code --tags origin v0.1-archive");
    assert.notEqual(r.code, 0);
  });
});

describe("the toolchain a real check actually needs", () => {
  test("stock /usr/bin/git runs — it is an xcrun shim, not git", async () => {
    // Explicitly /usr/bin/git rather than `git`, because PATH here finds
    // Homebrew's real binary first and that is what hid this. The stock one
    // dlopens libxcrun from the Xcode toolchain, so a profile that omits
    // /Applications/Xcode.app fails every git check on a normal Mac while
    // passing on this one.
    const r = await sh("/usr/bin/git rev-parse --verify HEAD");
    assert.doesNotMatch(
      r.out,
      /xcrun: error|unable to load libxcrun/,
      r.out.slice(0, 220),
    );
    assert.equal(r.code, 0, r.out.slice(0, 220));
  });
});

describe("checkAll, against this repo's own SHIP.md", () => {
  test("the checks that should pass, do — the sandbox is not simply breaking everything", async () => {
    const spec = parseSpec(readFileSync(join(REPO, "SHIP.md"), "utf8"));
    const checked = await checkAll(spec.conditions, REPO);

    const byText = (needle: string) =>
      checked.find((c) => c.text.toLowerCase().includes(needle));

    const frozen = byText("frozen");
    assert.equal(frozen?.verdict, "pass", frozen?.evidence);

    const types = byText("typechecks");
    assert.equal(types?.verdict, "pass", types?.evidence);

    const lint = byText("lint is clean");
    assert.equal(lint?.verdict, "pass", lint?.evidence);

    // A condition with no `check:` is a person's call, not a silent pass.
    assert.ok(checked.some((c) => c.verdict === "human"));
  });

  test("a check needing the network errors rather than failing", async () => {
    const [checked] = await checkAll(
      [
        {
          text: "reaches the remote",
          claimed: true,
          check: "git ls-remote --exit-code --tags origin v0.1-archive",
        },
      ],
      REPO,
    );
    // "fail" would say the spec is wrong. The spec is fine; the network is gone
    // on purpose, and the evidence has to show that rather than blame the file.
    assert.equal(checked.verdict, "fail");
    assert.match(checked.evidence, /could not resolve|unable to access/i);
  });

  test("a ticked box whose command disagrees is reported, not smoothed over", async () => {
    const [checked] = await checkAll(
      [{ text: "definitely done", claimed: true, check: "exit 1" }],
      REPO,
    );
    assert.equal(checked.verdict, "fail");
    assert.equal(checked.claimed, true);
  });
});
