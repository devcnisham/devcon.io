import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { buildDigest } from "@/lib/scan/digest";
import { nodeSource } from "@/lib/scan/sources/node-fs";

/**
 * Local repo scanner. DEVELOPMENT ONLY.
 *
 * This reads an arbitrary path off the host filesystem. That is acceptable on
 * a developer's own machine and unacceptable on a deployed server, where it
 * would be a file-read primitive for anyone who can reach the URL. The guard
 * below is the whole reason this is safe — do not remove it to "test in prod".
 *
 * It is now thin on purpose. The scanning itself lives in `lib/scan/digest.ts`
 * against a source interface, so the browser folder picker, a file drop and a
 * public GitHub repo produce byte-identical digests to this route rather than
 * three near-copies of it. Production ingest goes through those, not here.
 */
const DEV_ONLY = process.env.NODE_ENV !== "production";

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!DEV_ONLY) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const target = new URL(request.url).searchParams.get("path");
  if (!target) {
    return NextResponse.json(
      { error: "No path given", hint: "Pass ?path=/absolute/path/to/repo" },
      { status: 400 },
    );
  }

  const root = path.resolve(target.replace(/^~/, process.env.HOME ?? "~"));

  if (!(await exists(root))) {
    return NextResponse.json(
      { error: `Nothing at ${root}`, hint: "Check the path is absolute." },
      { status: 404 },
    );
  }

  const stat = await fs.stat(root);
  if (!stat.isDirectory()) {
    return NextResponse.json(
      { error: "That's a file, not a directory." },
      { status: 400 },
    );
  }

  return NextResponse.json(await buildDigest(nodeSource(root)));
}
