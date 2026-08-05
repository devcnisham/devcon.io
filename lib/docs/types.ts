export interface DocNode {
  id: string;
  name: string;
  kind: "folder" | "file";
  children?: DocNode[];
  /** Markdown body. Only set on files. */
  content?: string;
}

/**
 * Seed doc tree. Local-only until PlanStore lands — the same shape will
 * persist server-side, so nothing here has to change when it does.
 */
export const SEED_DOCS: DocNode[] = [
  {
    id: "docs",
    name: "Docs",
    kind: "folder",
    children: [
      {
        id: "prd",
        name: "PRD",
        kind: "folder",
        children: [
          {
            id: "prd-overview",
            name: "overview.md",
            kind: "file",
            content: `# Overview

DevCon takes an idea — or an existing repo — and returns a short, ordered,
personalised sequence of steps to actually ship it.

Not a roadmap of everything that *could* matter. The specific handful that
matter for **this** project, **this** person, right now.

## The premise

Everything that doesn't apply stays hidden, with a reason attached.

> The intelligence is deciding what to leave out.

## Who it's for

| Audience | Context |
| --- | --- |
| Students | College and personal projects |
| Hackathon teams | 24–48 hours, judged on a demo |
| Vibe coders & startups | Real users, real money |
`,
          },
          {
            id: "prd-scope",
            name: "scope.md",
            kind: "file",
            content: `# Scope — v1.0.0

Academic track only. Solo first, then team.

## In

- Condition DSL and plan engine
- Canvas view of the dependency graph
- Docs sidebar with import
- Hidden-steps drawer with generated reasons

## Out

- Accounts, email, pricing
- Competition and commercial tracks
- Mobile layouts
`,
          },
        ],
      },
      {
        id: "trd",
        name: "TRD",
        kind: "folder",
        children: [
          {
            id: "trd-architecture",
            name: "architecture.md",
            kind: "file",
            content: `# Architecture

**Selection and ordering are pure functions. The LLM never picks steps.**

\`\`\`ts
applies_when: all(context("academic"), needs("auth"))
\`\`\`

Each condition can describe itself, so \`explain()\` walks the tree and
returns the leaf that actually failed. That is what makes the hidden-steps
drawer honest — the copy is generated, never hand-written.

## Layers

1. Catalog — versioned TypeScript, reviewable in PRs
2. Engine — select, order, explain. No I/O.
3. UI — renders real engine output
`,
          },
          {
            id: "trd-data-model",
            name: "data-model.md",
            kind: "file",
            content: `# Data model

Build the **team-shaped schema**, ship the solo-shaped UI.

- A \`Project\` owns the plan. A user never does.
- \`membership\` exists from day one, even holding one row.
- \`claimed_by\` exists even when it is always you.
- \`owner_id\` is nullable, so accounts later are an UPDATE, not a migration.

Cost while solo-only: one extra table, one extra join.
`,
          },
        ],
      },
    ],
  },
];

/** Immutably insert a child under `parentId`. */
export function addChild(
  nodes: DocNode[],
  parentId: string,
  child: DocNode,
): DocNode[] {
  return nodes.map((node) => {
    if (node.id === parentId && node.kind === "folder") {
      return { ...node, children: [...(node.children ?? []), child] };
    }
    if (node.children) {
      return { ...node, children: addChild(node.children, parentId, child) };
    }
    return node;
  });
}

/** Immutably replace a file's markdown body. */
export function updateContent(
  nodes: DocNode[],
  id: string,
  content: string,
): DocNode[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, content };
    if (node.children) {
      return { ...node, children: updateContent(node.children, id, content) };
    }
    return node;
  });
}

/** Immutably rename a node. */
export function renameNode(
  nodes: DocNode[],
  id: string,
  name: string,
): DocNode[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, name };
    if (node.children) {
      return { ...node, children: renameNode(node.children, id, name) };
    }
    return node;
  });
}

/** Immutably remove a node by id. */
export function removeNode(nodes: DocNode[], id: string): DocNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) =>
      node.children ? { ...node, children: removeNode(node.children, id) } : node,
    );
}
