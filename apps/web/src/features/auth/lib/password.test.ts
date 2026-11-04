import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, needsRehash } from "./password";

describe("hashPassword", () => {
  it("produces an argon2id hash, never the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("correct horse battery staple");
  });

  it("produces a different hash each time for the same password", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");

    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("accepts the correct password", async () => {
    const hash = await hashPassword("s3cret-password");

    await expect(verifyPassword(hash, "s3cret-password")).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("s3cret-password");

    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("returns false for a malformed hash instead of throwing", async () => {
    await expect(verifyPassword("not-a-hash", "anything")).resolves.toBe(false);
  });
});

describe("needsRehash", () => {
  it("is false for a hash made with the current parameters", async () => {
    const hash = await hashPassword("whatever");

    expect(needsRehash(hash)).toBe(false);
  });

  it("is true for a hash made with weaker parameters", () => {
    const weak = "$argon2id$v=19$m=4096,t=1,p=1$c29tZXNhbHQ$aGFzaA";

    expect(needsRehash(weak)).toBe(true);
  });

  it("is true for a bcrypt hash from an older system", () => {
    expect(needsRehash("$2b$10$abcdefghijklmnopqrstuv")).toBe(true);
  });
});
