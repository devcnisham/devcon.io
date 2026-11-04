import { describe, expect, it } from "vitest";
import { mergeDependencies, parseManifest } from "./dependencies";
import {
  detectArchitecture,
  detectFeatures,
  detectFrameworks,
  confidenceLabel,
} from "./detect";

const deps = (json: Record<string, unknown>) =>
  mergeDependencies([parseManifest("package.json", JSON.stringify(json))!]);

describe("detectFrameworks", () => {
  it("finds Next.js from a dependency alone, with low confidence", () => {
    const [found] = detectFrameworks({
      dependencies: deps({ dependencies: { next: "16" } }),
      paths: [],
    });

    expect(found.id).toBe("nextjs");
    expect(found.confidence).toBeLessThan(0.8);
  });

  it("raises confidence when config and layout agree", () => {
    const weak = detectFrameworks({
      dependencies: deps({ dependencies: { next: "16" } }),
      paths: [],
    })[0];

    const strong = detectFrameworks({
      dependencies: deps({ dependencies: { next: "16" } }),
      paths: ["next.config.ts", "src/app/page.tsx", "src/app/layout.tsx"],
    })[0];

    expect(strong.confidence).toBeGreaterThan(weak.confidence);
    expect(strong.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("lists the evidence behind a conclusion", () => {
    const [found] = detectFrameworks({
      dependencies: deps({ dependencies: { next: "16" } }),
      paths: ["next.config.ts"],
    });

    expect(found.evidence.length).toBeGreaterThanOrEqual(2);
    expect(found.evidence.join(" ")).toMatch(/next\.config/);
  });

  it("never reports a framework with no evidence at all", () => {
    expect(
      detectFrameworks({ dependencies: deps({}), paths: ["README.md"] })
    ).toEqual([]);
  });

  it("caps confidence at 1", () => {
    const [found] = detectFrameworks({
      dependencies: deps({ dependencies: { next: "16", react: "19" } }),
      paths: [
        "next.config.ts",
        "app/page.tsx",
        "app/layout.tsx",
        "app/api/x/route.ts",
      ],
    });

    expect(found.confidence).toBeLessThanOrEqual(1);
  });

  it("distinguishes Django from Flask", () => {
    const django = detectFrameworks({
      dependencies: mergeDependencies([
        parseManifest("requirements.txt", "django==5.0\n")!,
      ]),
      paths: ["manage.py"],
    });

    expect(django[0].id).toBe("django");
  });

  it("orders results by confidence, strongest first", () => {
    const found = detectFrameworks({
      dependencies: deps({ dependencies: { next: "16", express: "4" } }),
      paths: ["next.config.ts", "app/page.tsx"],
    });

    const scores = found.map((f) => f.confidence);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("reports React without Next when there is no Next signal", () => {
    const found = detectFrameworks({
      dependencies: deps({ dependencies: { react: "19" } }),
      paths: ["src/components/app.tsx"],
    });

    expect(found.map((f) => f.id)).toContain("react");
    expect(found.map((f) => f.id)).not.toContain("nextjs");
  });
});

describe("detectArchitecture", () => {
  it("recognises a monorepo from workspace folders", () => {
    const result = detectArchitecture({
      paths: [
        "packages/ui/package.json",
        "packages/api/package.json",
        "package.json",
      ],
      manifestCount: 3,
    });

    expect(result.style).toBe("monorepo");
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it("recognises a single application", () => {
    const result = detectArchitecture({
      paths: ["src/app/page.tsx", "package.json"],
      manifestCount: 1,
    });

    expect(result.style).toBe("single-app");
  });

  it("notices a layered src structure", () => {
    const result = detectArchitecture({
      paths: [
        "src/features/auth/index.ts",
        "src/features/billing/index.ts",
        "src/lib/db.ts",
      ],
      manifestCount: 1,
    });

    expect(result.layering).toBe("feature-first");
  });

  it("notices a type-first structure", () => {
    const result = detectArchitecture({
      paths: [
        "src/controllers/user.ts",
        "src/models/user.ts",
        "src/views/user.ts",
      ],
      manifestCount: 1,
    });

    expect(result.layering).toBe("layer-first");
  });

  it("says unknown rather than guessing on a bare project", () => {
    const result = detectArchitecture({ paths: ["main.py"], manifestCount: 0 });

    expect(result.layering).toBe("unknown");
  });
});

describe("detectFeatures", () => {
  it("detects authentication from a dependency", () => {
    const found = detectFeatures({
      dependencies: deps({ dependencies: { "next-auth": "5" } }),
      paths: [],
    });

    expect(found.map((f) => f.id)).toContain("auth");
  });

  it("detects authentication from route names alone", () => {
    const found = detectFeatures({
      dependencies: deps({}),
      paths: ["src/app/login/page.tsx", "src/app/signup/page.tsx"],
    });

    expect(found.map((f) => f.id)).toContain("auth");
  });

  it("detects payments", () => {
    const found = detectFeatures({
      dependencies: deps({ dependencies: { stripe: "14" } }),
      paths: [],
    });

    expect(found.map((f) => f.id)).toContain("payments");
  });

  it("detects realtime and uploads", () => {
    const found = detectFeatures({
      dependencies: deps({ dependencies: { "socket.io": "4", multer: "1" } }),
      paths: [],
    });

    const ids = found.map((f) => f.id);
    expect(ids).toContain("realtime");
    expect(ids).toContain("uploads");
  });

  it("finds nothing in an empty project rather than inventing features", () => {
    expect(detectFeatures({ dependencies: deps({}), paths: [] })).toEqual([]);
  });

  it("gives every feature a confidence and evidence", () => {
    const found = detectFeatures({
      dependencies: deps({ dependencies: { stripe: "14" } }),
      paths: ["src/app/checkout/page.tsx"],
    });

    for (const feature of found) {
      expect(feature.confidence).toBeGreaterThan(0);
      expect(feature.confidence).toBeLessThanOrEqual(1);
      expect(feature.evidence.length).toBeGreaterThan(0);
    }
  });
});

describe("confidenceLabel", () => {
  it("describes a score in words a beginner understands", () => {
    expect(confidenceLabel(0.95)).toBe("certain");
    expect(confidenceLabel(0.75)).toBe("likely");
    expect(confidenceLabel(0.45)).toBe("possible");
    expect(confidenceLabel(0.1)).toBe("a guess");
  });

  it("covers the whole range", () => {
    for (const score of [0, 0.25, 0.5, 0.75, 1]) {
      expect(typeof confidenceLabel(score)).toBe("string");
    }
  });
});
