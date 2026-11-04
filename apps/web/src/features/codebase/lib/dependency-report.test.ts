import { describe, expect, it } from "vitest";
import { parseManifest } from "./dependencies";
import { parseLockfile } from "./lockfiles";
import { buildDependencyReport } from "./dependency-report";

const manifest = parseManifest(
  "package.json",
  JSON.stringify({
    dependencies: { next: "^16.0.0", react: "^19.0.0" },
    devDependencies: { vitest: "^4.0.0" },
  })
)!;

const lock = parseLockfile(
  "package-lock.json",
  JSON.stringify({
    lockfileVersion: 3,
    packages: {
      "": { name: "demo" },
      "node_modules/next": { version: "16.3.0" },
      "node_modules/react": { version: "19.2.8" },
      "node_modules/scheduler": { version: "0.23.0" },
      "node_modules/loose-envify": { version: "1.4.0" },
      "node_modules/vitest": { version: "4.1.10", dev: true },
    },
  })
)!;

describe("direct and transitive", () => {
  it("counts direct dependencies from the manifest", () => {
    const report = buildDependencyReport({
      manifests: [manifest],
      lockfiles: [],
    });

    expect(report.directCount).toBe(3);
  });

  it("separates runtime from development", () => {
    const report = buildDependencyReport({
      manifests: [manifest],
      lockfiles: [],
    });

    expect(report.runtimeCount).toBe(2);
    expect(report.devCount).toBe(1);
  });

  it("identifies transitive packages as those not declared", () => {
    const report = buildDependencyReport({
      manifests: [manifest],
      lockfiles: [lock],
    });

    expect(report.transitive.map((p) => p.name).sort()).toEqual([
      "loose-envify",
      "scheduler",
    ]);
  });

  it("counts total resolved packages", () => {
    const report = buildDependencyReport({
      manifests: [manifest],
      lockfiles: [lock],
    });

    expect(report.resolvedCount).toBe(5);
  });

  it("reports transitive as unknown without a lock file", () => {
    const report = buildDependencyReport({
      manifests: [manifest],
      lockfiles: [],
    });

    expect(report.hasLockfile).toBe(false);
    expect(report.transitive).toEqual([]);
    expect(report.transitiveCount).toBeNull();
  });

  it("reports the resolved version alongside the declared range", () => {
    const report = buildDependencyReport({
      manifests: [manifest],
      lockfiles: [lock],
    });

    const next = report.direct.find((d) => d.name === "next");
    expect(next?.declared).toBe("^16.0.0");
    expect(next?.resolved).toBe("16.3.0");
  });

  it("notes a declared dependency missing from the lock file", () => {
    const partial = parseLockfile(
      "package-lock.json",
      JSON.stringify({ lockfileVersion: 3, packages: {} })
    )!;

    const report = buildDependencyReport({
      manifests: [manifest],
      lockfiles: [partial],
    });

    expect(report.direct.find((d) => d.name === "next")?.resolved).toBeNull();
  });
});

describe("deprecated packages", () => {
  it("flags a known deprecated package with its replacement", () => {
    const withRequest = parseManifest(
      "package.json",
      JSON.stringify({ dependencies: { request: "^2.88.0" } })
    )!;

    const report = buildDependencyReport({
      manifests: [withRequest],
      lockfiles: [],
    });

    expect(report.deprecated).toHaveLength(1);
    expect(report.deprecated[0].name).toBe("request");
    expect(report.deprecated[0].replacement).toBeTruthy();
  });

  it("flags several", () => {
    const legacy = parseManifest(
      "package.json",
      JSON.stringify({ devDependencies: { tslint: "^6", "node-sass": "^7" } })
    )!;

    const report = buildDependencyReport({
      manifests: [legacy],
      lockfiles: [],
    });

    expect(report.deprecated.map((d) => d.name).sort()).toEqual([
      "node-sass",
      "tslint",
    ]);
  });

  it("finds none in a modern project", () => {
    const report = buildDependencyReport({
      manifests: [manifest],
      lockfiles: [],
    });

    expect(report.deprecated).toEqual([]);
  });

  it("states that the deprecation list is not exhaustive", () => {
    const report = buildDependencyReport({
      manifests: [manifest],
      lockfiles: [],
    });

    expect(report.deprecationCheck).toBe("partial");
  });
});

describe("vulnerabilities", () => {
  it("reports 'not checked' rather than 'none found'", () => {
    const report = buildDependencyReport({
      manifests: [manifest],
      lockfiles: [],
    });

    expect(report.vulnerabilityCheck).toBe("not-checked");
  });

  it("never exposes a vulnerability count when nothing was checked", () => {
    const report = buildDependencyReport({
      manifests: [manifest],
      lockfiles: [],
    });

    expect(report.vulnerabilities).toBeNull();
  });
});

describe("edge cases", () => {
  it("handles a project with no manifests", () => {
    const report = buildDependencyReport({ manifests: [], lockfiles: [] });

    expect(report.directCount).toBe(0);
    expect(report.deprecated).toEqual([]);
  });

  it("does not double-count a package declared in two manifests", () => {
    const report = buildDependencyReport({
      manifests: [manifest, manifest],
      lockfiles: [],
    });

    expect(report.directCount).toBe(3);
  });

  it("does not report a direct dependency as transitive", () => {
    const report = buildDependencyReport({
      manifests: [manifest],
      lockfiles: [lock],
    });

    const names = report.transitive.map((p) => p.name);
    expect(names).not.toContain("next");
    expect(names).not.toContain("vitest");
  });
});

describe("counting model", () => {
  it("counts a package installed at two versions once", () => {
    const duplicated = parseLockfile(
      "package-lock.json",
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "node_modules/semver": { version: "7.6.0" },
          "node_modules/a/node_modules/semver": { version: "6.3.1" },
        },
      })
    )!;

    const report = buildDependencyReport({
      manifests: [],
      lockfiles: [duplicated],
    });

    expect(report.resolvedCount).toBe(1);
    expect(report.transitive.map((p) => p.name)).toEqual(["semver"]);
  });
});
