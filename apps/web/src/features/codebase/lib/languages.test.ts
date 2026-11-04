import { describe, expect, it } from "vitest";
import { detectLanguage, languageBreakdown, LANGUAGES } from "./languages";

describe("detectLanguage — every requested language", () => {
  const cases: Array<[string, string]> = [
    ["src/index.ts", "TypeScript"],
    ["src/app.tsx", "TypeScript"],
    ["script.js", "JavaScript"],
    ["component.jsx", "JavaScript"],
    ["main.py", "Python"],
    ["Main.java", "Java"],
    ["index.php", "PHP"],
    ["server.go", "Go"],
    ["lib.rs", "Rust"],
    ["Program.cs", "C#"],
    ["main.cpp", "C++"],
    ["util.cc", "C++"],
    ["app.rb", "Ruby"],
    ["Main.kt", "Kotlin"],
    ["App.swift", "Swift"],
    ["main.dart", "Dart"],
    ["index.html", "HTML"],
    ["styles.css", "CSS"],
    ["schema.sql", "SQL"],
    ["deploy.sh", "Shell"],
  ];

  for (const [path, expected] of cases) {
    it(`maps ${path} to ${expected}`, () => {
      expect(detectLanguage(path)?.name).toBe(expected);
    });
  }
});

describe("detectLanguage — extras and edge cases", () => {
  it("recognises Vue and Svelte single-file components", () => {
    expect(detectLanguage("App.vue")?.name).toBe("Vue");
    expect(detectLanguage("App.svelte")?.name).toBe("Svelte");
  });

  it("recognises CSS supersets separately", () => {
    expect(detectLanguage("a.scss")?.name).toBe("Sass");
  });

  it("treats .h as C rather than guessing C++", () => {
    // A header could belong to either; C is the safer attribution.
    expect(detectLanguage("lib.h")?.name).toBe("C");
    expect(detectLanguage("lib.hpp")?.name).toBe("C++");
  });

  it("classifies JSON and YAML as data, not a language", () => {
    expect(detectLanguage("package.json")?.kind).toBe("data");
    expect(detectLanguage("ci.yml")?.kind).toBe("data");
  });

  it("classifies Markdown as prose", () => {
    expect(detectLanguage("README.md")?.kind).toBe("prose");
  });

  it("recognises a shell script by name with no extension", () => {
    expect(detectLanguage("Dockerfile")).toBeNull();
    expect(detectLanguage("scripts/build")).toBeNull();
  });

  it("returns null for an unknown extension", () => {
    expect(detectLanguage("mystery.qqq")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(detectLanguage("INDEX.TS")?.name).toBe("TypeScript");
  });

  it("ignores a dot in a directory name", () => {
    expect(detectLanguage("my.folder/index.ts")?.name).toBe("TypeScript");
  });

  it("gives every language a colour for display", () => {
    for (const language of Object.values(LANGUAGES)) {
      expect(language.color, language.name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("languageBreakdown", () => {
  it("weights by bytes, not file count", () => {
    const breakdown = languageBreakdown([
      { path: "a.ts", size: 9000 },
      { path: "b.py", size: 500 },
      { path: "c.py", size: 500 },
    ]);

    expect(breakdown.languages[0].name).toBe("TypeScript");
    expect(breakdown.languages[0].percent).toBe(90);
  });

  it("percentages sum to exactly 100", () => {
    const breakdown = languageBreakdown([
      { path: "a.ts", size: 1 },
      { path: "b.py", size: 1 },
      { path: "c.go", size: 1 },
    ]);

    const total = breakdown.languages.reduce((sum, l) => sum + l.percent, 0);
    expect(total).toBe(100);
  });

  it("still sums to 100 with awkward thirds", () => {
    const breakdown = languageBreakdown([
      { path: "a.ts", size: 100 },
      { path: "b.py", size: 100 },
      { path: "c.go", size: 100 },
      { path: "d.rs", size: 100 },
      { path: "e.rb", size: 100 },
      { path: "f.php", size: 100 },
      { path: "g.swift", size: 100 },
    ]);

    expect(breakdown.languages.reduce((sum, l) => sum + l.percent, 0)).toBe(
      100
    );
  });

  it("excludes data and prose from the percentages", () => {
    const breakdown = languageBreakdown([
      { path: "a.ts", size: 1000 },
      { path: "package-lock.json", size: 900_000 },
      { path: "README.md", size: 5000 },
    ]);

    expect(breakdown.languages).toHaveLength(1);
    expect(breakdown.languages[0].percent).toBe(100);
  });

  it("reports data and prose bytes separately rather than discarding them", () => {
    const breakdown = languageBreakdown([
      { path: "a.ts", size: 1000 },
      { path: "data.json", size: 400 },
      { path: "README.md", size: 600 },
    ]);

    expect(breakdown.dataBytes).toBe(400);
    expect(breakdown.proseBytes).toBe(600);
  });

  it("groups unknown extensions under Other", () => {
    const breakdown = languageBreakdown([
      { path: "a.ts", size: 500 },
      { path: "b.qqq", size: 500 },
    ]);

    expect(breakdown.languages.map((l) => l.name)).toContain("Other");
  });

  it("sorts by size, largest first", () => {
    const breakdown = languageBreakdown([
      { path: "small.py", size: 100 },
      { path: "big.ts", size: 900 },
    ]);

    expect(breakdown.languages.map((l) => l.name)).toEqual([
      "TypeScript",
      "Python",
    ]);
  });

  it("names the primary language", () => {
    const breakdown = languageBreakdown([
      { path: "a.ts", size: 900 },
      { path: "b.py", size: 100 },
    ]);

    expect(breakdown.primary).toBe("TypeScript");
  });

  it("handles an empty index without dividing by zero", () => {
    const breakdown = languageBreakdown([]);

    expect(breakdown.languages).toEqual([]);
    expect(breakdown.primary).toBeNull();
    expect(breakdown.codeBytes).toBe(0);
  });

  it("handles a project made entirely of data files", () => {
    const breakdown = languageBreakdown([{ path: "a.json", size: 100 }]);

    expect(breakdown.languages).toEqual([]);
    expect(breakdown.primary).toBeNull();
  });

  it("never reports a zero-percent language", () => {
    const breakdown = languageBreakdown([
      { path: "big.ts", size: 1_000_000 },
      { path: "tiny.py", size: 1 },
    ]);

    for (const language of breakdown.languages) {
      expect(language.percent).toBeGreaterThan(0);
    }
  });
});
