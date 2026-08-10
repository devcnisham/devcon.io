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
const PROFILE = `(version 1)
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
    ;; Xcode toolchain. Without these, every git check dies with
    ;; "unable to load libxcrun" — which reads as a broken repo, not a missing
    ;; allow. It only looked fine here because this PATH finds Homebrew's git
    ;; first; the dev server's PATH does not, and that is the common case.
    (subpath "/Applications/Xcode.app/Contents/Developer")
    (subpath "/Library/Developer")
    (subpath (param "NODE_DIR"))
    (subpath (string-append (param "HOME") "/Library/pnpm"))
    (subpath (string-append (param "HOME") "/.local/share/pnpm"))
    (subpath (param "WORKING_DIR")))

(allow file-map-executable
    (subpath "/usr") (subpath "/bin") (subpath "/sbin") (subpath "/opt")
    (subpath "/System") (subpath "/Library")
    (subpath "/Applications/Xcode.app/Contents/Developer")
    (subpath "/Library/Developer")
    (subpath (param "NODE_DIR"))
    (subpath (param "WORKING_DIR")))

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
      PROFILE,
      // Passed as argv, never interpolated into the profile text, so a repo
      // path containing quotes or parens cannot rewrite the policy.
      "-D",
      `WORKING_DIR=${cwd}`,
      "-D",
      `HOME=${home}`,
      "-D",
      `NODE_DIR=${nodeDir}`,
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
  };
}
