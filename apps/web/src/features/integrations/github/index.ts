/**
 * Public surface of the GitHub integration.
 *
 * Phase 1.2: the OAuth helpers, API client, and scan source are complete and
 * tested. Running any of it needs a registered GitHub OAuth App and a server
 * session to hold the token — neither exists yet.
 */

export {
  GitHubConnect,
  type GitHubConnectionStatus,
} from "./components/github-connect";
export { RepositoryPicker } from "./components/repository-picker";

export {
  GITHUB_SCOPES,
  buildAuthorizeUrl,
  createOAuthState,
  verifyOAuthState,
  parseCallback,
  type CallbackResult,
} from "./lib/oauth";

export {
  GitHubClient,
  GitHubError,
  type Repository,
  type Tree,
  type TreeEntry,
} from "./lib/client";

export { createGitHubSource } from "./lib/github-source";
