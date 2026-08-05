import { NextResponse } from "next/server";
import { summarise } from "@/lib/registry/api-contract";
import { API_MODULES, devStore as store, moduleFor } from "@/lib/registry/dev-store";
import type { ModuleId } from "@/lib/registry/types";

/**
 * Registry REST surface. DEVELOPMENT ONLY, same guard as /api/scan.
 *
 * There is no database and no authentication. An unauthenticated write
 * endpoint on a deployed host lets anyone rewrite anyone's registry, so this
 * 404s in production rather than shipping a hole. The dashboard uses the
 * client-side store; this exists so the CLI and integration tests have a real
 * HTTP surface to run against, and so the contract is exercised rather than
 * merely declared.
 *
 * State is per-process and in-memory. Restarting the dev server clears it —
 * correct for something that must not be mistaken for durable storage.
 */
const DEV_ONLY = process.env.NODE_ENV !== "production";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ project: string; module: string }> },
) {
  if (!DEV_ONLY) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const { project, module } = await params;
  if (!moduleFor(module)) {
    return NextResponse.json(
      { error: `Unknown module "${module}"`, hint: `Known: ${Object.keys(API_MODULES).join(", ")}` },
      { status: 404 },
    );
  }

  const entries = await store.list(project, module as ModuleId);
  return NextResponse.json({
    entries,
    cursor: new Date().toISOString(),
    counts: summarise(entries as (typeof entries[number] & { status?: string })[]),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ project: string; module: string }> },
) {
  if (!DEV_ONLY) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const { project, module } = await params;
  const mod = moduleFor(module);
  if (!mod) {
    return NextResponse.json({ error: `Unknown module "${module}"` }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body is not JSON" }, { status: 400 });
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { error: "name is required", hint: "Every entry needs a human-readable name." },
      { status: 400 },
    );
  }

  const entry = mod.hydrate(body as Parameters<typeof mod.hydrate>[0]);
  const problems = mod.validate(entry);
  if (problems.length) {
    return NextResponse.json(
      { error: "Invalid entry", hint: problems.join("; ") },
      { status: 422 },
    );
  }

  const stored = await store.put(project, entry, "api");
  return NextResponse.json({ entry: stored }, { status: 201 });
}
