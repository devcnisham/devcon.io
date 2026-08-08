#!/usr/bin/env node
import { existsSync } from "node:fs";
/**
 * The DevCon CLI.
 *
 * Thin on purpose: argv in, text out. Every decision lives in
 * `lib/registry/cli.ts`, which is testable without spawning a process.
 *
 * State is a JSON file in the project — `.devcon/registry.json` — not a
 * database and not localStorage. That makes the registry a thing you can
 * commit, diff and review, which for a list of what a project contains is more
 * useful than a row in a server somewhere.
 *
 * `sync` is the one command that needs a backend. It says so rather than
 * pretending, and queues locally in the meantime.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REGISTRY_DIR = ".devcon";
const REGISTRY_FILE = "registry.json";

/* -------------------------------------------------------------- arguments */

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split("=");
      // `--flag value` and `--flag=value` both work; a bare flag is `true`.
      if (inline !== undefined) flags[key] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--"))
        flags[key] = argv[++i];
      else flags[key] = true;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

/* ------------------------------------------------------------------ store */

/**
 * A file-backed store implementing the same interface the app uses.
 *
 * Reimplemented here rather than imported because the library is TypeScript and
 * this has to run under plain `node` with no build step. The behaviour they
 * must agree on is covered by tests against both.
 */
function fileStore(root) {
  const file = path.join(root, REGISTRY_DIR, REGISTRY_FILE);

  const read = async () => {
    if (!existsSync(file)) return { feature: [], history: [] };
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch {
      return { feature: [], history: [] };
    }
  };

  const write = async (data) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
  };

  return {
    file,
    async list(_project, module) {
      return (await read())[module] ?? [];
    },
    async get(_project, module, id) {
      return (
        (await this.list(_project, module)).find((e) => e.id === id) ?? null
      );
    },
    async put(project, entry, actor) {
      const [stored] = await this.putMany(project, [entry], actor);
      return stored;
    },
    async putMany(_project, entries, actor) {
      if (!entries.length) return [];
      const data = await read();
      const module = entries[0].module;
      const byId = new Map((data[module] ?? []).map((e) => [e.id, e]));
      const at = new Date().toISOString();
      const written = [];

      for (const entry of entries) {
        const before = byId.get(entry.id);
        if (!before) {
          const created = {
            ...entry,
            createdAt: entry.createdAt ?? at,
            updatedAt: at,
          };
          byId.set(entry.id, created);
          written.push(created);
          data.history = [
            { entryId: entry.id, module, at, kind: "created", actor },
            ...(data.history ?? []),
          ].slice(0, 500);
          continue;
        }
        const changed =
          JSON.stringify({ ...before, updatedAt: 0, revision: 0 }) !==
          JSON.stringify({ ...entry, updatedAt: 0, revision: 0 });
        if (!changed) {
          written.push(before);
          continue;
        }
        const updated = {
          ...entry,
          createdAt: before.createdAt,
          updatedAt: at,
          revision: before.revision + 1,
        };
        byId.set(entry.id, updated);
        written.push(updated);
        data.history = [
          { entryId: entry.id, module, at, kind: "updated", actor },
          ...(data.history ?? []),
        ].slice(0, 500);
      }

      data[module] = [...byId.values()];
      await write(data);
      return written;
    },
    async remove(_project, module, id, actor) {
      const data = await read();
      const before = (data[module] ?? []).length;
      data[module] = (data[module] ?? []).filter((e) => e.id !== id);
      if (data[module].length === before) return;
      data.history = [
        {
          entryId: id,
          module,
          at: new Date().toISOString(),
          kind: "deleted",
          actor,
        },
        ...(data.history ?? []),
      ].slice(0, 500);
      await write(data);
    },
    async history(_project, _module, entryId) {
      const all = (await read()).history ?? [];
      return entryId ? all.filter((e) => e.entryId === entryId) : all;
    },
    async projects() {
      return [root];
    },
  };
}

/* ------------------------------------------------------------------- help */

const HELP = `devcon — project intelligence

  devcon scan                    read the project, register what it finds
  devcon feature list [text]     list features, optionally filtered
  devcon feature add <name>      add one by hand
  devcon feature update <id>     change one
  devcon feature remove <id>     delete one
  devcon doctor                  report problems with the registry
  devcon sync                    push to a dashboard (needs a backend)

Flags for add/update:
  --status planned|building|testing|completed|deprecated
  --category <text>   --owner <text>   --version <text>
  --priority low|medium|high|critical
  --description <text>   --tags a,b,c

  --project <path>    project root (default: cwd)

The registry is written to ${REGISTRY_DIR}/${REGISTRY_FILE}. Commit it.
`;

/* ------------------------------------------------------------------- main */

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, sub, ...rest] = positional;
  const root = path.resolve(flags.project ?? process.cwd());

  if (!command || command === "help" || flags.help) {
    process.stdout.write(HELP);
    return 0;
  }

  /**
   * The library is TypeScript and this file is not compiled, so the commands
   * are loaded through the app's own build when it's available and fall back
   * to a clear error when it isn't. Shipping a compiled copy would mean two
   * implementations to keep in step.
   */
  let lib;
  try {
    lib = await import(
      pathToFileURL(path.join(root, ".devcon/cli-bundle.mjs")).href
    );
  } catch {
    lib = null;
  }

  const store = fileStore(root);

  if (command === "sync") {
    const queued = (await store.list(root, "feature")).length;
    process.stderr.write(
      `No dashboard is configured, so there is nothing to sync to.\n` +
        `${queued} features are stored locally in ${REGISTRY_DIR}/${REGISTRY_FILE}.\n` +
        `The sync engine (queue, retry, conflict resolution) is implemented and\n` +
        `waiting on a backend — see lib/registry/sync.ts.\n`,
    );
    return 1;
  }

  if (!lib) {
    process.stderr.write(
      `This CLI needs the compiled command bundle at ${REGISTRY_DIR}/cli-bundle.mjs.\n` +
        `Build it with: pnpm build:cli\n`,
    );
    return 1;
  }

  const project = root;
  let result;

  switch (command) {
    case "scan":
      result = await lib.cmdScan(store, project, lib.nodeSource(root));
      break;

    case "doctor":
      result = await lib.cmdDoctor(store, project);
      break;

    case "feature": {
      const patch = {};
      for (const key of [
        "status",
        "category",
        "owner",
        "version",
        "priority",
        "description",
        "notes",
      ]) {
        if (flags[key] !== undefined) patch[key] = flags[key];
      }
      if (flags.tags)
        patch.tags = String(flags.tags)
          .split(",")
          .map((t) => t.trim());

      if (sub === "list") result = await lib.cmdList(store, project, rest[0]);
      else if (sub === "add") {
        result = await lib.cmdAdd(store, project, {
          name: rest.join(" "),
          ...patch,
        });
      } else if (sub === "update") {
        result = await lib.cmdUpdate(store, project, rest[0], patch);
      } else if (sub === "remove") {
        result = await lib.cmdRemove(store, project, rest[0]);
      } else {
        process.stderr.write(`Unknown: feature ${sub ?? ""}\n${HELP}`);
        return 1;
      }
      break;
    }

    default:
      process.stderr.write(`Unknown command "${command}".\n${HELP}`);
      return 1;
  }

  const out = result.ok ? process.stdout : process.stderr;
  out.write(`${result.lines.join("\n")}\n`);
  return result.ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`${err?.message ?? err}\n`);
    process.exit(1);
  },
);
