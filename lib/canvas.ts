import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Where the cards sit on a project's canvas.
 *
 * Kept under `~/.devcon/canvas/`, keyed by a hash of the project path — the
 * same reason the project list lives there. A layout file written into someone's
 * repo lands in their diff, their commit and their submission, and arranging
 * cards is not a change to their project.
 *
 * Positions only. No card content is stored, so a stale layout can never
 * resurrect a gap that has since been fixed — the cards are rebuilt from the
 * files every render and the layout only says where to put them.
 */

export interface Point {
  x: number;
  y: number;
}

export type Layout = Record<string, Point>;

export const CANVAS_DIR = join(homedir(), ".devcon", "canvas");

/** A path can contain anything; a filename cannot. */
export function layoutFile(projectPath: string, dir = CANVAS_DIR): string {
  const key = createHash("sha256")
    .update(projectPath)
    .digest("hex")
    .slice(0, 16);
  return join(dir, `${key}.json`);
}

/** Numbers only, finite, and bounded — a hand-edited file must not move a card to infinity. */
export function sanitize(raw: unknown): Layout {
  const out: Layout = {};
  if (!raw || typeof raw !== "object") return out;

  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const p = value as { x?: unknown; y?: unknown };
    const x = Number(p?.x);
    const y = Number(p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    // Far enough for any real board, near enough that a card stays findable.
    out[id] = {
      x: Math.max(-20_000, Math.min(20_000, Math.round(x))),
      y: Math.max(-20_000, Math.min(20_000, Math.round(y))),
    };
  }
  return out;
}

export async function loadLayout(
  projectPath: string,
  dir = CANVAS_DIR,
): Promise<Layout> {
  try {
    return sanitize(
      JSON.parse(await readFile(layoutFile(projectPath, dir), "utf8")),
    );
  } catch {
    // No layout yet is the normal first visit, not a failure.
    return {};
  }
}

export async function saveLayout(
  projectPath: string,
  layout: Layout,
  dir = CANVAS_DIR,
): Promise<void> {
  const clean = sanitize(layout);
  await mkdir(dir, { recursive: true });
  await writeFile(
    layoutFile(projectPath, dir),
    `${JSON.stringify(clean, null, 2)}\n`,
    "utf8",
  );
}

/**
 * A starting place for cards that have never been dragged.
 *
 * A column per kind, so a first visit reads as grouped rather than as a pile
 * at the origin.
 */
export function defaultPosition(index: number, column: number): Point {
  return { x: 40 + column * 300, y: 40 + index * 132 };
}
