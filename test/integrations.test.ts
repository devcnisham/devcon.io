import { describe, expect, it } from "vitest";
import { ALL_STEPS } from "@/lib/catalog";
import { CAPABILITY_ORDER, PROVIDERS } from "@/lib/catalog/providers";
import {
  EMPTY_INTEGRATIONS,
  connectedProviders,
  identityFromScan,
  providerByCapability,
} from "@/lib/integrations/store";
import { parseGitRemote } from "@/lib/scan/types";

describe("git remote parsing — what names the real repo", () => {
  it("reads the ssh form", () => {
    expect(parseGitRemote("git@github.com:devcnisham/devcon.io.git")).toEqual({
      host: "github.com",
      owner: "devcnisham",
      repo: "devcon.io",
      url: "https://github.com/devcnisham/devcon.io",
    });
  });

  it("reads the https form", () => {
    expect(parseGitRemote("https://gitlab.com/team/project.git")).toEqual({
      host: "gitlab.com",
      owner: "team",
      repo: "project",
      url: "https://gitlab.com/team/project",
    });
  });

  it("strips credentials rather than returning them", () => {
    /**
     * People do commit `https://user:token@host/…` into .git/config. The scan
     * reads that file, so this is the one place a real credential could reach
     * the UI. It has to be dropped, not displayed.
     */
    const r = parseGitRemote("https://someone:ghp_secret123@github.com/a/b.git");
    expect(r).toEqual({
      host: "github.com",
      owner: "a",
      repo: "b",
      url: "https://github.com/a/b",
    });
    expect(JSON.stringify(r)).not.toContain("ghp_secret123");
    expect(JSON.stringify(r)).not.toContain("someone");
  });

  it("rebuilds a browsable url rather than echoing the raw remote", () => {
    const r = parseGitRemote("git@github.com:a/b.git");
    expect(r?.url.startsWith("https://")).toBe(true);
  });

  it("returns null rather than guessing at something unparseable", () => {
    // A card naming the wrong repository is worse than one naming none.
    for (const junk of ["", "   ", "not-a-remote", "https://github.com"]) {
      expect(parseGitRemote(junk)).toBeNull();
    }
  });

  it("keeps a self-hosted host rather than assuming github", () => {
    expect(parseGitRemote("git@git.university.ac.uk:cs/project.git")?.host).toBe(
      "git.university.ac.uk",
    );
  });
});

describe("identity from a scan", () => {
  it("maps a github remote onto the github providers", () => {
    const id = identityFromScan(parseGitRemote("git@github.com:a/b.git"));
    expect(id).toEqual({ github: "a/b", "github-issues": "a/b" });
  });

  it("maps a gitlab remote onto gitlab, not github", () => {
    const id = identityFromScan(parseGitRemote("git@gitlab.com:a/b.git"));
    expect(id).toEqual({ gitlab: "a/b" });
    expect(id.github).toBeUndefined();
  });

  it("claims nothing for a host it doesn't recognise", () => {
    // Better an unlabelled card than a card asserting the wrong service.
    expect(identityFromScan(parseGitRemote("git@bitbucket.org:a/b.git"))).toEqual(
      {},
    );
  });

  it("claims nothing when there's no remote", () => {
    expect(identityFromScan(null)).toEqual({});
  });
});

describe("connected services", () => {
  const state = {
    ...EMPTY_INTEGRATIONS,
    connected: ["github", "supabase", "stripe"],
  };

  it("resolves ids back to providers", () => {
    expect(connectedProviders(state).map((p) => p.id)).toEqual([
      "supabase",
      "stripe",
      "github",
    ]);
  });

  it("ignores an id no longer in the catalog", () => {
    // A stored connection outlives a provider that gets renamed or dropped.
    // Dropping it silently beats rendering a node with no provider behind it.
    const stale = { ...EMPTY_INTEGRATIONS, connected: ["github", "gone"] };
    expect(connectedProviders(stale).map((p) => p.id)).toEqual(["github"]);
  });

  it("holds at most one provider per capability", () => {
    /**
     * Two providers of the SAME capability, because that is the only case that
     * distinguishes first-wins from last-wins. Mutation-testing caught this:
     * with three providers of three different capabilities, the assertion held
     * whatever the implementation did.
     *
     * Supabase and Neon are both `database`. The canvas draws one node per
     * capability, so if both survived, the same step would gain two service
     * edges claiming two databases — which is the unmade decision the whole
     * connect-replaces-sibling rule exists to prevent.
     */
    const twoDatabases = {
      ...EMPTY_INTEGRATIONS,
      connected: ["supabase", "neon", "github"],
    };
    const byCap = providerByCapability(twoDatabases);
    expect(byCap.size).toBe(2);
    expect(byCap.get("database")?.id).toBe("supabase");
    expect(byCap.get("version-control")?.id).toBe("github");
  });
});

describe("steps declare which capability they wire up", () => {
  it("names only real capabilities", () => {
    const valid = new Set(CAPABILITY_ORDER);
    const bad = ALL_STEPS.flatMap((s) =>
      (s.serves ?? [])
        .filter((c) => !valid.has(c))
        .map((c) => `${s.id} → ${c}`),
    );
    expect(bad).toEqual([]);
  });

  it("never puts a service on an anti-step", () => {
    // An anti-step is a thing not to do. It wires nothing up.
    const bad = ALL_STEPS.filter(
      (s) => s.kind === "avoid" && s.serves?.length,
    ).map((s) => s.id);
    expect(bad).toEqual([]);
  });

  it("covers every capability a provider exists for", () => {
    /**
     * A capability with providers but no step that serves it produces a
     * connected service the canvas draws with no edges — it looks connected to
     * nothing, which reads as a bug rather than as a gap in the catalog.
     */
    const served = new Set(ALL_STEPS.flatMap((s) => s.serves ?? []));
    const offered = new Set(PROVIDERS.map((p) => p.capability));
    const orphaned = [...offered].filter((c) => !served.has(c));
    expect(orphaned).toEqual(["project-management"]);
  });

  it("gives at least one step per major capability", () => {
    const served = ALL_STEPS.flatMap((s) => s.serves ?? []);
    for (const c of ["database", "auth", "payments", "email"] as const) {
      expect(served, `nothing serves ${c}`).toContain(c);
    }
  });
});
