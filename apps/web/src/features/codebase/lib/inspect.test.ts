import { describe, expect, it } from "vitest";
import { FILE_ROLES, classifyRole, inspectIndex } from "./inspect";

const role = (path: string) => classifyRole(path);

describe("package manifests", () => {
  it("recognises manifests across ecosystems", () => {
    for (const p of [
      "package.json",
      "Cargo.toml",
      "pyproject.toml",
      "go.mod",
      "Gemfile",
      "composer.json",
      "pom.xml",
    ]) {
      expect(role(p), p).toBe("package");
    }
  });

  it("recognises lockfiles", () => {
    for (const p of [
      "package-lock.json",
      "pnpm-lock.yaml",
      "Cargo.lock",
      "poetry.lock",
    ]) {
      expect(role(p), p).toBe("package");
    }
  });

  it("does not treat a nested package.json in a workspace as anything else", () => {
    expect(role("packages/ui/package.json")).toBe("package");
  });
});

describe("configuration", () => {
  it("recognises common config files", () => {
    for (const p of [
      "tsconfig.json",
      "next.config.ts",
      "eslint.config.mjs",
      "vitest.config.ts",
      "tailwind.config.js",
      ".prettierrc",
      "postcss.config.mjs",
    ]) {
      expect(role(p), p).toBe("config");
    }
  });
});

describe("environment files", () => {
  it("recognises every .env variant", () => {
    for (const p of [".env", ".env.local", ".env.production", ".env.example"]) {
      expect(role(p), p).toBe("env");
    }
  });

  it("does not classify an unrelated file starting with env", () => {
    expect(role("src/lib/env.ts")).not.toBe("env");
  });
});

describe("tests", () => {
  it("recognises test filenames", () => {
    for (const p of [
      "src/a.test.ts",
      "src/a.spec.tsx",
      "test_thing.py",
      "thing_test.go",
    ]) {
      expect(role(p), p).toBe("test");
    }
  });

  it("recognises test directories", () => {
    for (const p of ["tests/helper.ts", "__tests__/x.ts", "e2e/login.ts"]) {
      expect(role(p), p).toBe("test");
    }
  });

  it("prefers test over component for a component test", () => {
    expect(role("src/components/button.test.tsx")).toBe("test");
  });
});

describe("ci and containers", () => {
  it("recognises CI configuration", () => {
    for (const p of [
      ".github/workflows/ci.yml",
      ".gitlab-ci.yml",
      ".circleci/config.yml",
    ]) {
      expect(role(p), p).toBe("ci");
    }
  });

  it("recognises Docker files", () => {
    for (const p of [
      "Dockerfile",
      "docker-compose.yml",
      ".dockerignore",
      "api/Dockerfile",
    ]) {
      expect(role(p), p).toBe("docker");
    }
  });
});

describe("routes, components, and APIs", () => {
  it("recognises Next App Router pages and layouts", () => {
    expect(role("src/app/page.tsx")).toBe("route");
    expect(role("src/app/dashboard/layout.tsx")).toBe("route");
  });

  it("recognises a route handler as an API", () => {
    expect(role("src/app/api/health/route.ts")).toBe("api");
  });

  it("recognises the Pages Router", () => {
    expect(role("pages/about.tsx")).toBe("route");
    expect(role("pages/api/hello.ts")).toBe("api");
  });

  it("recognises components by directory", () => {
    expect(role("src/components/button.tsx")).toBe("component");
    expect(role("app/ui/card.tsx")).toBe("component");
  });

  it("treats a non-component file in a components directory as a component", () => {
    expect(role("src/components/index.ts")).toBe("component");
  });
});

describe("database and documentation", () => {
  it("recognises migrations and schemas", () => {
    for (const p of [
      "drizzle/0001_init.sql",
      "prisma/schema.prisma",
      "migrations/002_add_users.sql",
      "supabase/migrations/x.sql",
    ]) {
      expect(role(p), p).toBe("database");
    }
  });

  it("recognises documentation", () => {
    for (const p of ["README.md", "docs/guide.md", "CONTRIBUTING.md"]) {
      expect(role(p), p).toBe("docs");
    }
  });
});

describe("fallback", () => {
  it("treats unremarkable code as source", () => {
    expect(role("src/lib/util.ts")).toBe("source");
    expect(role("internal/server.go")).toBe("source");
  });

  it("returns a known role for every input", () => {
    for (const p of ["a", "a/b/c.xyz", "", "weird name.txt"]) {
      expect(FILE_ROLES).toContain(role(p));
    }
  });
});

describe("inspectIndex", () => {
  const index = [
    { path: "package.json", size: 800 },
    { path: "tsconfig.json", size: 400 },
    { path: ".env.local", size: 100 },
    { path: "README.md", size: 1200 },
    { path: "src/app/page.tsx", size: 900 },
    { path: "src/app/api/health/route.ts", size: 300 },
    { path: "src/components/button.tsx", size: 500 },
    { path: "src/lib/util.ts", size: 200 },
    { path: "src/lib/util.test.ts", size: 250 },
    { path: ".github/workflows/ci.yml", size: 700 },
    { path: "Dockerfile", size: 150 },
    { path: "drizzle/0001.sql", size: 600 },
  ];

  it("counts every file exactly once", () => {
    const summary = inspectIndex(index);
    const total = Object.values(summary.counts).reduce((a, b) => a + b, 0);

    expect(total).toBe(index.length);
  });

  it("reports totals", () => {
    const summary = inspectIndex(index);

    expect(summary.fileCount).toBe(12);
    expect(summary.totalBytes).toBe(index.reduce((a, f) => a + f.size, 0));
  });

  it("lists top-level folders", () => {
    expect(inspectIndex(index).topLevelFolders).toEqual([
      ".github",
      "drizzle",
      "src",
    ]);
  });

  it("flags that an environment file exists without reading it", () => {
    const summary = inspectIndex(index);

    expect(summary.hasEnvFile).toBe(true);
    expect(summary.envFiles).toEqual([".env.local"]);
  });

  it("notes a missing .env.example when a .env exists", () => {
    expect(inspectIndex(index).missingEnvExample).toBe(true);
  });

  it("does not flag a missing example when one is present", () => {
    const summary = inspectIndex([
      ...index,
      { path: ".env.example", size: 50 },
    ]);

    expect(summary.missingEnvExample).toBe(false);
  });

  it("reports whether the project has tests", () => {
    expect(inspectIndex(index).hasTests).toBe(true);
    expect(inspectIndex([{ path: "src/a.ts", size: 1 }]).hasTests).toBe(false);
  });

  it("reports whether CI is configured", () => {
    expect(inspectIndex(index).hasCi).toBe(true);
  });

  it("reports the most common extensions", () => {
    const top = inspectIndex(index).topExtensions;

    expect(top[0]).toMatchObject({ extension: "ts" });
  });

  it("handles an empty index without dividing by zero", () => {
    const summary = inspectIndex([]);

    expect(summary.fileCount).toBe(0);
    expect(summary.topExtensions).toEqual([]);
    expect(summary.hasTests).toBe(false);
  });
});
