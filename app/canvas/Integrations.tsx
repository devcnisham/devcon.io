"use client";

import { useMemo, useState } from "react";
import {
  buildMcpCliCommands,
  buildMcpConfig,
  CAPABILITY_LABEL,
  CAPABILITY_ORDER,
  type Capability,
  MCP_CLIENT_LABEL,
  MCP_CLIENT_PATH,
  type McpClient,
  makeCustomProvider,
  mcpKeysNeeded,
  PROVIDERS,
  type Provider,
  providersFor,
} from "@/lib/catalog/providers";
import { copyText } from "@/lib/clipboard";
import type { IntegrationState } from "@/lib/integrations/store";

const MCP_CLIENTS: McpClient[] = ["claude-code", "cursor", "vscode"];

/** Deterministic tint per provider, so each row is recognisable at a glance. */
const TINTS = [
  "linear-gradient(150deg,#38bdf8,#0369a1)",
  "linear-gradient(150deg,#a78bfa,#5b21b6)",
  "linear-gradient(150deg,#34d399,#065f46)",
  "linear-gradient(150deg,#fbbf24,#b45309)",
  "linear-gradient(150deg,#fb7185,#9f1239)",
  "linear-gradient(150deg,#94a3b8,#334155)",
];

function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

function Logo({ p }: { p: Provider }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white/90 ring-1 ring-white/10"
      style={{ background: tintFor(p.id) }}
      aria-hidden
    >
      {p.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

type Status = "idle" | "connecting" | "connected";

/**
 * Integrations, in the shape of a connector directory: searchable rows,
 * connected surfaced at the top, custom entries at the bottom.
 *
 * HARD RULE, enforced by the absence of any value input: DevCon never stores,
 * transmits, or displays a secret VALUE. Every field is a key NAME plus a
 * user-set "configured" boolean. There is deliberately nowhere to paste a key.
 */
export function Integrations({
  state,
  onChange,
  identity = {},
}: {
  state: IntegrationState;
  onChange: (next: IntegrationState) => void;
  /** What each connection resolves to, when the scan could establish it. */
  identity?: Record<string, string>;
}) {
  // Transient only — which rows are mid-animation. The durable list of what's
  // connected lives in `state`, so the canvas sees the same thing.
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<"none" | "config" | "cli" | "failed">(
    "none",
  );
  const [mcpClient, setMcpClient] = useState<McpClient>("claude-code");

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    about: "",
    envKeys: "",
    capability: "database" as Capability,
  });

  const custom = state.custom;
  const configured = useMemo(
    () => new Set(state.configured),
    [state.configured],
  );
  const all = useMemo(() => [...PROVIDERS, ...custom], [custom]);
  const connected = useMemo(() => new Set(state.connected), [state.connected]);

  const optionsFor = (c: Capability) => [
    ...providersFor(c),
    ...custom.filter((p) => p.capability === c),
  ];

  /**
   * Connecting replaces the sibling in the same capability.
   *
   * A connector directory normally lets you enable everything. Here that would
   * undo the product's whole point — two databases isn't a richer setup, it's
   * an unmade decision.
   */
  const connect = (p: Provider) => {
    if (connected.has(p.id)) {
      setStatus((s) => ({ ...s, [p.id]: "idle" }));
      onChange({
        ...state,
        connected: state.connected.filter((id) => id !== p.id),
      });
      return;
    }

    setStatus((s) => ({ ...s, [p.id]: "connecting" }));
    // No OAuth to run — this is the local record of a decision, not an auth
    // handshake. The brief pause is honest about there being a step here later.
    setTimeout(() => {
      setStatus((s) => ({ ...s, [p.id]: "idle" }));
      const siblings = new Set(optionsFor(p.capability).map((s) => s.id));
      onChange({
        ...state,
        connected: [...state.connected.filter((id) => !siblings.has(id)), p.id],
      });
    }, 420);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.about.toLowerCase().includes(q) ||
        CAPABILITY_LABEL[p.capability].toLowerCase().includes(q),
    );
  }, [query, all]);

  const missingKeys = useMemo(() => {
    const out: { provider: Provider; key: string }[] = [];
    for (const p of all) {
      if (!connected.has(p.id)) continue;
      for (const v of p.env_vars) {
        if (!configured.has(`${p.id}:${v.key}`))
          out.push({ provider: p, key: v.key });
      }
    }
    return out;
  }, [all, connected, configured]);

  const mcpConfig = useMemo(
    () => buildMcpConfig(connected, mcpClient),
    [connected, mcpClient],
  );
  const mcpCommands = useMemo(
    () => buildMcpCliCommands(connected),
    [connected],
  );
  const mcpKeys = useMemo(() => mcpKeysNeeded(connected), [connected]);
  const mcpCount = all.filter(
    (p) => connected.has(p.id) && p.mcp_server,
  ).length;
  const oauthCount = all.filter(
    (p) =>
      connected.has(p.id) &&
      p.mcp_server?.transport !== "stdio" &&
      p.mcp_server?.oauth,
  ).length;

  const submitCustom = () => {
    const name = draft.name.trim();
    if (!name) return;
    onChange({
      ...state,
      custom: [
        ...state.custom,
        makeCustomProvider({
          capability: draft.capability,
          name,
          about: draft.about.trim(),
          envKeys: draft.envKeys
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      ],
    });
    setDraft({ name: "", about: "", envKeys: "", capability: "database" });
    setAdding(false);
  };

  /* --------------------------------------------------------------- a row */
  const Row = ({ p }: { p: Provider }) => {
    const st: Status = connected.has(p.id)
      ? "connected"
      : (status[p.id] ?? "idle");
    const open = expanded === p.id;
    const linked = identity[p.id];

    return (
      <li
        className={`rounded-xl border transition-colors ${
          st === "connected"
            ? "border-emerald-400/40 bg-emerald-400/[0.05]"
            : "border-white/10 bg-white/[0.02] hover:border-white/20"
        }`}
      >
        <div className="flex items-center gap-3 p-3">
          <Logo p={p} />

          <button
            type="button"
            onClick={() => setExpanded(open ? null : p.id)}
            className="min-w-0 flex-1 text-left"
          >
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-neutral-100">
                {p.name}
              </span>
              {p.mcp_server ? (
                <span className="shrink-0 rounded bg-sky-400/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-sky-300">
                  MCP
                </span>
              ) : null}
              {p.custom ? (
                <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-neutral-400">
                  yours
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-xs text-neutral-500">
              {/* The actual repo or project, when the scan could read it off
                  disk. "GitHub" is a category; the slug is this project. */}
              {linked ? (
                <span className="font-mono text-amber-300/90">{linked}</span>
              ) : (
                <>
                  {p.about}
                  {p.custom ? "" : ` · ${p.free_tier}`}
                </>
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() => connect(p)}
            disabled={st === "connecting"}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              st === "connected"
                ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25"
                : st === "connecting"
                  ? "border-white/15 bg-white/[0.06] text-neutral-500"
                  : "border-white/15 bg-white/[0.06] text-neutral-200 hover:bg-white/12"
            }`}
          >
            {st === "connected"
              ? "Connected"
              : st === "connecting"
                ? "Connecting…"
                : "Connect"}
          </button>
        </div>

        {open ? (
          <div className="space-y-3 border-t border-white/8 px-3 pb-3 pt-3">
            {p.tradeoffs.pro.length || p.tradeoffs.con.length ? (
              <div className="grid grid-cols-2 gap-4 text-xs">
                <ul className="space-y-0.5 text-neutral-300">
                  {p.tradeoffs.pro.map((t) => (
                    <li key={t}>+ {t}</li>
                  ))}
                </ul>
                <ul className="space-y-0.5 text-neutral-400">
                  {p.tradeoffs.con.map((t) => (
                    <li key={t}>− {t}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {p.env_vars.length ? (
              <div>
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  Keys you&apos;ll need
                </p>
                <ul className="space-y-1">
                  {p.env_vars.map((v) => {
                    const key = `${p.id}:${v.key}`;
                    const done = configured.has(key);
                    return (
                      <li key={v.key}>
                        <button
                          type="button"
                          onClick={() =>
                            onChange({
                              ...state,
                              configured: configured.has(key)
                                ? state.configured.filter((k) => k !== key)
                                : [...state.configured, key],
                            })
                          }
                          className="flex w-full items-start gap-2 text-left"
                        >
                          <span
                            className={
                              done ? "text-emerald-400" : "text-neutral-600"
                            }
                          >
                            {done ? "☑" : "☐"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <code className="font-mono text-[11px] text-amber-300/90">
                              {v.key}
                            </code>
                            <span className="ml-2 text-[11px] text-neutral-500">
                              {v.where_to_get}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">No keys needed.</p>
            )}

            <p className="font-mono text-[10px] text-neutral-600">
              {p.custom
                ? "added by you — not verified by DevCon"
                : `verified ${p.last_verified} · free tiers change, re-check after 90 days`}
            </p>
          </div>
        ) : null}
      </li>
    );
  };

  const connectedList = all.filter((p) => connected.has(p.id));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 text-base font-semibold text-neutral-100">
          Integrations
        </h2>
        <p className="mb-4 text-sm text-neutral-500">
          Connect the services this project uses. One per capability — picking a
          second replaces the first.
        </p>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search integrations…"
          className="w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
        />
      </section>

      {connectedList.length && !filtered ? (
        <section>
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-400/80">
            Connected · {connectedList.length}
          </h3>
          <ul className="space-y-2">
            {connectedList.map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </ul>
        </section>
      ) : null}

      {filtered ? (
        <section>
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </h3>
          {filtered.length ? (
            <ul className="space-y-2">
              {filtered.map((p) => (
                <Row key={p.id} p={p} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-600">
              Nothing matches. Add it as a custom integration below.
            </p>
          )}
        </section>
      ) : (
        CAPABILITY_ORDER.map((capability) => {
          const options = optionsFor(capability).filter(
            (p) => !connected.has(p.id),
          );
          if (!options.length) return null;
          return (
            <section key={capability}>
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                {CAPABILITY_LABEL[capability]}
              </h3>
              <ul className="space-y-2">
                {options.map((p) => (
                  <Row key={p.id} p={p} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      {/* ------------------------------------------------------------ custom */}
      <section>
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitCustom();
            }}
            className="space-y-2 rounded-xl border border-sky-400/40 bg-sky-400/[0.05] p-4"
          >
            <p className="text-sm font-medium text-neutral-100">
              Add a custom integration
            </p>
            <div className="flex gap-2">
              <input
                autoFocus
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="Service name"
                className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/30 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
              />
              <select
                value={draft.capability}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    capability: e.target.value as Capability,
                  }))
                }
                className="rounded-lg border border-white/12 bg-black/30 px-3 py-2 text-sm text-neutral-200 focus:outline-none"
              >
                {CAPABILITY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {CAPABILITY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={draft.about}
              onChange={(e) =>
                setDraft((d) => ({ ...d, about: e.target.value }))
              }
              placeholder="What it does"
              className="w-full rounded-lg border border-white/12 bg-black/30 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
            />
            <input
              value={draft.envKeys}
              onChange={(e) =>
                setDraft((d) => ({ ...d, envKeys: e.target.value }))
              }
              placeholder="KEY_ONE, KEY_TWO"
              className="w-full rounded-lg border border-white/12 bg-black/30 px-3 py-2 font-mono text-xs text-amber-300/90 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
            />
            <p className="text-[11px] text-neutral-500">
              Key names only — never paste a value.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="rounded-lg border border-sky-400/40 bg-sky-400/15 px-3 py-1.5 text-sm text-sky-200"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg border border-white/12 px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-3.5 text-sm text-neutral-500 transition-colors hover:border-white/30 hover:text-neutral-300"
          >
            <span className="text-base leading-none">+</span> Add custom
            integration
          </button>
        )}
      </section>

      {/* ------------------------------------------------------- env manifest */}
      {connected.size ? (
        <section>
          <h2 className="mb-1 text-base font-semibold text-neutral-100">
            Environment keys
          </h2>
          <p className="mb-3 text-sm text-neutral-500">
            Names only. Values live in your{" "}
            <code className="font-mono">.env</code> and never leave your
            machine.
          </p>
          {missingKeys.length === 0 ? (
            <p className="text-sm text-emerald-400">
              Every key for your {connected.size} connected service
              {connected.size === 1 ? "" : "s"} is marked configured.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {missingKeys.map(({ provider, key }) => (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 border-b border-white/8 pb-1.5 text-sm last:border-0"
                >
                  <code className="font-mono text-[12px] text-amber-300/90">
                    {key}
                  </code>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {provider.name} · not set
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* ----------------------------------------------------------- MCP block */}
      {mcpCount > 0 ? (
        <section>
          <h2 className="mb-1 text-base font-semibold text-neutral-100">
            MCP servers
          </h2>
          <p className="mb-3 text-sm text-neutral-500">
            With these connected, your agent can do the step instead of only
            writing code about it.
          </p>

          {/* Each client reads a different file, and VS Code reads a different
              top-level key. One block labelled "your agent's MCP config" was
              wrong for two of the three. */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {MCP_CLIENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setMcpClient(c)}
                className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  mcpClient === c
                    ? "border-sky-400/40 bg-sky-400/15 text-sky-200"
                    : "border-white/12 bg-white/[0.03] text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {MCP_CLIENT_LABEL[c]}
              </button>
            ))}
            <code className="ml-1 font-mono text-[11px] text-neutral-600">
              {MCP_CLIENT_PATH[mcpClient]}
            </code>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/12 bg-black/40">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                {mcpCount} server{mcpCount === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyText(mcpConfig);
                  setCopied(ok ? "config" : "failed");
                  setTimeout(() => setCopied("none"), ok ? 1600 : 2400);
                }}
                className="rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs text-neutral-200 transition-colors hover:bg-white/12"
              >
                {copied === "config"
                  ? "Copied"
                  : copied === "failed"
                    ? "Copy failed"
                    : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-neutral-300">
              {mcpConfig}
            </pre>
          </div>

          {/* The JSON still has to land in the right file at the right nesting
              level, which is where a correct config most often stops working.
              These run as-is. */}
          {mcpClient === "claude-code" && mcpCommands.length ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-white/12 bg-black/40">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  or run these
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyText(mcpCommands.join("\n"));
                    setCopied(ok ? "cli" : "failed");
                    setTimeout(() => setCopied("none"), ok ? 1600 : 2400);
                  }}
                  className="rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs text-neutral-200 transition-colors hover:bg-white/12"
                >
                  {copied === "cli" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="overflow-x-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-neutral-300">
                {mcpCommands.join("\n")}
              </pre>
            </div>
          ) : null}

          <div className="mt-3 space-y-1.5 text-xs">
            {oauthCount > 0 ? (
              <p className="text-emerald-400/90">
                {oauthCount} of these sign in with OAuth in your agent — no key
                goes in the config at all.
              </p>
            ) : null}
            {mcpKeys.length ? (
              <p className="text-neutral-500">
                Export before starting your agent:{" "}
                {mcpKeys.map((k) => (
                  <code key={k} className="mr-1.5 font-mono text-amber-300/90">
                    {k}
                  </code>
                ))}
                <span className="block pt-1">
                  The config references these as{" "}
                  <code className="font-mono">{"${NAME}"}</code>, so your agent
                  reads the value from your environment and DevCon never holds
                  it.
                </span>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <p className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs leading-relaxed text-amber-200/80">
        Connecting records a decision — it does not authenticate. There is no
        OAuth flow behind these buttons yet, no field that accepts a secret
        value, and no column that could hold one. Keys go in your own config.
      </p>
    </div>
  );
}
