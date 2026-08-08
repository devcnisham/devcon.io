import { NextResponse } from "next/server";
import { moduleFor, devStore as store } from "@/lib/registry/dev-store";
import type { ModuleId } from "@/lib/registry/types";

/** DEVELOPMENT ONLY — see the collection route for why. */
const DEV_ONLY = process.env.NODE_ENV !== "production";

type Params = {
  params: Promise<{ project: string; module: string; id: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  if (!DEV_ONLY)
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  const { project, module, id } = await params;
  if (!moduleFor(module)) {
    return NextResponse.json(
      { error: `Unknown module "${module}"` },
      { status: 404 },
    );
  }
  const entry = await store.get(project, module as ModuleId, id);
  if (!entry)
    return NextResponse.json(
      { error: `No ${module} "${id}"` },
      { status: 404 },
    );
  return NextResponse.json({ entry });
}

export async function PATCH(request: Request, { params }: Params) {
  if (!DEV_ONLY)
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  const { project, module, id } = await params;
  const mod = moduleFor(module);
  if (!mod) {
    return NextResponse.json(
      { error: `Unknown module "${module}"` },
      { status: 404 },
    );
  }

  const existing = await store.get(project, module as ModuleId, id);
  if (!existing) {
    return NextResponse.json(
      { error: `No ${module} "${id}"` },
      { status: 404 },
    );
  }

  let patch: Record<string, unknown>;
  try {
    patch = await request.json();
  } catch {
    return NextResponse.json({ error: "Body is not JSON" }, { status: 400 });
  }

  /**
   * Optimistic concurrency.
   *
   * A client that sends the revision it read gets a 409 if the entry moved
   * underneath it, rather than silently clobbering the newer version. Omitting
   * it is allowed — the CLI often has no prior read — so this is opt-in
   * protection rather than a required round-trip.
   */
  if (
    typeof patch.revision === "number" &&
    patch.revision !== existing.revision
  ) {
    return NextResponse.json(
      {
        error: "Revision conflict",
        hint: `You have revision ${patch.revision}; the stored entry is at ${existing.revision}. Re-read and re-apply.`,
      },
      { status: 409 },
    );
  }

  // id and module are identity, not data. Letting a PATCH change either would
  // move the entry rather than edit it, and orphan its history.
  const { id: _id, module: _module, revision: _rev, ...safe } = patch;

  // The module knows its own entry type; this route is generic over modules and
  // deliberately doesn't. `validate` is the thing that checks the shape.
  const merged = { ...existing, ...safe } as Parameters<typeof mod.validate>[0];
  const problems = mod.validate(merged);
  if (problems.length) {
    return NextResponse.json(
      { error: "Invalid entry", hint: problems.join("; ") },
      { status: 422 },
    );
  }

  const stored = await store.put(project, merged, "api");
  return NextResponse.json({ entry: stored });
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!DEV_ONLY)
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  const { project, module, id } = await params;
  if (!moduleFor(module)) {
    return NextResponse.json(
      { error: `Unknown module "${module}"` },
      { status: 404 },
    );
  }
  const existing = await store.get(project, module as ModuleId, id);
  if (!existing) {
    return NextResponse.json(
      { error: `No ${module} "${id}"` },
      { status: 404 },
    );
  }
  await store.remove(project, module as ModuleId, id, "api");
  return new NextResponse(null, { status: 204 });
}
