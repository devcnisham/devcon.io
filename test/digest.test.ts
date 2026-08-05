import { describe, expect, it } from "vitest";
import { buildDigest } from "@/lib/scan/digest";
import { isIgnored, isReadable, memorySource } from "@/lib/scan/source";
import { droppedCoverage } from "@/lib/scan/sources/dropped";
import { parseRepoInput } from "@/lib/scan/sources/github";

/**
 * The digest builder against an in-memory source.
 *
 * All four ingest paths — folder picker, file drop, public GitHub, local dev
 * route — run this same function. Testing it here tests all of them, which is
 * the point of the source interface: four scanners drifting apart is exactly
 * what it exists to prevent.
 */
const REPO = {
  "package.json": JSON.stringify({
    name: "acme",
    dependencies: { next: "1", "@clerk/nextjs": "1", stripe: "1" },
    devDependencies: { vitest: "1" },
    scripts: { dev: "next dev", build: "next build" },
  }),
  ".env.example": "# comment\nSTRIPE_SECRET_KEY=\nCLERK_SECRET_KEY=sk_test_leaked\n\nDATABASE_URL=",
  ".env": "STRIPE_SECRET_KEY=sk_live_realsecret",
  "README.md": "# acme",
  "src/middleware.ts": "export default clerkMiddleware();",
  "src/app/api/webhooks/stripe/route.ts": "constructEvent(body, sig, secret)",
  "src/app/api/users/route.ts": "export async function GET() {}",
  "src/app/privacy/page.tsx": "export default function P() {}",
  "src/app/terms/page.tsx": "export default function T() {}",
  "prisma/schema.prisma": "model User {}\nmodel Subscription {}\nmodel Post {}",
  "prisma/migrations/20240101_init/migration.sql": "CREATE TABLE users;",
  "prisma/migrations/20240202_add/migration.sql": "ALTER TABLE users;",
  // A second file in one migration, so counting files and counting directories
  // give DIFFERENT answers. With one file each they agree, and the assertion
  // below passes whichever the implementation does — mutation-testing caught
  // exactly that.
  "prisma/migrations/20240202_add/down.sql": "DROP TABLE users;",
  "node_modules/junk/index.js": "should never be listed",
  "test/thing.test.ts": "it('works')",
};

const source = memorySource(REPO, "acme");

describe("the digest reads structure, never secrets", () => {
  it("reads key NAMES from .env.example and no values", async () => {
    const d = await buildDigest(source);
    expect(d.envKeys).toEqual([
      "STRIPE_SECRET_KEY",
      "CLERK_SECRET_KEY",
      "DATABASE_URL",
    ]);
    // The example file has a value committed into it — a real and common
    // mistake. Names only means the value never reaches the digest.
    expect(JSON.stringify(d)).not.toContain("sk_test_leaked");
  });

  it("refuses to read .env at all, and says that it did", async () => {
    const d = await buildDigest(source);
    expect(JSON.stringify(d)).not.toContain("sk_live_realsecret");
    // Reported rather than silently omitted — the UI is honest about the gap.
    expect(d.skipped.some((s) => s.startsWith(".env "))).toBe(true);
  });

  it("blocks .env variants by name, whatever a source offers", () => {
    expect(isReadable(".env")).toBe(false);
    expect(isReadable("frontend/.env.local")).toBe(false);
    expect(isReadable("apps/web/.env.production")).toBe(false);
    // The example file is the one that IS read.
    expect(isReadable(".env.example")).toBe(true);
  });

  it("returns null for a blocked path even when the source holds it", async () => {
    expect(await source.read(".env")).toBeNull();
    expect(await source.read(".env.example")).not.toBeNull();
  });
});

describe("what the digest infers", () => {
  it("names dependencies without versions", async () => {
    const d = await buildDigest(source);
    expect(d.dependencies).toEqual(["@clerk/nextjs", "next", "stripe"]);
    expect(JSON.stringify(d.dependencies)).not.toContain("1");
  });

  it("counts migration DIRECTORIES, not migration files", async () => {
    /**
     * Prisma writes one directory per migration with a single .sql inside.
     * Counting files gives the same number here, but stops agreeing the moment
     * a migration has two files — and this number drives whether the plan
     * thinks the schema is established.
     */
    const d = await buildDigest(source);
    expect(d.markers.migrationCount).toBe(2);
  });

  it("finds evidence that work is already done", async () => {
    const d = await buildDigest(source);
    expect(d.markers.authWired).toBe(true);
    expect(d.markers.webhookRoutes).toEqual(["stripe"]);
    expect(d.markers.webhookSignatureVerified).toBe(true);
    expect(d.markers.hasLegalPages).toBe(true);
    expect(d.markers.schemaModels).toBe(3);
    expect(d.markers.hasSubscriptionModel).toBe(true);
    expect(d.markers.apiRoutes).toBe(2);
  });

  it("excludes ignored directories from the listing", async () => {
    const d = await buildDigest(source);
    expect(d.fileCount).toBe(Object.keys(REPO).length - 1); // node_modules dropped
    expect(d.directories).not.toContain("node_modules");
  });

  it("ignores a directory at any depth, not just the root", () => {
    expect(isIgnored("apps/web/node_modules/x/index.js")).toBe(true);
    expect(isIgnored("src/app/page.tsx")).toBe(false);
    // A file merely NAMED like an ignored directory still counts.
    expect(isIgnored("src/dist/bundle.js")).toBe(true);
  });

  it("reports no remote when the source has none", async () => {
    const d = await buildDigest(source);
    expect(d.gitRemote).toBeNull();
    expect(d.hasGit).toBe(false);
  });

  it("takes the remote from a source that has one", async () => {
    const withGit = {
      ...memorySource(REPO, "acme"),
      remote: async () => "git@github.com:acme/acme.git",
    };
    const d = await buildDigest(withGit);
    expect(d.gitRemote?.url).toBe("https://github.com/acme/acme");
    expect(d.hasGit).toBe(true);
  });
});

describe("github repo input", () => {
  it("accepts the forms a person actually pastes", () => {
    for (const input of [
      "vercel/next.js",
      "https://github.com/vercel/next.js",
      "github.com/vercel/next.js",
      "https://github.com/vercel/next.js.git",
      "  https://github.com/vercel/next.js/tree/canary  ",
    ]) {
      expect(parseRepoInput(input), input).toEqual({
        owner: "vercel",
        repo: "next.js",
      });
    }
  });

  it("rejects what it cannot resolve rather than guessing", () => {
    for (const junk of ["", "next.js", "https://gitlab.com/a/b", "   "]) {
      expect(parseRepoInput(junk), junk).toBeNull();
    }
  });
});

describe("a file drop is honest about what it can see", () => {
  const file = (name: string, relPath?: string): File => {
    const f = new File(["x"], name);
    if (relPath) {
      Object.defineProperty(f, "webkitRelativePath", { value: relPath });
    }
    return f;
  };

  it("calls a couple of loose files manifest-only", () => {
    // No directory tree means completion detection finds nothing, so every step
    // reports as not-started. The UI has to say that rather than quietly
    // producing a worse plan.
    expect(droppedCoverage([file("package.json"), file(".env.example")])).toBe(
      "manifest-only",
    );
  });

  it("calls a directory drop full", () => {
    expect(
      droppedCoverage([file("package.json", "acme/package.json")]),
    ).toBe("full");
  });
});
