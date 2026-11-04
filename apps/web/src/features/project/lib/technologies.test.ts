import { describe, expect, it } from "vitest";
import {
  TECHNOLOGIES,
  TECHNOLOGY_CATEGORIES,
  findTechnology,
  searchTechnologies,
  suggestedFor,
  toggleTechnology,
} from "./technologies";
import { PROJECT_TYPES } from "./wizard";

describe("catalogue integrity", () => {
  it("has no duplicate ids", () => {
    const ids = TECHNOLOGIES.map((t) => t.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses lowercase kebab-case ids", () => {
    for (const tech of TECHNOLOGIES) {
      expect(tech.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("puts every technology in a known category", () => {
    for (const tech of TECHNOLOGIES) {
      expect(TECHNOLOGY_CATEGORIES).toContain(tech.category);
    }
  });

  it("covers this project's own stack", () => {
    for (const id of [
      "typescript",
      "nextjs",
      "react",
      "tailwind",
      "postgres",
    ]) {
      expect(findTechnology(id), `${id} missing`).toBeDefined();
    }
  });
});

describe("findTechnology", () => {
  it("returns the entry for a known id", () => {
    expect(findTechnology("typescript")?.name).toBe("TypeScript");
  });

  it("returns undefined for an unknown id", () => {
    expect(findTechnology("cobol-9000")).toBeUndefined();
  });
});

describe("searchTechnologies", () => {
  it("returns everything for an empty query", () => {
    expect(searchTechnologies("")).toHaveLength(TECHNOLOGIES.length);
  });

  it("matches on name, case-insensitively", () => {
    expect(searchTechnologies("typescript").map((t) => t.id)).toContain(
      "typescript"
    );
    expect(searchTechnologies("TYPESCRIPT").map((t) => t.id)).toContain(
      "typescript"
    );
  });

  it("matches a partial name", () => {
    expect(searchTechnologies("post").map((t) => t.id)).toContain("postgres");
  });

  it("matches an alias", () => {
    expect(searchTechnologies("next.js").map((t) => t.id)).toContain("nextjs");
  });

  it("returns nothing for a query that matches nothing", () => {
    expect(searchTechnologies("zzzznope")).toEqual([]);
  });
});

describe("toggleTechnology", () => {
  it("adds when absent", () => {
    expect(toggleTechnology([], "react")).toEqual(["react"]);
  });

  it("removes when present", () => {
    expect(toggleTechnology(["react", "nextjs"], "react")).toEqual(["nextjs"]);
  });

  it("does not mutate the input", () => {
    const selected = ["react"];
    toggleTechnology(selected, "nextjs");

    expect(selected).toEqual(["react"]);
  });

  it("ignores an unknown technology", () => {
    expect(toggleTechnology([], "not-a-real-tech")).toEqual([]);
  });
});

describe("suggestedFor", () => {
  it("suggests frontend technologies for a web app", () => {
    expect(suggestedFor("web-app")).toContain("react");
  });

  it("suggests nothing frontend-specific for an API", () => {
    expect(suggestedFor("api")).not.toContain("tailwind");
  });

  it("suggests Python for an AI app", () => {
    expect(suggestedFor("ai-app")).toContain("python");
  });

  it("covers every project type", () => {
    for (const type of PROJECT_TYPES) {
      expect(
        suggestedFor(type).length,
        `${type} has no suggestions`
      ).toBeGreaterThan(0);
    }
  });

  it("only suggests technologies that exist in the catalogue", () => {
    for (const type of PROJECT_TYPES) {
      for (const id of suggestedFor(type)) {
        expect(
          findTechnology(id),
          `${id} suggested but not in catalogue`
        ).toBeDefined();
      }
    }
  });
});
