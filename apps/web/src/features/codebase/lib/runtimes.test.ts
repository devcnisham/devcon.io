import { describe, expect, it } from "vitest";
import { parseManifest } from "./dependencies";
import { detectRuntimes, primaryRuntime } from "./runtimes";

const run = (
  paths: string[],
  manifests: ReturnType<typeof parseManifest>[] = [],
  versionFiles: Record<string, string> = {}
) =>
  detectRuntimes({
    paths,
    manifests: manifests.filter(Boolean) as NonNullable<
      ReturnType<typeof parseManifest>
    >[],
    versionFiles,
  });

const names = (...args: Parameters<typeof run>) =>
  run(...args).map((r) => r.name);

describe("all nine runtimes", () => {
  it("detects Node.js from a lockfile", () => {
    expect(names(["package.json", "package-lock.json"])).toContain("Node.js");
  });

  it("detects Bun from its lockfile", () => {
    expect(names(["package.json", "bun.lockb"])).toContain("Bun");
  });

  it("detects Deno from deno.json", () => {
    expect(names(["deno.json"])).toContain("Deno");
  });

  it("detects Python", () => {
    expect(names(["pyproject.toml"])).toContain("Python");
    expect(names(["requirements.txt"])).toContain("Python");
  });

  it("detects Java", () => {
    expect(names(["pom.xml"])).toContain("Java");
    expect(names(["build.gradle", "gradlew"])).toContain("Java");
  });

  it("detects PHP", () => {
    expect(names(["composer.json"])).toContain("PHP");
  });

  it("detects Go", () => {
    expect(names(["go.mod", "go.sum"])).toContain("Go");
  });

  it("detects Rust", () => {
    expect(names(["Cargo.toml", "Cargo.lock"])).toContain("Rust");
  });

  it("detects .NET from a project file", () => {
    expect(names(["src/Api/Api.csproj"])).toContain(".NET");
    expect(names(["App.fsproj"])).toContain(".NET");
    expect(names(["Solution.sln"])).toContain(".NET");
  });

  it("finds nothing in an empty project", () => {
    expect(run([])).toEqual([]);
  });
});

describe("versions", () => {
  it("reads a Node version from .nvmrc", () => {
    const [node] = run(["package.json", ".nvmrc"], [], {
      ".nvmrc": "22.3.0\n",
    });

    expect(node.version).toBe("22.3.0");
  });

  it("strips a leading v from .nvmrc", () => {
    const [node] = run(["package.json", ".nvmrc"], [], {
      ".nvmrc": "v20.11.1",
    });

    expect(node.version).toBe("20.11.1");
  });

  it("reads engines.node from package.json", () => {
    const [node] = run(
      ["package.json"],
      [parseManifest("package.json", '{"engines":{"node":">=20"}}')],
      { "package.json": '{"engines":{"node":">=20"}}' }
    );

    expect(node.version).toBe(">=20");
  });

  it("prefers a pinned .nvmrc over an engines range", () => {
    const [node] = run(
      ["package.json", ".nvmrc"],
      [parseManifest("package.json", '{"engines":{"node":">=20"}}')],
      { ".nvmrc": "22.3.0", "package.json": '{"engines":{"node":">=20"}}' }
    );

    expect(node.version).toBe("22.3.0");
  });

  it("reads a Python version from .python-version", () => {
    const [python] = run(["pyproject.toml", ".python-version"], [], {
      ".python-version": "3.12.2\n",
    });

    expect(python.version).toBe("3.12.2");
  });

  it("reads the Go version from go.mod", () => {
    const [go] = run(["go.mod"], [], {
      "go.mod": "module example.com/x\n\ngo 1.22\n",
    });

    expect(go.version).toBe("1.22");
  });

  it("reads the .NET SDK version from global.json", () => {
    const [dotnet] = run(["global.json", "App.csproj"], [], {
      "global.json": '{"sdk":{"version":"8.0.100"}}',
    });

    expect(dotnet.version).toBe("8.0.100");
  });

  it("reads a Rust toolchain", () => {
    const [rust] = run(["Cargo.toml", "rust-toolchain.toml"], [], {
      "rust-toolchain.toml": '[toolchain]\nchannel = "1.78.0"\n',
    });

    expect(rust.version).toBe("1.78.0");
  });

  it("reports null when nothing pins a version", () => {
    const [go] = run(["go.mod"]);

    expect(go.version).toBeNull();
  });

  it("survives a malformed version file", () => {
    const [dotnet] = run(["global.json", "App.csproj"], [], {
      "global.json": "{ not json",
    });

    expect(dotnet.version).toBeNull();
  });
});

describe("ranking and primary runtime", () => {
  it("ranks Bun above Node in a Bun project", () => {
    const found = run(["package.json", "bun.lockb"]);

    expect(found[0].name).toBe("Bun");
    expect(primaryRuntime(found)?.name).toBe("Bun");
  });

  it("still reports Node in a Bun project — it is genuinely compatible", () => {
    expect(names(["package.json", "bun.lockb"])).toContain("Node.js");
  });

  it("ranks Deno above Node when both are signalled", () => {
    const found = run(["package.json", "deno.json", "deno.lock"]);

    expect(found[0].name).toBe("Deno");
  });

  it("reports several runtimes for a genuinely polyglot project", () => {
    const found = names(["package.json", "go.mod", "pyproject.toml"]);

    expect(found).toContain("Node.js");
    expect(found).toContain("Go");
    expect(found).toContain("Python");
  });

  it("returns null as primary when nothing was detected", () => {
    expect(primaryRuntime([])).toBeNull();
  });

  it("orders by confidence, strongest first", () => {
    const found = run(["package.json", "go.mod", "go.sum"]);
    const scores = found.map((r) => r.confidence);

    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("gives every runtime evidence", () => {
    for (const runtime of run(["go.mod", "package.json"])) {
      expect(runtime.evidence.length).toBeGreaterThan(0);
    }
  });
});
