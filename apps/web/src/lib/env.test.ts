import { describe, expect, it } from "vitest";
import { parseEnvSchema } from "./env";

describe("parseEnvSchema", () => {
  it("returns values for present variables", () => {
    const parsed = parseEnvSchema(
      { A: { value: "x", required: true } } as const,
      {}
    );
    expect(parsed.A).toBe("x");
  });

  it("throws naming missing required variables", () => {
    expect(() =>
      parseEnvSchema(
        {
          A: { value: undefined, required: true },
          B: { value: undefined, required: true },
        } as const,
        {}
      )
    ).toThrow("A, B");
  });

  it("returns empty string for absent optional variables", () => {
    const parsed = parseEnvSchema(
      { OPT: { value: undefined, required: false } } as const,
      {}
    );
    expect(parsed.OPT).toBe("");
  });
});
