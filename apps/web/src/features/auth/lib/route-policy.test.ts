import { describe, expect, it } from "vitest";
import { decideRoute } from "./route-policy";

const enabled = { authEnabled: true };

describe("decideRoute while auth is disabled", () => {
  it("allows a protected route even with no session", () => {
    expect(
      decideRoute({
        pathname: "/dashboard",
        hasSessionCookie: false,
        authEnabled: false,
      })
    ).toEqual({ action: "allow" });
  });

  it("allows a guest-only route even with a session", () => {
    expect(
      decideRoute({
        pathname: "/login",
        hasSessionCookie: true,
        authEnabled: false,
      })
    ).toEqual({ action: "allow" });
  });
});

describe("decideRoute on protected routes", () => {
  it("redirects to login when there is no session", () => {
    expect(
      decideRoute({
        pathname: "/dashboard",
        hasSessionCookie: false,
        ...enabled,
      })
    ).toEqual({ action: "redirect", to: "/login?next=%2Fdashboard" });
  });

  it("preserves the full path and query in the next parameter", () => {
    expect(
      decideRoute({
        pathname: "/projects",
        search: "?filter=active",
        hasSessionCookie: false,
        ...enabled,
      })
    ).toEqual({
      action: "redirect",
      to: "/login?next=%2Fprojects%3Ffilter%3Dactive",
    });
  });

  it("allows through when a session cookie is present", () => {
    expect(
      decideRoute({ pathname: "/settings", hasSessionCookie: true, ...enabled })
    ).toEqual({ action: "allow" });
  });

  it("protects nested paths under a protected section", () => {
    expect(
      decideRoute({
        pathname: "/projects/abc/settings",
        hasSessionCookie: false,
        ...enabled,
      }).action
    ).toBe("redirect");
  });

  it("does not protect a route that merely shares a prefix", () => {
    expect(
      decideRoute({
        pathname: "/settings-public",
        hasSessionCookie: false,
        ...enabled,
      })
    ).toEqual({ action: "allow" });
  });
});

describe("decideRoute on guest-only routes", () => {
  it("sends a signed-in visitor to the dashboard", () => {
    expect(
      decideRoute({ pathname: "/login", hasSessionCookie: true, ...enabled })
    ).toEqual({ action: "redirect", to: "/dashboard" });
  });

  it("allows a signed-out visitor", () => {
    expect(
      decideRoute({ pathname: "/signup", hasSessionCookie: false, ...enabled })
    ).toEqual({ action: "allow" });
  });

  it("covers forgot-password and reset-password", () => {
    for (const pathname of ["/forgot-password", "/reset-password"]) {
      expect(
        decideRoute({ pathname, hasSessionCookie: true, ...enabled }).action
      ).toBe("redirect");
    }
  });

  it("leaves verify-email reachable while signed in", () => {
    // A signed-in but unverified user has to be able to open this page.
    expect(
      decideRoute({
        pathname: "/verify-email",
        hasSessionCookie: true,
        ...enabled,
      })
    ).toEqual({ action: "allow" });
  });
});

describe("decideRoute on public routes", () => {
  it("allows the landing page either way", () => {
    expect(
      decideRoute({ pathname: "/", hasSessionCookie: false, ...enabled })
    ).toEqual({ action: "allow" });
    expect(
      decideRoute({ pathname: "/", hasSessionCookie: true, ...enabled })
    ).toEqual({ action: "allow" });
  });

  it("allows an unknown route so the 404 page can render", () => {
    expect(
      decideRoute({
        pathname: "/nope",
        hasSessionCookie: false,
        ...enabled,
      })
    ).toEqual({ action: "allow" });
  });
});

describe("open-redirect safety", () => {
  it("refuses an absolute URL in next and falls back to the dashboard", () => {
    expect(
      decideRoute({
        pathname: "/login",
        search: "?next=https%3A%2F%2Fevil.example",
        hasSessionCookie: true,
        ...enabled,
      })
    ).toEqual({ action: "redirect", to: "/dashboard" });
  });

  it("refuses a protocol-relative next", () => {
    expect(
      decideRoute({
        pathname: "/login",
        search: "?next=%2F%2Fevil.example",
        hasSessionCookie: true,
        ...enabled,
      })
    ).toEqual({ action: "redirect", to: "/dashboard" });
  });

  it("honours a safe relative next after signing in", () => {
    expect(
      decideRoute({
        pathname: "/login",
        search: "?next=%2Fprojects",
        hasSessionCookie: true,
        ...enabled,
      })
    ).toEqual({ action: "redirect", to: "/projects" });
  });
});
