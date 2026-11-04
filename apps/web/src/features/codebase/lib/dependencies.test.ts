import { describe, expect, it } from "vitest";
import { parseManifest, mergeDependencies } from "./dependencies";

describe("package.json", () => {
  const json = JSON.stringify({
    name: "demo",
    dependencies: { next: "^16.0.0", react: "19.0.0" },
    devDependencies: { vitest: "^4.0.0" },
    peerDependencies: { typescript: "^5" },
    scripts: { dev: "next dev", test: "vitest run" },
    packageManager: "pnpm@9.0.0",
  });

  it("reads runtime and dev dependencies separately", () => {
    const manifest = parseManifest("package.json", json);

    expect(manifest?.dependencies.map((d) => d.name)).toEqual([
      "next",
      "react",
    ]);
    expect(manifest?.devDependencies.map((d) => d.name)).toEqual(["vitest"]);
  });

  it("keeps version ranges verbatim", () => {
    const manifest = parseManifest("package.json", json);

    expect(manifest?.dependencies[0].version).toBe("^16.0.0");
  });

  it("captures scripts", () => {
    expect(parseManifest("package.json", json)?.scripts).toEqual({
      dev: "next dev",
      test: "vitest run",
    });
  });

  it("detects the package manager from the packageManager field", () => {
    expect(parseManifest("package.json", json)?.packageManager).toBe("pnpm");
  });

  it("survives malformed JSON rather than throwing", () => {
    expect(parseManifest("package.json", "{ not json")).toBeNull();
  });

  it("handles a manifest with no dependencies at all", () => {
    const manifest = parseManifest("package.json", '{"name":"x"}');

    expect(manifest?.dependencies).toEqual([]);
    expect(manifest?.ecosystem).toBe("node");
  });
});

describe("requirements.txt", () => {
  it("reads pinned and unpinned requirements", () => {
    const manifest = parseManifest(
      "requirements.txt",
      "django==5.0.1\nrequests\n# a comment\n\nfastapi>=0.100\n"
    );

    expect(manifest?.ecosystem).toBe("python");
    expect(manifest?.dependencies.map((d) => d.name)).toEqual([
      "django",
      "requests",
      "fastapi",
    ]);
    expect(manifest?.dependencies[0].version).toBe("==5.0.1");
  });

  it("ignores editable installs and flags", () => {
    const manifest = parseManifest(
      "requirements.txt",
      "-r other.txt\n-e .\nflask\n"
    );

    expect(manifest?.dependencies.map((d) => d.name)).toEqual(["flask"]);
  });
});

describe("go.mod", () => {
  it("reads a require block", () => {
    const manifest = parseManifest(
      "go.mod",
      "module example.com/x\n\ngo 1.22\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n\tgithub.com/stretchr/testify v1.8.4 // indirect\n)\n"
    );

    expect(manifest?.ecosystem).toBe("go");
    expect(manifest?.dependencies.map((d) => d.name)).toContain(
      "github.com/gin-gonic/gin"
    );
  });

  it("marks indirect dependencies as dev", () => {
    const manifest = parseManifest(
      "go.mod",
      "require (\n\ta/b v1.0.0 // indirect\n)\n"
    );

    expect(manifest?.dependencies).toEqual([]);
    expect(manifest?.devDependencies.map((d) => d.name)).toEqual(["a/b"]);
  });

  it("reads a single-line require", () => {
    const manifest = parseManifest("go.mod", "require github.com/x/y v1.2.3\n");

    expect(manifest?.dependencies.map((d) => d.name)).toEqual([
      "github.com/x/y",
    ]);
  });
});

describe("Cargo.toml", () => {
  it("reads dependencies and dev-dependencies", () => {
    const manifest = parseManifest(
      "Cargo.toml",
      '[package]\nname = "x"\n\n[dependencies]\nserde = "1.0"\ntokio = { version = "1", features = ["full"] }\n\n[dev-dependencies]\ncriterion = "0.5"\n'
    );

    expect(manifest?.ecosystem).toBe("rust");
    expect(manifest?.dependencies.map((d) => d.name)).toEqual([
      "serde",
      "tokio",
    ]);
    expect(manifest?.dependencies[0].version).toBe("1.0");
    expect(manifest?.devDependencies.map((d) => d.name)).toEqual(["criterion"]);
  });
});

describe("unknown manifests", () => {
  it("returns null for a file it does not understand", () => {
    expect(parseManifest("README.md", "# hi")).toBeNull();
  });
});

describe("mergeDependencies", () => {
  it("combines manifests from several ecosystems", () => {
    const node = parseManifest(
      "package.json",
      '{"dependencies":{"next":"16"}}'
    )!;
    const python = parseManifest("requirements.txt", "django==5\n")!;

    const merged = mergeDependencies([node, python]);

    expect(merged.ecosystems).toEqual(["node", "python"]);
    expect(merged.has("next")).toBe(true);
    expect(merged.has("django")).toBe(true);
  });

  it("reports a dependency present in any manifest", () => {
    const merged = mergeDependencies([
      parseManifest("package.json", '{"devDependencies":{"vitest":"4"}}')!,
    ]);

    expect(merged.has("vitest")).toBe(true);
  });

  it("is case-insensitive on lookup", () => {
    const merged = mergeDependencies([
      parseManifest("package.json", '{"dependencies":{"Next":"16"}}')!,
    ]);

    expect(merged.has("next")).toBe(true);
  });

  it("handles no manifests at all", () => {
    const merged = mergeDependencies([]);

    expect(merged.ecosystems).toEqual([]);
    expect(merged.has("anything")).toBe(false);
  });
});

describe("composer.json", () => {
  it("reads PHP requirements", () => {
    const manifest = parseManifest(
      "composer.json",
      JSON.stringify({
        require: { php: "^8.2", "laravel/framework": "^11.0" },
        "require-dev": { "phpunit/phpunit": "^11.0" },
      })
    );

    expect(manifest?.ecosystem).toBe("php");
    expect(manifest?.dependencies.map((d) => d.name)).toContain(
      "laravel/framework"
    );
    expect(manifest?.devDependencies.map((d) => d.name)).toContain(
      "phpunit/phpunit"
    );
  });
});

describe("Gemfile", () => {
  it("reads gems with and without versions", () => {
    const manifest = parseManifest(
      "Gemfile",
      "source 'https://rubygems.org'\n\ngem 'rails', '~> 7.1'\ngem 'puma'\n# gem 'commented'\n"
    );

    expect(manifest?.ecosystem).toBe("ruby");
    expect(manifest?.dependencies.map((d) => d.name)).toEqual([
      "rails",
      "puma",
    ]);
    expect(manifest?.dependencies[0].version).toBe("~> 7.1");
  });

  it("ignores gems inside a development group marker line", () => {
    const manifest = parseManifest(
      "Gemfile",
      'group :development do\ngem "rspec"\nend\n'
    );

    expect(manifest?.dependencies.map((d) => d.name)).toEqual(["rspec"]);
  });
});

describe("pubspec.yaml", () => {
  it("reads Dart and Flutter dependencies", () => {
    const manifest = parseManifest(
      "pubspec.yaml",
      "name: demo\n\ndependencies:\n  flutter:\n    sdk: flutter\n  http: ^1.2.0\n\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n"
    );

    expect(manifest?.ecosystem).toBe("dart");
    expect(manifest?.dependencies.map((d) => d.name)).toContain("flutter");
    expect(manifest?.dependencies.map((d) => d.name)).toContain("http");
    expect(manifest?.devDependencies.map((d) => d.name)).toContain(
      "flutter_test"
    );
  });
});

describe("pom.xml", () => {
  it("reads Maven artifacts", () => {
    const manifest = parseManifest(
      "pom.xml",
      `<project><dependencies>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId><version>3.2.0</version></dependency>
      </dependencies></project>`
    );

    expect(manifest?.ecosystem).toBe("java");
    expect(manifest?.dependencies[0].name).toBe(
      "org.springframework.boot:spring-boot-starter-web"
    );
    expect(manifest?.dependencies[0].version).toBe("3.2.0");
  });
});

describe("build.gradle", () => {
  it("reads Gradle dependencies", () => {
    const manifest = parseManifest(
      "build.gradle",
      "dependencies {\n  implementation 'org.springframework.boot:spring-boot-starter:3.2.0'\n  testImplementation \"junit:junit:4.13\"\n}\n"
    );

    expect(manifest?.ecosystem).toBe("java");
    expect(manifest?.dependencies.map((d) => d.name)).toContain(
      "org.springframework.boot:spring-boot-starter"
    );
  });
});
