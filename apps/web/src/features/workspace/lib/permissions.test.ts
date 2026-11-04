import { describe, expect, it } from "vitest";
import {
  WORKSPACE_ROLES,
  can,
  isAtLeast,
  type WorkspaceRole,
} from "./permissions";

describe("role ordering", () => {
  it("ranks owner above admin above member above viewer", () => {
    expect(WORKSPACE_ROLES).toEqual(["owner", "admin", "member", "viewer"]);
  });

  it("isAtLeast is true for the same role", () => {
    expect(isAtLeast("member", "member")).toBe(true);
  });

  it("isAtLeast is true for a higher role", () => {
    expect(isAtLeast("owner", "member")).toBe(true);
  });

  it("isAtLeast is false for a lower role", () => {
    expect(isAtLeast("viewer", "member")).toBe(false);
  });
});

describe("can — viewer", () => {
  it("may read the workspace and its projects", () => {
    expect(can("viewer", "workspace:read")).toBe(true);
    expect(can("viewer", "project:read")).toBe(true);
    expect(can("viewer", "activity:read")).toBe(true);
  });

  it("may not create or change anything", () => {
    expect(can("viewer", "project:create")).toBe(false);
    expect(can("viewer", "workspace:update")).toBe(false);
    expect(can("viewer", "member:invite")).toBe(false);
  });
});

describe("can — member", () => {
  it("may create and update projects", () => {
    expect(can("member", "project:create")).toBe(true);
    expect(can("member", "project:update")).toBe(true);
  });

  it("may not rename the workspace or manage members", () => {
    expect(can("member", "workspace:update")).toBe(false);
    expect(can("member", "member:invite")).toBe(false);
  });

  it("may not delete a project", () => {
    expect(can("member", "project:delete")).toBe(false);
  });
});

describe("can — admin", () => {
  it("may rename the workspace and manage members", () => {
    expect(can("admin", "workspace:update")).toBe(true);
    expect(can("admin", "member:invite")).toBe(true);
    expect(can("admin", "member:remove")).toBe(true);
    expect(can("admin", "project:delete")).toBe(true);
  });

  it("may not delete the workspace", () => {
    expect(can("admin", "workspace:delete")).toBe(false);
  });

  it("may not transfer ownership or manage billing", () => {
    expect(can("admin", "workspace:transfer")).toBe(false);
    expect(can("admin", "billing:manage")).toBe(false);
  });
});

describe("can — owner", () => {
  it("may do everything, including the owner-only actions", () => {
    expect(can("owner", "workspace:delete")).toBe(true);
    expect(can("owner", "workspace:transfer")).toBe(true);
    expect(can("owner", "billing:manage")).toBe(true);
  });
});

describe("capability containment", () => {
  it("every role can do everything the role below it can", () => {
    const capabilities = [
      "workspace:read",
      "workspace:update",
      "workspace:delete",
      "workspace:transfer",
      "project:read",
      "project:create",
      "project:update",
      "project:delete",
      "member:read",
      "member:invite",
      "member:remove",
      "activity:read",
      "billing:manage",
    ] as const;

    const pairs: Array<[WorkspaceRole, WorkspaceRole]> = [
      ["owner", "admin"],
      ["admin", "member"],
      ["member", "viewer"],
    ];

    for (const [higher, lower] of pairs) {
      for (const capability of capabilities) {
        if (can(lower, capability)) {
          expect(
            can(higher, capability),
            `${higher} should inherit ${capability} from ${lower}`
          ).toBe(true);
        }
      }
    }
  });
});

describe("unknown input fails closed", () => {
  it("denies an unrecognised role", () => {
    expect(can("robot" as WorkspaceRole, "workspace:read")).toBe(false);
  });

  it("denies an unrecognised capability", () => {
    // @ts-expect-error deliberately outside the union
    expect(can("owner", "workspace:selfdestruct")).toBe(false);
  });
});
