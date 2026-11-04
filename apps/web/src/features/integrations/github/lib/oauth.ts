import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * GitHub OAuth — the parts that can be reasoned about without secrets.
 *
 * Token exchange itself needs a client secret and lives server-side; this
 * module covers everything around it: the authorize URL, the `state` parameter
 * that makes the callback safe, and parsing what GitHub sends back.
 *
 * **Why `state` matters.** Without it, anyone can send a victim to our callback
 * with their own `code`, silently linking the victim's devstep account to the
 * attacker's GitHub. The state is generated before the redirect, stored, and
 * compared on return.
 */

/**
 * Least privilege. `read:user` identifies the account; `repo` would grant write
 * access to every private repository, which an importer has no business having.
 * Public repositories need no repository scope at all.
 */
export const GITHUB_SCOPES = ["read:user", "public_repo"] as const;

const AUTHORIZE_ENDPOINT = "https://github.com/login/oauth/authorize";

export function createOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

/** Constant-time comparison — the state is a secret for the length of the flow. */
export function verifyOAuthState(
  stored: string | undefined,
  returned: string | undefined
): boolean {
  if (!stored || !returned) return false;

  const a = Buffer.from(stored, "utf8");
  const b = Buffer.from(returned, "utf8");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export function buildAuthorizeUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(AUTHORIZE_ENDPOINT);

  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("state", options.state);
  url.searchParams.set("scope", GITHUB_SCOPES.join(" "));
  url.searchParams.set("allow_signup", "false");

  return url.toString();
}

export type CallbackResult =
  { ok: true; code: string } | { ok: false; reason: string };

/**
 * Validates the callback before anything is exchanged. State is checked first:
 * a mismatched state means the request did not originate here, and the code is
 * not worth looking at.
 */
export function parseCallback(
  params: URLSearchParams,
  storedState: string | undefined
): CallbackResult {
  const returnedState = params.get("state") ?? undefined;

  if (!verifyOAuthState(storedState, returnedState)) {
    return {
      ok: false,
      reason:
        "The sign-in state did not match. Start the connection again from devstep.",
    };
  }

  const error = params.get("error");
  if (error) {
    return {
      ok: false,
      reason:
        params.get("error_description") ?? `GitHub returned an error: ${error}`,
    };
  }

  const code = params.get("code");
  if (!code) {
    return {
      ok: false,
      reason: "GitHub did not return an authorization code.",
    };
  }

  return { ok: true, code };
}
