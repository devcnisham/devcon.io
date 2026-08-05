import type { Capability, Provider } from "@/lib/catalog/providers";
import { PROVIDERS } from "@/lib/catalog/providers";
import type { GitRemote } from "@/lib/scan/types";

/**
 * What the builder has connected, and what each connection actually points at.
 *
 * This used to live inside the Integrations panel as component state, which
 * meant the canvas could not see it — and a connection the workflow doesn't
 * know about isn't part of the workflow. It's lifted here so both surfaces read
 * one source, and it survives a refresh like the rest of the local state.
 *
 * The hard rule still holds with no exceptions: key NAMES and a "configured"
 * boolean. `identity` below is a repo path or a project slug — public names,
 * the kind of thing that appears in a URL — never a credential.
 */
export interface IntegrationState {
  /** Provider ids the builder has connected. */
  connected: string[];
  /** `${providerId}:${ENV_KEY}` for every key marked configured. */
  configured: string[];
  /**
   * What this connection resolves to in the real world, when it's knowable.
   * Keyed by provider id, e.g. `github` → `devcnisham/devcon.io`.
   */
  identity: Record<string, string>;
  /** Providers the builder added themselves. */
  custom: Provider[];
}

export const EMPTY_INTEGRATIONS: IntegrationState = {
  connected: [],
  configured: [],
  identity: {},
  custom: [],
};

const KEY = "devcon:integrations:v1";

export function loadIntegrations(): IntegrationState {
  if (typeof window === "undefined") return EMPTY_INTEGRATIONS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_INTEGRATIONS;
    return { ...EMPTY_INTEGRATIONS, ...JSON.parse(raw) };
  } catch {
    return EMPTY_INTEGRATIONS;
  }
}

export function saveIntegrations(state: IntegrationState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private browsing, or a full quota. Losing the connection list is
    // recoverable — the user reconnects. Crashing the canvas is not.
  }
}

/**
 * Identity the scan can establish on its own, with no account and no API call.
 *
 * Only the git remote qualifies today: it's on disk, it's already being read,
 * and it names the actual repository. Everything else — the Vercel project, the
 * Supabase instance — needs an authenticated call DevCon can't make yet, so it
 * stays absent rather than being filled with a plausible guess.
 */
export function identityFromScan(
  remote: GitRemote | null,
): Record<string, string> {
  if (!remote) return {};
  const slug = `${remote.owner}/${remote.repo}`;
  const host = remote.host.toLowerCase();
  if (host.includes("gitlab")) return { gitlab: slug };
  if (host.includes("github")) return { github: slug, "github-issues": slug };
  return {};
}

/** Providers the builder connected, catalog and custom together. */
export function connectedProviders(
  state: IntegrationState,
  providers: Provider[] = PROVIDERS,
): Provider[] {
  const all = [...providers, ...state.custom];
  const order = new Map(all.map((p, i) => [p.id, i]));
  return state.connected
    .map((id) => all.find((p) => p.id === id))
    .filter((p): p is Provider => Boolean(p))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/**
 * Which connected provider serves each capability.
 *
 * One per capability by construction — connecting a second replaces the first,
 * because two databases is not a richer setup, it's an unmade decision.
 */
export function providerByCapability(
  state: IntegrationState,
  providers: Provider[] = PROVIDERS,
): Map<Capability, Provider> {
  const out = new Map<Capability, Provider>();
  for (const p of connectedProviders(state, providers)) {
    if (!out.has(p.capability)) out.set(p.capability, p);
  }
  return out;
}
