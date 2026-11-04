import { describe, expect, it, vi } from "vitest";
import { createAuthActions } from "./actions";
import { CSRF_COOKIE, SESSION_COOKIE } from "./cookies";

function fakeDeps(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      signInWithPassword: async () => ({ error: null, data: {} }),
      signUp: async () => ({
        error: null,
        data: {
          user: { id: "u1", email: "a@b.test", email_confirmed_at: null },
        },
      }),
    },
    verifyCsrfToken: async () => true,
    origin: "https://devstep.test",
    clientKey: "unknown",
    setCookie: async () => {},
    recordFailure: async () => {},
    recordSuccess: async () => {},
    checkBruteForce: async () => ({ locked: false }),
    consumeRateLimit: async () => ({ ok: true, remaining: 9 }),
    ...overrides,
  };
}

describe("createAuthActions", () => {
  it("signs in and reports success", async () => {
    const { login } = await createAuthActions(fakeDeps() as never);
    const result = await login({
      email: "a@b.test",
      password: "hunter2hunter2",
      csrfToken: "t",
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects when CSRF verification fails", async () => {
    const { login } = await createAuthActions(
      fakeDeps({ verifyCsrfToken: async () => false }) as never
    );
    const result = await login({
      email: "a@b.test",
      password: "hunter2hunter2",
      csrfToken: "bad",
    });
    expect(result).toEqual({
      ok: false,
      message: "Your session expired. Refresh the page and try again.",
    });
  });

  it("rejects when brute force says locked", async () => {
    const { login } = await createAuthActions(
      fakeDeps({ checkBruteForce: async () => ({ locked: true }) }) as never
    );
    const result = await login({
      email: "a@b.test",
      password: "hunter2hunter2",
      csrfToken: "t",
    });
    expect(result).toEqual({
      ok: false,
      message: "Too many attempts. Try again later.",
    });
  });

  it("records a failure when the password is wrong", async () => {
    let recorded = 0;
    const { login } = await createAuthActions(
      fakeDeps({
        auth: {
          signInWithPassword: async () => ({
            error: { message: "Invalid login credentials" },
            data: {},
          }),
        },
        recordFailure: async () => {
          recorded += 1;
        },
      }) as never
    );
    const result = await login({
      email: "a@b.test",
      password: "wrongpassword",
      csrfToken: "t",
    });
    expect(result.ok).toBe(false);
    expect(recorded).toBe(1);
  });

  it("nudges an unverified user without recording a brute-force failure", async () => {
    let recorded = 0;
    const { login } = await createAuthActions(
      fakeDeps({
        auth: {
          signInWithPassword: async () => ({
            error: { message: "Email not confirmed", code: "email_not_confirmed" },
            data: {},
          }),
        },
        recordFailure: async () => {
          recorded += 1;
        },
      }) as never
    );
    const result = await login({
      email: "a@b.test",
      password: "hunter2hunter2",
      csrfToken: "t",
    });
    expect(result).toEqual({
      ok: false,
      message: "Check your email to verify your account.",
    });
    expect(recorded).toBe(0);
  });

  it("does not record a failure on a non-credentials error", async () => {
    let recorded = 0;
    const { login } = await createAuthActions(
      fakeDeps({
        auth: {
          signInWithPassword: async () => ({
            error: { message: "network error" },
            data: {},
          }),
        },
        recordFailure: async () => {
          recorded += 1;
        },
      }) as never
    );
    const result = await login({
      email: "a@b.test",
      password: "hunter2hunter2",
      csrfToken: "t",
    });
    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Try again.",
    });
    expect(recorded).toBe(0);
  });

  it("clears the brute-force record on a successful login", async () => {
    let succeeded = 0;
    const { login } = await createAuthActions(
      fakeDeps({
        recordSuccess: async () => {
          succeeded += 1;
        },
      }) as never
    );
    const result = await login({
      email: "a@b.test",
      password: "hunter2hunter2",
      csrfToken: "t",
    });
    expect(result).toEqual({ ok: true });
    expect(succeeded).toBe(1);
  });
});

describe("createAuthActions — session lifecycle", () => {
  it("logout clears the session cookie", async () => {
    const cleared: string[] = [];
    const { logout } = await createAuthActions(
      fakeDeps({
        auth: { signOut: async () => ({ error: null }) },
        clearCookie: async (name: string) => {
          cleared.push(name);
        },
      }) as never
    );
    const result = await logout();
    expect(result).toEqual({ ok: true });
    expect(cleared).toContain(SESSION_COOKIE);
    expect(cleared).toContain(CSRF_COOKIE);
  });

  it("clears both cookies even when signOut rejects", async () => {
    const cleared: string[] = [];
    const { logout } = await createAuthActions(
      fakeDeps({
        auth: {
          signOut: async () => {
            throw new Error("connection reset");
          },
        },
        clearCookie: async (name: string) => {
          cleared.push(name);
        },
      }) as never
    );
    const result = await logout();
    expect(result).toEqual({ ok: true });
    expect(cleared).toContain(SESSION_COOKIE);
    expect(cleared).toContain(CSRF_COOKIE);
  });

  it("forgotPassword reports success without leaking account existence", async () => {
    const { forgotPassword } = await createAuthActions(
      fakeDeps({
        auth: {
          resetPasswordForEmail: async () => ({ error: null }),
        },
      }) as never
    );
    const result = await forgotPassword("a@b.test", "t");
    expect(result).toEqual({
      ok: true,
      message:
        "If that email is registered, a reset link is on its way.",
    });
  });

  it("resetPassword refuses a CSRF mismatch", async () => {
    const { resetPassword } = await createAuthActions(
      fakeDeps({ verifyCsrfToken: async () => false }) as never
    );
    const result = await resetPassword("newpassword123", "bad");
    expect(result.ok).toBe(false);
  });

  it("resendVerification never leaks the raw error message", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { resendVerification } = await createAuthActions(
        fakeDeps({
          auth: {
            resend: async () => ({
              error: { message: "No user found with this email" },
            }),
          },
        }) as never
      );
      const result = await resendVerification("a@b.test", "t");
      expect(result).toEqual({
        ok: false,
        message: "We could not send that email. Try again in a moment.",
      });
      // The real reason still reaches the server log — it just never leaves.
      expect(errorSpy).toHaveBeenCalledWith(
        "resendVerification failed",
        "No user found with this email"
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("resendVerification reports success when the email was sent", async () => {
    const { resendVerification } = await createAuthActions(
      fakeDeps({
        auth: { resend: async () => ({ error: null }) },
      }) as never
    );
    const result = await resendVerification("a@b.test", "t");
    expect(result).toEqual({ ok: true });
  });
});
