import { describe, expect, it } from "vitest";
import { parseManifest } from "./dependencies";
import { detectToolchain } from "./toolchain";

const pkg = (json: Record<string, unknown>) =>
  parseManifest("package.json", JSON.stringify(json))!;

const run = (
  paths: string[],
  manifests = [] as ReturnType<typeof pkg>[],
  runtimeIds: string[] = ["node"]
) => detectToolchain({ paths, manifests, runtimeIds });

describe("package manager", () => {
  it("identifies npm from its lockfile", () => {
    const { packageManager } = run(["package.json", "package-lock.json"]);

    expect(packageManager?.name).toBe("npm");
    expect(packageManager?.lockFile).toBe("package-lock.json");
  });

  it("identifies pnpm, yarn, and bun from their lockfiles", () => {
    expect(run(["pnpm-lock.yaml"]).packageManager?.name).toBe("pnpm");
    expect(run(["yarn.lock"]).packageManager?.name).toBe("yarn");
    expect(run(["bun.lockb"]).packageManager?.name).toBe("bun");
  });

  it("prefers the declared packageManager field over a lockfile", () => {
    const { packageManager } = run(
      ["package.json", "package-lock.json"],
      [pkg({ packageManager: "pnpm@9.0.0" })]
    );

    expect(packageManager?.name).toBe("pnpm");
    expect(packageManager?.evidence.join(" ")).toMatch(/packageManager/);
  });

  it("flags conflicting lockfiles rather than picking silently", () => {
    const { packageManager } = run(["package-lock.json", "pnpm-lock.yaml"]);

    expect(packageManager?.conflict).toBe(true);

    // Which one "wins" is exactly what is ambiguous, so the useful guarantee
    // is that both are surfaced rather than one being quietly dropped.
    const reported = [
      packageManager?.lockFile,
      ...(packageManager?.otherLockFiles ?? []),
    ];
    expect(reported).toContain("package-lock.json");
    expect(reported).toContain("pnpm-lock.yaml");
  });

  it("does not flag a conflict when only one lockfile exists", () => {
    expect(run(["package-lock.json"]).packageManager?.conflict).toBe(false);
  });

  it("identifies non-Node package managers", () => {
    expect(run(["poetry.lock"], [], ["python"]).packageManager?.name).toBe(
      "poetry"
    );
    expect(run(["Cargo.lock"], [], ["rust"]).packageManager?.name).toBe(
      "cargo"
    );
    expect(run(["composer.lock"], [], ["php"]).packageManager?.name).toBe(
      "composer"
    );
    expect(run(["go.sum"], [], ["go"]).packageManager?.name).toBe("go modules");
  });

  it("returns null when nothing indicates one", () => {
    expect(run([]).packageManager).toBeNull();
  });
});

describe("lock file", () => {
  it("names the lock file", () => {
    expect(run(["pnpm-lock.yaml"]).lockFile).toBe("pnpm-lock.yaml");
  });

  it("is null when the project has none", () => {
    expect(run(["package.json"]).lockFile).toBeNull();
  });

  it("finds a lockfile in a subdirectory", () => {
    expect(run(["apps/web/package-lock.json"]).lockFile).toBe(
      "apps/web/package-lock.json"
    );
  });
});

describe("runtime configuration", () => {
  it("lists the files that configure the runtime", () => {
    const { runtimeConfig } = run([
      "tsconfig.json",
      "next.config.ts",
      ".nvmrc",
      "src/index.ts",
    ]);

    expect(runtimeConfig).toContain("tsconfig.json");
    expect(runtimeConfig).toContain(".nvmrc");
  });

  it("does not list ordinary source files", () => {
    expect(run(["src/index.ts"]).runtimeConfig).toEqual([]);
  });
});

describe("commands from declared scripts", () => {
  const manifest = pkg({
    scripts: { build: "next build", dev: "next dev", start: "next start" },
  });

  it("uses the build script", () => {
    const { commands } = run(["package.json", "package-lock.json"], [manifest]);

    expect(commands.build?.command).toBe("npm run build");
    expect(commands.build?.source).toBe("script");
  });

  it("uses the correct package manager in the command", () => {
    const { commands } = run(["package.json", "pnpm-lock.yaml"], [manifest]);

    expect(commands.build?.command).toBe("pnpm run build");
  });

  it("uses the dev script for development", () => {
    const { commands } = run(["package.json", "package-lock.json"], [manifest]);

    expect(commands.dev?.command).toBe("npm run dev");
  });

  it("uses start for production", () => {
    const { commands } = run(["package.json", "package-lock.json"], [manifest]);

    expect(commands.production?.command).toBe("npm run start");
  });

  it("prefers serve over start for development when there is no dev script", () => {
    const { commands } = run(
      ["package.json"],
      [pkg({ scripts: { serve: "vite preview" } })]
    );

    expect(commands.dev?.command).toBe("npm run serve");
  });
});

describe("commands from convention", () => {
  it("falls back to a Go build command", () => {
    const { commands } = run(["go.mod"], [], ["go"]);

    expect(commands.build?.command).toBe("go build ./...");
    expect(commands.build?.source).toBe("convention");
  });

  it("falls back to Cargo commands", () => {
    const { commands } = run(["Cargo.toml"], [], ["rust"]);

    expect(commands.build?.command).toBe("cargo build --release");
    expect(commands.dev?.command).toBe("cargo run");
  });

  it("suggests the Django development server", () => {
    const { commands } = run(["manage.py"], [], ["python"]);

    expect(commands.dev?.command).toContain("manage.py runserver");
  });

  it("marks convention-derived commands as such", () => {
    const { commands } = run(["go.mod"], [], ["go"]);

    expect(commands.build?.source).toBe("convention");
  });

  it("reports nothing rather than inventing a command", () => {
    const { commands } = run(["README.md"], [], []);

    expect(commands.build).toBeNull();
    expect(commands.dev).toBeNull();
    expect(commands.production).toBeNull();
  });

  it("prefers a declared script over a convention", () => {
    const { commands } = run(
      ["go.mod", "package.json"],
      [pkg({ scripts: { build: "tsc" } })],
      ["go", "node"]
    );

    expect(commands.build?.source).toBe("script");
  });
});
