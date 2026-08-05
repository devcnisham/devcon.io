import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { nodeSource } from "@/lib/scan/sources/node-fs";

/**
 * File listing and single-file reads for a local path. DEVELOPMENT ONLY.
 *
 * Exists so the dev "Path" ingest tab can hand the registry scanner the same
 * `FileSource` interface every other tab provides — otherwise the registry
 * would work from a folder, from GitHub and from dropped files, but not from
 * the one path a developer is most likely to use while building this.
 *
 * Same guard and same containment check as the scan route: it reads an
 * arbitrary path, which is fine on a developer's machine and a file-read
 * primitive on a deployed one. `nodeSource` refuses `.env` and refuses to
 * escape the root, so this route inherits both rules rather than restating
 * them.
 */
const DEV_ONLY = process.env.NODE_ENV !== "production";

export async function GET(request: Request) {
  if (!DEV_ONLY) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get("path");
  const file = url.searchParams.get("file");

  if (!target) {
    return NextResponse.json({ error: "No path given" }, { status: 400 });
  }

  const root = path.resolve(target.replace(/^~/, process.env.HOME ?? "~"));
  try {
    const stat = await fs.stat(root);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: `Nothing at ${root}` }, { status: 404 });
  }

  const source = nodeSource(root);

  if (file) {
    // Returns null for anything nodeSource refuses — a blocked path and a
    // missing one are deliberately indistinguishable from out here.
    return NextResponse.json({ content: await source.read(file) });
  }

  return NextResponse.json({ files: await source.list() });
}
