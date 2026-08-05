import { beforeEach, describe, expect, it } from "vitest";
import { cmdAdd, cmdDoctor, cmdUpdate, findCycles } from "@/lib/registry/cli";
import { featureDetector } from "@/lib/registry/detect/feature";
import { type Feature, featureModule } from "@/lib/registry/modules/feature";
import { EMPTY_QUERY, byOrigin, runQuery } from "@/lib/registry/query";
import { mergeEntries, outranks, scanRegistry } from "@/lib/registry/scan";
import { feature, registered, resetRegistrations } from "@/lib/registry/sdk";
import { parseAnnotations } from "@/lib/registry/sources/annotations";
import { parseFeatureConfig } from "@/lib/registry/sources/config";
import { MemoryRegistryStore } from "@/lib/registry/store";
import { resolve, sameContent } from "@/lib/registry/sync";
import { memorySource } from "@/lib/scan/source";

const f = (over: Partial<Feature> & { name: string }) =>
  featureModule.hydrate(over);

describe("the module contract", () => {
  it("hydrates a bare name into a complete entry", () => {
    const entry = featureModule.hydrate({ name: "AI Chat" });
    expect(entry.id).toBe("ai-chat");
    expect(entry.status).toBe("planned");
    expect(entry.priority).toBe("medium");
    expect(entry.revision).toBe(1);
    expect(featureModule.validate(entry)).toEqual([]);
  });

  it("rejects a status that isn't in the lifecycle", () => {
    const bad = { ...f({ name: "X" }), status: "shipped" as Feature["status"] };
    expect(featureModule.validate(bad)).toContain(
      'status "shipped" is not one of planned, building, testing, completed, deprecated',
    );
  });

  it("refuses a detected entry with no evidence", () => {
    /**
     * The review UI shows evidence so a person can judge a suggestion. Without
     * it the only thing on screen is a name and a guess, which is exactly the
     * kind of assertion that makes a registry stop being trusted.
     */
    const noEvidence = { ...f({ name: "X" }), origin: "detected" as const, review: "suggested" as const };
    expect(featureModule.validate(noEvidence)).toContain(
      "detected but carries no evidence",
    );
  });

  it("refuses a review state on anything a person wrote", () => {
    const manual = { ...f({ name: "X" }), review: "accepted" as const };
    expect(featureModule.validate(manual)).toContain(
      "only detected entries carry a review state",
    );
  });

  it("catches a self-dependency", () => {
    const loop = f({ name: "Auth", dependsOn: ["auth"] });
    expect(featureModule.validate(loop)).toContain("depends on itself");
  });
});

describe("detection produces suggestions with reasons", () => {
  const detect = (over: Partial<Parameters<typeof featureDetector.detect>[0]>) =>
    featureDetector.detect({
      dependencies: [],
      files: [],
      envKeys: [],
      directories: [],
      ...over,
    });

  it("maps the dependencies the spec names", () => {
    const found = detect({
      dependencies: ["next-auth", "stripe", "socket.io", "openai"],
    });
    expect(found.map((e) => e.name).sort()).toEqual([
      "AI",
      "Authentication",
      "Payments",
      "Realtime",
    ]);
  });

  it("matches a scoped package by prefix", () => {
    // "@clerk/" must catch "@clerk/nextjs" without listing every package.
    const found = detect({ dependencies: ["@clerk/nextjs"] });
    expect(found.map((e) => e.name)).toContain("Authentication");
  });

  it("never emits anything but a suggestion", () => {
    const found = detect({ dependencies: ["stripe"], envKeys: ["STRIPE_SECRET_KEY"] });
    expect(found.every((e) => e.origin === "detected")).toBe(true);
    expect(found.every((e) => e.review === "suggested")).toBe(true);
  });

  it("carries the evidence it matched on", () => {
    const [found] = detect({ dependencies: ["stripe"], envKeys: ["STRIPE_SECRET_KEY"] });
    expect(found.evidence).toContain("dependency stripe");
    expect(found.evidence).toContain("env key STRIPE_SECRET_KEY");
  });

  it("treats a bare directory as weaker evidence than a dependency", () => {
    /**
     * `admin/` might be a single stub page; a dependency is a decision someone
     * made. The status and the tag are how the dashboard shows that difference.
     */
    const [pathOnly] = detect({ files: ["src/app/admin/page.tsx"] });
    expect(pathOnly.name).toBe("Admin Panel");
    expect(pathOnly.status).toBe("planned");
    expect(pathOnly.tags).toContain("low-confidence");

    const [strong] = detect({ dependencies: ["stripe"] });
    expect(strong.status).toBe("building");
    expect(strong.tags).not.toContain("low-confidence");
  });

  it("suggests nothing for an empty project", () => {
    expect(detect({})).toEqual([]);
  });

  it("is pure — same input, same output", () => {
    const input = { dependencies: ["stripe"], files: [], envKeys: [], directories: [] };
    const a = featureDetector.detect(input).map((e) => e.id);
    const b = featureDetector.detect(input).map((e) => e.id);
    expect(a).toEqual(b);
  });
});

describe("comment annotations", () => {
  it("reads a block with several tags", () => {
    const [hit] = parseAnnotations(
      "src/auth.ts",
      `/**
 * @feature Authentication
 * @status completed
 * @category Security
 * @owner nisham
 */
export function signIn() {}`,
    );
    expect(hit.feature.name).toBe("Authentication");
    expect(hit.feature.status).toBe("completed");
    expect(hit.feature.category).toBe("Security");
    expect(hit.feature.owner).toBe("nisham");
    expect(hit.feature.origin).toBe("annotated");
    expect(hit.line).toBe(2);
  });

  it("records the file it was found in", () => {
    const [hit] = parseAnnotations("src/pay.ts", "// @feature Payments");
    expect(hit.feature.files).toEqual(["src/pay.ts"]);
  });

  it("keeps two annotations in one file separate", () => {
    const hits = parseAnnotations(
      "src/x.ts",
      `// @feature Alpha\n// @feature Beta\n`,
    );
    expect(hits.map((h) => h.feature.name)).toEqual(["Alpha", "Beta"]);
  });

  it("stops a block at the end of the comment", () => {
    // Without this, tags from an unrelated comment below would be absorbed.
    const [hit] = parseAnnotations(
      "src/x.ts",
      `/**\n * @feature Alpha\n */\n/**\n * @status completed\n */`,
    );
    expect(hit.feature.status).toBe("planned");
  });

  it("finds nothing in a file with no annotations", () => {
    expect(parseAnnotations("src/x.ts", "const x = 1;")).toEqual([]);
  });
});

describe("the config file", () => {
  it("reads the shape the spec shows", () => {
    const { features } = parseFeatureConfig(
      "project.features.ts",
      `export default [
        { id:"auth", name:"Authentication", status:"completed" },
        { id:"pay", name:"Payments", status:"building" }
      ]`,
    );
    expect(features.map((f) => f.id)).toEqual(["auth", "pay"]);
    expect(features[0].origin).toBe("declared");
  });

  it("tolerates single quotes and trailing commas", () => {
    const { features } = parseFeatureConfig(
      "project.features.ts",
      `export default [{ id: 'auth', name: 'Auth', status: 'completed', },]`,
    );
    expect(features).toHaveLength(1);
    expect(features[0].status).toBe("completed");
  });

  it("warns rather than silently dropping an import it cannot resolve", () => {
    const { warnings } = parseFeatureConfig(
      "project.features.ts",
      `import { x } from "./x";\nexport default [{ name: "A" }]`,
    );
    expect(warnings.join(" ")).toMatch(/imports/);
  });

  it("reports a parse failure instead of returning nothing quietly", () => {
    const { features, warnings } = parseFeatureConfig(
      "project.features.ts",
      `export default [ { name: computeName() } ]`,
    );
    expect(features).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe("the SDK", () => {
  beforeEach(() => resetRegistrations());

  it("registers a feature", () => {
    feature({ id: "authentication", name: "Authentication", status: "completed" });
    const all = registered<Feature>("feature");
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe("completed");
    expect(all[0].origin).toBe("declared");
  });

  it("returns null instead of throwing on bad input", () => {
    /**
     * This runs at import time inside the user's application. A malformed call
     * must cost that entry, never the app that contains it.
     */
    expect(feature({ name: "" })).toBeNull();
    expect(feature(undefined as never)).toBeNull();
    expect(registered("feature")).toHaveLength(0);
  });

  it("does not duplicate on re-registration", () => {
    // A watch process re-imports modules; that must not double everything.
    feature({ id: "a", name: "A", status: "planned" });
    feature({ id: "a", name: "A", status: "completed" });
    const all = registered<Feature>("feature");
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe("completed");
  });
});

describe("merging sources", () => {
  it("ranks declared above annotated above detected", () => {
    expect(outranks("manual", "declared")).toBe(true);
    expect(outranks("declared", "annotated")).toBe(true);
    expect(outranks("annotated", "detected")).toBe(true);
    expect(outranks("detected", "manual")).toBe(false);
  });

  it("lets a declaration win over a guess", () => {
    const merged = mergeEntries([
      f({ name: "Auth", origin: "detected", review: "suggested", evidence: ["dependency next-auth"], status: "building" }),
      f({ name: "Auth", origin: "declared", status: "completed" }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].origin).toBe("declared");
    expect(merged[0].status).toBe("completed");
  });

  it("keeps the loser's evidence on the winner", () => {
    /**
     * The declaration wins, but the reason the detector fired is still the most
     * useful thing on screen when deciding whether the declaration is stale.
     */
    const merged = mergeEntries([
      f({ name: "Auth", origin: "detected", review: "suggested", evidence: ["dependency next-auth"], files: ["src/auth.ts"] }),
      f({ name: "Auth", origin: "declared" }),
    ]);
    expect(merged[0].evidence).toContain("dependency next-auth");
    expect(merged[0].files).toContain("src/auth.ts");
  });
});

describe("scanning a whole project", () => {
  it("finds all three registration methods at once", async () => {
    const source = memorySource({
      "package.json": JSON.stringify({ dependencies: { stripe: "1" } }),
      "project.features.ts": `export default [{ id:"teams", name:"Teams", status:"building" }]`,
      "src/notify.ts": "/**\n * @feature Notifications\n * @status testing\n */\n",
    });

    const result = await scanRegistry(source, {
      dependencies: ["stripe"],
      envKeys: [],
      directories: [],
    });

    const byId = new Map(result.entries.map((e) => [e.id, e]));
    expect(byId.get("teams")?.origin).toBe("declared");
    expect(byId.get("notifications")?.origin).toBe("annotated");
    expect(byId.get("payments")?.origin).toBe("detected");
    expect(result.stats).toMatchObject({ declared: 1, annotated: 1 });
  });

  it("never reads .env, even hunting for annotations", async () => {
    const source = memorySource({
      ".env": "SECRET=/**\n * @feature Leaked\n */",
      "package.json": "{}",
    });
    const result = await scanRegistry(source, {
      dependencies: [],
      envKeys: [],
      directories: [],
    });
    expect(result.entries.map((e) => e.id)).not.toContain("leaked");
  });
});

describe("query", () => {
  const entries = [
    f({ name: "Auth", status: "completed", category: "Security", tags: ["core"] }),
    f({ name: "Payments", status: "building", category: "Commerce", tags: ["core"] }),
    f({ name: "Admin", status: "planned", category: "Product", tags: [] }),
  ];

  it("treats an empty filter as no constraint, not as match-nothing", () => {
    expect(runQuery(entries, EMPTY_QUERY)).toHaveLength(3);
  });

  it("searches name, category and tags", () => {
    expect(runQuery(entries, { ...EMPTY_QUERY, text: "commerce" })).toHaveLength(1);
    expect(runQuery(entries, { ...EMPTY_QUERY, text: "core" })).toHaveLength(2);
  });

  it("sorts status by lifecycle position, not alphabetically", () => {
    /**
     * Alphabetically "building" precedes "completed" precedes "planned", which
     * happens to look plausible and is not the lifecycle. Ordering by the
     * declared array is what makes it right — and what stops it silently
     * breaking when a status is renamed.
     */
    const sorted = runQuery(
      entries,
      { ...EMPTY_QUERY, sort: "status", direction: "asc" },
      featureModule.statuses,
    );
    expect(sorted.map((e) => e.status)).toEqual([
      "planned",
      "building",
      "completed",
    ]);
  });

  it("is stable when the sort key ties", () => {
    const tied = [f({ name: "B", status: "planned" }), f({ name: "A", status: "planned" })];
    const once = runQuery(tied, { ...EMPTY_QUERY, sort: "status" }, featureModule.statuses);
    const twice = runQuery([...tied].reverse(), { ...EMPTY_QUERY, sort: "status" }, featureModule.statuses);
    expect(once.map((e) => e.id)).toEqual(twice.map((e) => e.id));
  });

  it("separates a suggestion from an accepted entry", () => {
    const groups = byOrigin([
      f({ name: "A", origin: "detected", review: "suggested", evidence: ["x"] }),
      f({ name: "B", origin: "detected", review: "accepted", evidence: ["x"] }),
      f({ name: "C", origin: "manual" }),
    ]);
    expect(groups.suggested.map((e) => e.name)).toEqual(["A"]);
    expect(groups.accepted.map((e) => e.name)).toEqual(["B"]);
    expect(groups.manual.map((e) => e.name)).toEqual(["C"]);
  });
});

describe("the store records what changed", () => {
  let store: MemoryRegistryStore;
  beforeEach(() => {
    store = new MemoryRegistryStore();
  });

  it("bumps the revision on a real change", async () => {
    const a = await store.put("p", f({ name: "Auth" }), "user");
    const b = await store.put("p", { ...a, status: "completed" }, "user");
    expect(b.revision).toBe(a.revision + 1);
  });

  it("does NOT bump when nothing actually changed", async () => {
    /**
     * A scan re-writes every entry it finds. If an identical write bumped the
     * revision, the sync engine would see work to push on every scan forever.
     */
    const a = await store.put("p", f({ name: "Auth" }), "scanner");
    const b = await store.put("p", a, "scanner");
    expect(b.revision).toBe(a.revision);
  });

  it("keeps the original createdAt across updates", async () => {
    /**
     * The createdAt is set explicitly to a date in the past. Letting the store
     * assign it meant both writes landed in the same millisecond, so the
     * assertion held whether the field was preserved or overwritten —
     * mutation-testing caught exactly that.
     */
    const born = "2020-01-01T00:00:00.000Z";
    const a = await store.put("p", f({ name: "Auth", createdAt: born }), "user");
    const b = await store.put("p", { ...a, status: "testing" }, "user");
    expect(a.createdAt).toBe(born);
    expect(b.createdAt).toBe(born);
  });

  it("records a diff, not a snapshot", async () => {
    const a = await store.put("p", f({ name: "Auth" }), "user");
    await store.put("p", { ...a, status: "completed" }, "user");
    const [latest] = await store.history("p", "feature", a.id);
    expect(latest.changes?.status).toEqual(["planned", "completed"]);
  });

  it("distinguishes accepting a suggestion from any other edit", async () => {
    const a = await store.put(
      "p",
      f({ name: "Auth", origin: "detected", review: "suggested", evidence: ["x"] }),
      "scanner",
    );
    await store.put("p", { ...a, review: "accepted" }, "user");
    const [latest] = await store.history("p", "feature", a.id);
    expect(latest.kind).toBe("accepted");
  });
});

describe("sync resolves without trusting clocks", () => {
  it("gives the win to the higher revision", () => {
    const local = { ...f({ name: "A" }), revision: 3 };
    const remote = { ...f({ name: "A" }), revision: 2 };
    expect(resolve(local, remote)).toBe("local");
    expect(resolve(remote, local)).toBe("remote");
  });

  it("calls equal revisions with different content a real conflict", () => {
    /**
     * Both sides edited from the same base. Picking one silently discards work
     * someone did — this is the case that has to reach a person.
     */
    const local = { ...f({ name: "A" }), status: "completed" as const, revision: 2 };
    const remote = { ...f({ name: "A" }), status: "deprecated" as const, revision: 2 };
    expect(resolve(local, remote)).toBe("manual");
  });

  it("is not a conflict when the content is identical", () => {
    const entry = f({ name: "A" });
    expect(resolve({ ...entry, revision: 2 }, { ...entry, revision: 2 })).toBe("remote");
  });

  it("ignores timestamps when comparing content", () => {
    // Two machines writing the same edit produce different updatedAt values.
    // Treating that as a difference would manufacture conflicts out of nothing.
    const entry = f({ name: "A" });
    expect(
      sameContent(
        { ...entry, updatedAt: "2020-01-01T00:00:00.000Z" },
        { ...entry, updatedAt: "2026-01-01T00:00:00.000Z" },
      ),
    ).toBe(true);
  });
});

describe("the CLI", () => {
  let store: MemoryRegistryStore;
  beforeEach(() => {
    store = new MemoryRegistryStore();
  });

  it("adds a feature as manual, so no scan overwrites it", async () => {
    const result = await cmdAdd(store, "p", { name: "Admin Panel" });
    expect(result.ok).toBe(true);
    const stored = await store.get<Feature>("p", "feature", "admin-panel");
    expect(stored?.origin).toBe("manual");
  });

  it("refuses to add over an existing id", async () => {
    await cmdAdd(store, "p", { name: "Admin" });
    const again = await cmdAdd(store, "p", { name: "Admin" });
    expect(again.ok).toBe(false);
    expect(again.lines.join(" ")).toMatch(/already exists/);
  });

  it("will not let an update move an entry's id", async () => {
    await cmdAdd(store, "p", { name: "Admin" });
    await cmdUpdate(store, "p", "admin", { id: "moved" } as Partial<Feature>);
    expect(await store.get("p", "feature", "moved")).toBeNull();
    expect(await store.get("p", "feature", "admin")).not.toBeNull();
  });

  it("reports an unregistered dependency", async () => {
    await store.put("p", f({ name: "A", dependsOn: ["ghost"] }), "cli");
    const result = await cmdDoctor(store, "p");
    expect(result.ok).toBe(false);
    expect(result.lines.join(" ")).toMatch(/ghost/);
  });

  it("reports suggestions still awaiting review", async () => {
    await store.put(
      "p",
      f({ name: "A", origin: "detected", review: "suggested", evidence: ["x"] }),
      "scanner",
    );
    const result = await cmdDoctor(store, "p");
    expect(result.lines.join(" ")).toMatch(/awaiting review/);
  });

  it("finds a dependency cycle", () => {
    const cycles = findCycles([
      f({ name: "A", id: "a", dependsOn: ["b"] }),
      f({ name: "B", id: "b", dependsOn: ["a"] }),
    ]);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("says nothing is wrong when nothing is", async () => {
    await cmdAdd(store, "p", { name: "Admin", owner: "nisham" });
    const result = await cmdDoctor(store, "p");
    expect(result.ok).toBe(true);
  });
});
