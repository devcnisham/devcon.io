import { describe, expect, it } from "vitest";
import { profileFromDigest } from "@/lib/scan/profile";
import type { RepoDigest } from "@/lib/scan/types";

/**
 * Scanner tests operate on synthetic digests.
 *
 * The route that walks the filesystem is thin; the judgement lives in
 * `profileFromDigest` — which signals mean which needs, which markers mean
 * work is already done, and which track this is. That's pure, so it's the
 * part worth testing.
 */
function digest(over: Partial<RepoDigest> = {}): RepoDigest {
  return {
    root: "/tmp/x",
    name: "x",
    dependencies: [],
    devDependencies: [],
    workspaces: 0,
    scripts: [],
    configFiles: [],
    directories: [],
    envKeys: [],
    migrations: [],
    fileCount: 50,
    hasGit: true,
    hasReadme: true,
    hasTests: false,
    skipped: [],
    markers: {
      authWired: false,
      webhookRoutes: [],
      webhookSignatureVerified: false,
      hasLegalPages: false,
      hasErrorMonitoring: false,
      hasRateLimit: false,
      hasSubscriptionModel: false,
      schemaModels: 0,
      migrationCount: 0,
      apiRoutes: 0,
    },
    ...over,
  };
}

describe("needs detection", () => {
  it("reads dependency names", () => {
    const { profile } = profileFromDigest(
      digest({ dependencies: ["@clerk/nextjs", "stripe"] }),
    );
    expect(profile.needs.auth).toBe(true);
    expect(profile.needs.payments).toBe(true);
  });

  it("reads env key names too", () => {
    /**
     * The signal that matters most on a monorepo, where the root
     * package.json is nearly empty. STRIPE_SECRET_KEY is a harder fact about
     * intent than a package appearing in a lockfile.
     */
    const { profile } = profileFromDigest(
      digest({ envKeys: ["CLERK_SECRET_KEY", "ANTHROPIC_API_KEY"] }),
    );
    expect(profile.needs.auth).toBe(true);
    expect(profile.needs.ai).toBe(true);
  });

  it("infers personal data from the presence of auth", () => {
    const { profile } = profileFromDigest(
      digest({ envKeys: ["CLERK_SECRET_KEY"] }),
    );
    expect(profile.needs.handles_pii).toBe(true);
  });

  it("claims nothing when there is nothing to claim", () => {
    const { profile } = profileFromDigest(digest());
    expect(Object.values(profile.needs).every((v) => v === false)).toBe(true);
  });

  it("records evidence for every inference", () => {
    // Nothing may be concluded without a stated basis — the profile screen
    // shows these, and an unexplained inference is one the user can't correct.
    const { evidence } = profileFromDigest(
      digest({ envKeys: ["STRIPE_SECRET_KEY"] }),
    );
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.every((e) => e.because.trim().length > 0)).toBe(true);
  });
});

describe("track inference", () => {
  it("calls a project with payments commercial", () => {
    const { profile } = profileFromDigest(
      digest({ envKeys: ["STRIPE_SECRET_KEY"] }),
    );
    expect(profile.context).toBe("commercial");
  });

  it("calls a project with error monitoring commercial", () => {
    const { profile } = profileFromDigest(
      digest({ envKeys: ["SENTRY_AUTH_TOKEN"] }),
    );
    expect(profile.context).toBe("commercial");
  });

  it("defaults to academic when there is no commercial signal", () => {
    const { profile } = profileFromDigest(
      digest({ dependencies: ["next", "react"] }),
    );
    expect(profile.context).toBe("academic");
  });
});

describe("completion detection", () => {
  const done = (d: RepoDigest) =>
    profileFromDigest(d).alreadyDone.map((x) => x.stepId);

  it("marks auth done when middleware is wired", () => {
    expect(
      done(digest({ markers: { ...digest().markers, authWired: true } })),
    ).toContain("c-auth");
  });

  it("marks the data model done given models and migrations", () => {
    const d = digest({
      markers: { ...digest().markers, schemaModels: 80, migrationCount: 10 },
    });
    expect(done(d)).toContain("c-data-model");
  });

  it("marks webhooks done only when signatures are verified", () => {
    const base = digest().markers;
    const unverified = digest({
      markers: { ...base, webhookRoutes: ["stripe"] },
    });
    const verified = digest({
      markers: {
        ...base,
        webhookRoutes: ["stripe"],
        webhookSignatureVerified: true,
      },
    });
    // A webhook route that doesn't verify signatures is not a finished
    // webhook step — that's the whole point of the step.
    expect(done(unverified)).not.toContain("c-payments-webhooks");
    expect(done(verified)).toContain("c-payments-webhooks");
  });

  it("claims nothing on an empty repo", () => {
    expect(done(digest())).toEqual([]);
  });

  it("is conservative — never marks a step done without a marker", () => {
    /**
     * A false "done" hides real work, which is strictly worse than a false
     * "todo" the user can tick themselves. Every claim must trace to a marker.
     */
    const everything = digest({
      markers: {
        authWired: true,
        webhookRoutes: ["stripe", "clerk"],
        webhookSignatureVerified: true,
        hasLegalPages: true,
        hasErrorMonitoring: true,
        hasRateLimit: true,
        hasSubscriptionModel: true,
        schemaModels: 80,
        migrationCount: 10,
        apiRoutes: 200,
      },
      envKeys: ["A", "B", "C", "D", "E", "F"],
    });
    const ids = done(everything);
    // AI metering and backups have no marker, so they must never be claimed.
    expect(ids).not.toContain("c-ai-metering");
    expect(ids).not.toContain("c-backups");
    expect(ids).not.toContain("c-secrets-audit");
  });

  it("gives every completion claim a reason", () => {
    const { alreadyDone } = profileFromDigest(
      digest({ markers: { ...digest().markers, authWired: true } }),
    );
    expect(alreadyDone.every((d) => d.because.trim().length > 0)).toBe(true);
  });
});

describe("monorepo handling", () => {
  it("treats many workspaces as a team project", () => {
    const { profile } = profileFromDigest(digest({ workspaces: 5 }));
    expect(profile.builder.solo_or_team).toBe("team");
  });

  it("treats a single package as solo", () => {
    const { profile } = profileFromDigest(digest({ workspaces: 0 }));
    expect(profile.builder.solo_or_team).toBe("solo");
  });
});
