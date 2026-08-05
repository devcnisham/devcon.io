import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { devStore as store } from "@/lib/registry/dev-store";
import { detectorInputFrom, scanRegistry } from "@/lib/registry/scan";
import { buildDigest } from "@/lib/scan/digest";
import { nodeSource } from "@/lib/scan/sources/node-fs";

/**
 * Scan a local repo and populate its registry. DEVELOPMENT ONLY.
 *
 * Reads an arbitrary path off the host filesystem, so it carries the same
 * guard as /api/scan for the same reason. The browser sources do this
 * client-side in production; this exists for the CLI.
 */
const DEV_ONLY = process.env.NODE_ENV !== "production";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ project: string }> },
) {
  if (!DEV_ONLY) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { project } = await params;

  let body: { path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body is not JSON", hint: 'Send {"path": "/abs/path/to/repo"}' },
      { status: 400 },
    );
  }

  if (!body.path) {
    return NextResponse.json(
      { error: "No path given", hint: 'Send {"path": "/abs/path/to/repo"}' },
      { status: 400 },
    );
  }

  const root = path.resolve(body.path.replace(/^~/, process.env.HOME ?? "~"));
  try {
    const stat = await fs.stat(root);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "That's a file, not a directory." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: `Nothing at ${root}` }, { status: 404 });
  }

  const source = nodeSource(root);
  const digest = await buildDigest(source);
  const result = await scanRegistry(source, detectorInputFrom(digest));

  /**
   * Detected entries never overwrite what a person decided.
   *
   * A re-scan re-suggests everything it can see. If that clobbered an accepted
   * or dismissed entry, every scan would undo the last review — so anything
   * already reviewed keeps its state, and only genuinely new findings are
   * written as suggestions.
   */
  const existing = await store.list(project, "feature");
  const reviewed = new Map(
    existing
      .filter((e) => e.origin === "detected" && e.review !== "suggested")
      .map((e) => [e.id, e]),
  );

  const toWrite = result.entries.map((entry) => {
    const prior = reviewed.get(entry.id);
    return prior ? { ...entry, review: prior.review, revision: prior.revision } : entry;
  });

  const before = new Set(existing.map((e) => e.id));
  await store.putMany(project, toWrite, "scanner");

  return NextResponse.json({
    found: result.entries.length,
    created: toWrite.filter((e) => !before.has(e.id)).length,
    updated: toWrite.filter((e) => before.has(e.id)).length,
    warnings: result.warnings,
  });
}
