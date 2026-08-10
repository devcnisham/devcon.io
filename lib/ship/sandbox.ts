import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Confines a done-when check.
 *
 * `SHIP.md` lives in the repo, and the repo may not be yours. Opening a cloned
 * one and running its checks is running a stranger's shell. Nothing here tries
 * to decide whether a command is safe — that is unwinnable, and the checks
 * legitimately need a shell (`test "$(git show …)"`). The command still runs
 * under `/bin/sh`; what changes is what `/bin/sh` can reach.
 *
 * Three things a hostile check cannot do:
 *   - talk to the network, so nothing it reads can leave
 *   - read anything outside the repo and the toolchain
 *   - touch `.git`, `.env*` or `.vercel`
 *
 * What it still can do: destroy the repo's own working tree. Writes have to be
 * allowed — `tsc` is `incremental`, so `--noEmit` still writes
 * `tsconfig.tsbuildinfo`. Git history is protected; uncommitted work is not.
 */

const SANDBOX_EXEC = "/usr/bin/sandbox-exec";

/**
 * Seatbelt profile. Allowlist — `(deny default)` and nothing gets in unnamed.
 *
 * The trap that cost an hour: **a wildcard deny does not override a specific
 * allow.** `(deny file-read* …)` after `(allow file-read-data (subpath …))`
 * silently does nothing, in either order — the more specific operation wins.
 * The carve-outs below therefore deny `file-read-data` by name, matching the
 * allow exactly. Written as `file-read*` this profile reads as airtight and
 * leaks the whole repo, which is how it was first written and first tested:
 * the `.env.local` token came straight back out.
 *
 * Verify with `pnpm ship:sandbox-check`, never by reading.
 */
/**
 * The directories on PATH, as sandbox rules.
 *
 * Hardcoding where a toolchain lives is the bug this replaces, twice: the Xcode
 * path was written for one laptop, and pnpm was allowed at
 * `~/Library/pnpm` while a CI runner keeps it under `~/setup-pnpm`. nvm, asdf,
 * volta and nix all put binaries somewhere else again.
 *
 * PATH is the list of places the machine has already decided a command may come
 * from, so it is the honest answer to "what may a check execute". Read and
 * map-executable only — nothing here grants a write.
 *
 * Entries are filtered to plain paths. A directory containing a quote or a
 * paren would otherwise be interpolated into the profile and could rewrite it,
 * which is the one thing the `-D` parameters exist to avoid.
 */
const SAFE_PATH_ENTRY = /^\/[A-Za-z0-9._+@/-]*$/;

function pathDirRules(): string {
  const seen = new Set<string>();
  for (const dir of (process.env.PATH ?? "").split(":")) {
    const trimmed = dir.trim();
    if (!trimmed || !SAFE_PATH_ENTRY.test(trimmed)) continue;
    // The directory itself, never its parent. Adding `dirname` looked like a
    // harmless way to reach symlink targets and granted the whole home
    // directory the moment PATH contained `~/bin` — the attack tests caught it
    // on the first run.
    seen.add(trimmed);
  }
  return [...seen].map((d) => `    (subpath ${JSON.stringify(d)})`).join("\n");
}

const PROFILE_TEMPLATE = `(version 1)
(deny default)

;; The one control that makes the others matter: nothing read can leave.
(deny network*)

(allow process-exec*)
(allow process-fork)
(allow sysctl-read)
(allow signal)
(allow mach-lookup)

;; stat/readdir anywhere. Path resolution needs it and it exposes no contents.
(allow file-read-metadata)

(allow file-read-data
    (literal "/") (literal "/var") (literal "/etc") (literal "/tmp") (literal "/private")
    (subpath "/usr") (subpath "/bin") (subpath "/sbin") (subpath "/opt")
    (subpath "/System") (subpath "/Library") (subpath "/dev")
    (subpath "/private/var") (subpath "/private/etc") (subpath "/private/tmp")
    ;; git will not start without its global config.
    (literal (string-append (param "HOME") "/.gitconfig"))
    (subpath (string-append (param "HOME") "/.config/git"))
    ;; Stock macOS /usr/bin/git is an xcrun shim that dlopens libxcrun from the
    ;; Xcode toolchain. Without this, every git check dies with
    ;; "unable to load libxcrun" — which reads as a broken repo, not a missing
    ;; allow.
    ;;
    ;; The path is asked for, not assumed. Hardcoding
    ;; /Applications/Xcode.app/Contents/Developer worked on the machine it was
    ;; written on and failed on the first CI run, where Xcode is installed as
    ;; Xcode_26.6.app. See DEVELOPER_DIR below.
    (subpath (param "DEVELOPER_DIR"))
    (subpath "/Library/Developer")
    (subpath (param "NODE_DIR"))
    (subpath (param "WORKING_DIR"))
__PATH_DIRS__)

(allow file-map-executable
    (subpath "/usr") (subpath "/bin") (subpath "/sbin") (subpath "/opt")
    (subpath "/System") (subpath "/Library")
    (subpath (param "DEVELOPER_DIR"))
    (subpath "/Library/Developer")
    (subpath (param "NODE_DIR"))
    (subpath (param "WORKING_DIR"))
__PATH_DIRS__)

(allow file-write*
    (subpath (param "WORKING_DIR"))
    (subpath "/private/tmp") (subpath "/tmp") (subpath "/private/var/folders")
    (literal "/dev/null") (literal "/dev/tty"))

;; Carve-outs from WORKING_DIR, which is allowed wholesale above. Each names the
;; same operation as the allow it has to beat — see the note above.
(deny file-read-data file-read-metadata file-map-executable
    (regex (string-append "^" (regex-quote (param "WORKING_DIR")) "/\\\\.env"))
    (subpath (string-append (param "WORKING_DIR") "/.vercel")))

(deny file-write*
    (regex (string-append "^" (regex-quote (param "WORKING_DIR")) "/\\\\.env"))
    (subpath (string-append (param "WORKING_DIR") "/.vercel"))
    ;; A check reads history. It does not rewrite it.
    (subpath (string-append (param "WORKING_DIR") "/.git")))
`;

/** Built once — PATH does not change under a running server. */
let profile: string | null = null;
function sandboxProfile(): string {
  if (!profile) {
    profile = PROFILE_TEMPLATE.replaceAll("__PATH_DIRS__", pathDirRules());
  }
  return profile;
}

/**
 * Where the Xcode toolchain actually is on this machine.
 *
 * `/Applications/Xcode.app` is the common answer and not the only one — a CI
 * runner may have `Xcode_26.6.app`, and a machine with only the Command Line
 * Tools has none of it. `xcode-select -p` is the question macOS answers for
 * itself, so it is asked once and cached rather than guessed.
 *
 * A fallback path that does not exist is harmless: seatbelt allows a subpath
 * that is never read.
 */
let developerDir: string | null = null;
function xcodeDeveloperDir(): string {
  if (developerDir) return developerDir;
  try {
    developerDir = execFileSync("/usr/bin/xcode-select", ["-p"], {
      encoding: "utf8",
      timeout: 5_000,
    }).trim();
  } catch {
    developerDir = "";
  }
  if (!developerDir) {
    developerDir = "/Library/Developer/CommandLineTools";
  }
  return developerDir;
}

/**
 * Why checks cannot run here, or null if they can.
 *
 * Seatbelt is macOS-only and there is no Linux or Windows path yet. Returning a
 * reason rather than falling back to an unconfined run is the point: a sandbox
 * that silently degrades reports the same green as a real one, and the whole
 * value of a check is that its result is evidence.
 */
export function sandboxUnavailable(): string | null {
  if (process.platform !== "darwin") {
    return `No sandbox on ${process.platform} — checks run only on macOS, where seatbelt exists. Running them unconfined would execute this repo's SHIP.md unrestricted.`;
  }
  if (!existsSync(SANDBOX_EXEC)) {
    return `${SANDBOX_EXEC} is missing, so nothing can be confined.`;
  }
  return null;
}

/** `sandbox-exec` plus the argv that runs `command` inside it. */
export function sandboxArgv(
  command: string,
  cwd: string,
): { file: string; args: string[] } {
  const home = process.env.HOME ?? "/";
  // The interpreter's own prefix — `~/.nvm/versions/node/vX` under nvm,
  // `/opt/homebrew` under brew. Narrower than allowing all of $HOME.
  const nodeDir = dirname(dirname(process.execPath));

  return {
    file: SANDBOX_EXEC,
    args: [
      "-p",
      sandboxProfile(),
      // Passed as argv, never interpolated into the profile text, so a repo
      // path containing quotes or parens cannot rewrite the policy.
      "-D",
      `WORKING_DIR=${cwd}`,
      "-D",
      `HOME=${home}`,
      "-D",
      `NODE_DIR=${nodeDir}`,
      "-D",
      `DEVELOPER_DIR=${xcodeDeveloperDir()}`,
      "/bin/sh",
      "-c",
      command,
    ],
  };
}

/**
 * A deliberately empty environment.
 *
 * This matters more than it looks. Next.js loads `.env.local` into
 * `process.env`, and this repo's holds a live Vercel OIDC token — so inheriting
 * the parent environment would hand every check that token even though the
 * profile above denies reading the file it came from.
 */
export function sandboxEnv(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin",
    HOME: process.env.HOME ?? "/",
    TMPDIR: process.env.TMPDIR ?? "/tmp",
    LANG: process.env.LANG ?? "en_US.UTF-8",
    // Not a secret, and required on this project's ProcessEnv. Passed through
    // so a check sees the same mode as the process that ran it.
    NODE_ENV: process.env.NODE_ENV,
    // `~/.npmrc` can hold a registry token, so the profile denies it — and pnpm
    // then warns about the EPERM on every single check. Pointing it at
    // /dev/null keeps the denial and drops the noise.
    npm_config_userconfig: "/dev/null",
    // Answers xcrun's first question before it asks. Stock `/usr/bin/git` is a
    // shim that resolves the toolchain by running `xcode-select` and then
    // `xcodebuild`, and `xcodebuild` aborts under this profile. With the answer
    // already in the environment it never gets that far.
    DEVELOPER_DIR: xcodeDeveloperDir(),
  };
}
