import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ENABLED } from "@/features/auth/lib/auth-enabled";
import { decideRoute } from "@/features/auth/lib/route-policy";
import { SESSION_COOKIE } from "@/features/auth/lib/cookies";

/**
 * First enforcement pass: a cheap cookie-presence check at the edge.
 *
 * This runs on the edge runtime, so it cannot reach the database or verify a
 * session — it only sees whether a cookie is there. A forged cookie passes
 * here and is rejected by the layout check, which is the real boundary.
 * Middleware exists to avoid rendering a protected page for an obviously
 * signed-out visitor, not to authorise anyone.
 */
export function middleware(request: NextRequest) {
  const decision = decideRoute({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    hasSessionCookie: request.cookies.has(SESSION_COOKIE),
    authEnabled: AUTH_ENABLED,
  });

  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets and image optimisation; match everything else.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
