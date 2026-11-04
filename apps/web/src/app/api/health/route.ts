import { NextResponse } from "next/server";

/**
 * Liveness probe. Also keeps `app/api` from being an empty directory that git
 * would drop.
 */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
