import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultPosition, type Layout, loadLayout } from "@/lib/canvas.ts";
import { CONNECTORS } from "@/lib/connectors.ts";
import { detectProject, gaps, stackLine } from "@/lib/detect.ts";
import { parseSpec } from "@/lib/ship/parse.ts";
import { getActive } from "@/lib/workspaces.ts";
import { saveCanvasLayout } from "../../actions.ts";
import { ViewTabs } from "../views";
import { Board, type CardNode } from "./board";

/**
 * The canvas — the open project as cards you can arrange.
 *
 * Everything on it is read from the project's own files as this renders: its
 * stack from the lockfile and dependencies, a card per gap, a card per
 * installed integration, and the one sentence if there is a `SHIP.md`. Nothing
 * is stored except where each card sits, so a fixed gap disappears on the next
 * load rather than lingering because a layout file remembered it.
 */
export const dynamic = "force-dynamic";

async function shippingSentence(root: string): Promise<string | null> {
  try {
    return (
      parseSpec(await readFile(join(root, "SHIP.md"), "utf8")).shipping || null
    );
  } catch {
    return null;
  }
}

export default async function Canvas() {
  const project = await getActive();

  if (!project) {
    return (
      <>
        <ViewTabs active="canvas" />
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 pt-16">
          <p className="max-w-sm text-center text-[13.5px] text-[var(--color-muted)]">
            No project open. Choose one on the dashboard and its files become
            the cards on this canvas.
          </p>
        </div>
      </>
    );
  }

  const [detected, sentence, saved] = await Promise.all([
    detectProject(project.path),
    shippingSentence(project.path),
    loadLayout(project.path),
  ]);

  const nodes: CardNode[] = [];
  nodes.push({
    id: "project",
    kind: "project",
    title: project.name,
    body: stackLine(detected) || "Stack not detected",
  });
  if (sentence) {
    nodes.push({ id: "spec", kind: "spec", title: "Shipping", body: sentence });
  }
  for (const g of gaps(detected)) {
    nodes.push({
      id: `gap:${g.id}`,
      kind: "gap",
      title: g.label,
      body: g.urgent ? "Losing a key, not untidy. Fix first." : undefined,
      urgent: g.urgent,
    });
  }
  for (const c of CONNECTORS) {
    if (c.packages.length === 0) continue;
    const installed = await installedIn(project.path, c.packages);
    if (installed) {
      nodes.push({
        id: `int:${c.id}`,
        kind: "integration",
        title: c.name,
        body: c.what,
      });
    }
  }

  // Cards never dragged get a column by kind, so a first visit reads as
  // grouped rather than as a pile at the origin.
  const columns: Record<CardNode["kind"], number> = {
    project: 0,
    spec: 0,
    gap: 1,
    integration: 2,
  };
  const seen: Record<string, number> = {};
  const initial: Layout = {};
  for (const n of nodes) {
    if (saved[n.id]) {
      initial[n.id] = saved[n.id];
      continue;
    }
    const col = columns[n.kind];
    seen[col] = (seen[col] ?? 0) + 1;
    initial[n.id] = defaultPosition(seen[col] - 1, col);
  }

  const path = project.path;
  async function save(layout: Layout) {
    "use server";
    await saveCanvasLayout(path, layout);
  }

  return (
    <>
      <ViewTabs active="canvas" project={project.name} />
      <Board nodes={nodes} initial={initial} save={save} />
    </>
  );
}

async function installedIn(root: string, packages: string[]): Promise<boolean> {
  try {
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
    return packages.some((p) => p in deps);
  } catch {
    return false;
  }
}
