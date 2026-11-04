import { describe, expect, it } from "vitest";
import { mergeDependencies, parseManifest } from "./dependencies";
import { detectFrameworks } from "./detect";

const node = (deps: Record<string, string>, paths: string[] = []) => ({
  dependencies: mergeDependencies([
    parseManifest("package.json", JSON.stringify({ dependencies: deps }))!,
  ]),
  paths,
});

const first = (input: Parameters<typeof detectFrameworks>[0]) =>
  detectFrameworks(input)[0];

describe("all nineteen frameworks are recognised", () => {
  const cases: Array<[string, Parameters<typeof detectFrameworks>[0]]> = [
    ["Next.js", node({ next: "^16.3.0" }, ["next.config.ts"])],
    ["React", node({ react: "^19.0.0" }, ["src/app.tsx"])],
    ["Vue", node({ vue: "^3.4.0" })],
    ["Nuxt", node({ nuxt: "^3.11.0" }, ["nuxt.config.ts"])],
    ["Angular", node({ "@angular/core": "^17.0.0" }, ["angular.json"])],
    ["Svelte", node({ svelte: "^4.2.0" })],
    ["SvelteKit", node({ "@sveltejs/kit": "^2.5.0" }, ["svelte.config.js"])],
    ["Express", node({ express: "^4.19.0" })],
    ["NestJS", node({ "@nestjs/core": "^10.3.0" }, ["nest-cli.json"])],
    ["Electron", node({ electron: "^30.0.0" })],
    ["React Native", node({ "react-native": "0.74.0" }, ["metro.config.js"])],
  ];

  for (const [name, input] of cases) {
    it(`detects ${name}`, () => {
      expect(detectFrameworks(input).map((f) => f.name)).toContain(name);
    });
  }

  it("detects FastAPI, Django, and Flask", () => {
    const py = (line: string, paths: string[] = []) => ({
      dependencies: mergeDependencies([
        parseManifest("requirements.txt", line)!,
      ]),
      paths,
    });

    expect(first(py("fastapi==0.111.0")).name).toBe("FastAPI");
    expect(first(py("django==5.0.1", ["manage.py"])).name).toBe("Django");
    expect(first(py("flask==3.0.0")).name).toBe("Flask");
  });

  it("detects Laravel", () => {
    const input = {
      dependencies: mergeDependencies([
        parseManifest(
          "composer.json",
          JSON.stringify({ require: { "laravel/framework": "^11.0" } })
        )!,
      ]),
      paths: ["artisan"],
    };

    expect(first(input).name).toBe("Laravel");
  });

  it("detects Rails", () => {
    const input = {
      dependencies: mergeDependencies([
        parseManifest("Gemfile", "gem 'rails', '~> 7.1'\n")!,
      ]),
      paths: ["config/routes.rb"],
    };

    expect(first(input).name).toBe("Ruby on Rails");
  });

  it("detects Spring", () => {
    const input = {
      dependencies: mergeDependencies([
        parseManifest(
          "build.gradle",
          "dependencies {\n implementation 'org.springframework.boot:spring-boot-starter-web:3.2.0'\n}\n"
        )!,
      ]),
      paths: [],
    };

    expect(first(input).name).toBe("Spring");
  });

  it("detects Flutter", () => {
    const input = {
      dependencies: mergeDependencies([
        parseManifest(
          "pubspec.yaml",
          "dependencies:\n  flutter:\n    sdk: flutter\n"
        )!,
      ]),
      paths: ["lib/main.dart"],
    };

    expect(first(input).name).toBe("Flutter");
  });

  it("detects Tauri", () => {
    const input = {
      dependencies: mergeDependencies([]),
      paths: ["src-tauri/tauri.conf.json", "src-tauri/Cargo.toml"],
    };

    expect(first(input).name).toBe("Tauri");
  });
});

describe("version reporting", () => {
  it("reports the declared range verbatim", () => {
    expect(first(node({ next: "^16.3.0" })).version).toBe("^16.3.0");
  });

  it("reports null when no version is declared", () => {
    const input = {
      dependencies: mergeDependencies([]),
      paths: ["src-tauri/tauri.conf.json"],
    };

    expect(first(input).version).toBeNull();
  });
});

describe("configuration reporting", () => {
  it("names the config file that was found", () => {
    expect(first(node({ next: "16" }, ["next.config.ts"])).configFiles).toEqual(
      ["next.config.ts"]
    );
  });

  it("is empty when no config file exists", () => {
    expect(first(node({ next: "16" })).configFiles).toEqual([]);
  });

  it("finds a config file in a subdirectory", () => {
    expect(
      first(node({ nuxt: "3" }, ["apps/web/nuxt.config.ts"])).configFiles
    ).toEqual(["apps/web/nuxt.config.ts"]);
  });
});

describe("meta-framework precedence", () => {
  it("suppresses React when Next.js is present", () => {
    const names = detectFrameworks(
      node({ next: "16", react: "19" }, ["next.config.ts"])
    ).map((f) => f.name);

    expect(names).toContain("Next.js");
    expect(names).not.toContain("React");
  });

  it("suppresses Vue when Nuxt is present", () => {
    const names = detectFrameworks(node({ nuxt: "3", vue: "3" })).map(
      (f) => f.name
    );

    expect(names).toContain("Nuxt");
    expect(names).not.toContain("Vue");
  });

  it("suppresses Svelte when SvelteKit is present", () => {
    const names = detectFrameworks(
      node({ "@sveltejs/kit": "2", svelte: "4" })
    ).map((f) => f.name);

    expect(names).toContain("SvelteKit");
    expect(names).not.toContain("Svelte");
  });

  it("suppresses React when React Native is present", () => {
    const names = detectFrameworks(
      node({ "react-native": "0.74", react: "19" })
    ).map((f) => f.name);

    expect(names).toContain("React Native");
    expect(names).not.toContain("React");
  });

  it("keeps both when they are genuinely independent", () => {
    const names = detectFrameworks(node({ next: "16", express: "4" })).map(
      (f) => f.name
    );

    expect(names).toContain("Next.js");
    expect(names).toContain("Express");
  });
});

describe("confidence", () => {
  it("rates a dependency plus config plus layout as certain", () => {
    const found = first(
      node({ next: "16" }, ["next.config.ts", "src/app/page.tsx"])
    );

    expect(found.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("rates a lone dependency below certain", () => {
    expect(first(node({ express: "4" })).confidence).toBeLessThan(0.9);
  });
});
