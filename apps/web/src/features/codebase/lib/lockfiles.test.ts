import { describe, expect, it } from "vitest";
import { parseLockfile } from "./lockfiles";

describe("package-lock.json", () => {
  const v3 = JSON.stringify({
    lockfileVersion: 3,
    packages: {
      "": { name: "demo", dependencies: { next: "^16" } },
      "node_modules/next": { version: "16.3.0" },
      "node_modules/react": { version: "19.2.8" },
      "node_modules/scheduler": { version: "0.23.0", dev: false },
      "node_modules/vitest": { version: "4.1.10", dev: true },
    },
  });

  it("reads every resolved package", () => {
    const lock = parseLockfile("package-lock.json", v3);

    expect(lock?.packages.map((p) => p.name)).toEqual([
      "next",
      "react",
      "scheduler",
      "vitest",
    ]);
  });

  it("reads resolved versions", () => {
    const lock = parseLockfile("package-lock.json", v3);

    expect(lock?.packages.find((p) => p.name === "next")?.version).toBe(
      "16.3.0"
    );
  });

  it("marks dev-only packages", () => {
    const lock = parseLockfile("package-lock.json", v3);

    expect(lock?.packages.find((p) => p.name === "vitest")?.dev).toBe(true);
    expect(lock?.packages.find((p) => p.name === "react")?.dev).toBe(false);
  });

  it("ignores the root entry", () => {
    const lock = parseLockfile("package-lock.json", v3);

    expect(lock?.packages.some((p) => p.name === "demo")).toBe(false);
  });

  it("handles nested node_modules paths", () => {
    const lock = parseLockfile(
      "package-lock.json",
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "node_modules/a/node_modules/b": { version: "1.0.0" },
        },
      })
    );

    expect(lock?.packages[0].name).toBe("b");
  });

  it("handles a scoped package", () => {
    const lock = parseLockfile(
      "package-lock.json",
      JSON.stringify({
        lockfileVersion: 3,
        packages: { "node_modules/@node-rs/argon2": { version: "2.0.2" } },
      })
    );

    expect(lock?.packages[0].name).toBe("@node-rs/argon2");
  });

  it("survives malformed JSON", () => {
    expect(parseLockfile("package-lock.json", "{ nope")).toBeNull();
  });
});

describe("yarn.lock", () => {
  it("reads entries and versions", () => {
    const lock = parseLockfile(
      "yarn.lock",
      '# yarn lockfile v1\n\n"react@^19.0.0":\n  version "19.2.8"\n\nlodash@^4.17.21:\n  version "4.17.21"\n'
    );

    expect(lock?.packages.map((p) => p.name).sort()).toEqual([
      "lodash",
      "react",
    ]);
    expect(lock?.packages.find((p) => p.name === "react")?.version).toBe(
      "19.2.8"
    );
  });

  it("handles a scoped package", () => {
    const lock = parseLockfile(
      "yarn.lock",
      '"@scope/pkg@^1.0.0":\n  version "1.2.3"\n'
    );

    expect(lock?.packages[0].name).toBe("@scope/pkg");
  });
});

describe("pnpm-lock.yaml", () => {
  it("reads packages from the packages block", () => {
    const lock = parseLockfile(
      "pnpm-lock.yaml",
      "lockfileVersion: '9.0'\n\npackages:\n\n  react@19.2.8:\n    resolution: {integrity: sha512-x}\n\n  '@node-rs/argon2@2.0.2':\n    resolution: {integrity: sha512-y}\n"
    );

    expect(lock?.packages.map((p) => p.name).sort()).toEqual([
      "@node-rs/argon2",
      "react",
    ]);
    expect(lock?.packages.find((p) => p.name === "react")?.version).toBe(
      "19.2.8"
    );
  });
});

describe("Cargo.lock", () => {
  it("reads name and version pairs", () => {
    const lock = parseLockfile(
      "Cargo.lock",
      '[[package]]\nname = "serde"\nversion = "1.0.197"\n\n[[package]]\nname = "tokio"\nversion = "1.37.0"\n'
    );

    expect(lock?.packages.map((p) => p.name)).toEqual(["serde", "tokio"]);
    expect(lock?.packages[0].version).toBe("1.0.197");
  });
});

describe("go.sum", () => {
  it("deduplicates the go.mod hash lines", () => {
    const lock = parseLockfile(
      "go.sum",
      "github.com/gin-gonic/gin v1.9.1 h1:abc=\ngithub.com/gin-gonic/gin v1.9.1/go.mod h1:def=\n"
    );

    expect(lock?.packages).toHaveLength(1);
    expect(lock?.packages[0]).toMatchObject({
      name: "github.com/gin-gonic/gin",
      version: "v1.9.1",
    });
  });
});

describe("unknown lockfiles", () => {
  it("returns null", () => {
    expect(parseLockfile("README.md", "# hi")).toBeNull();
  });
});
