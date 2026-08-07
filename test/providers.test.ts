import { describe, expect, it } from "vitest";
import {
  buildMcpCliCommands,
  buildMcpConfig,
  type McpClient,
  type McpServer,
  makeCustomProvider,
  mcpKeysNeeded,
  PROVIDERS,
  type Provider,
} from "@/lib/catalog/providers";
import {
  ageInDays,
  describeStale,
  FRESHNESS_DAYS,
  staleProviders,
} from "@/lib/catalog/providers/freshness";

const withMcp = PROVIDERS.filter((p) => p.mcp_server);
const ALL_MCP = new Set(withMcp.map((p) => p.id));

/**
 * Synthetic providers covering the transports the real catalog doesn't.
 *
 * Every shipped server is currently remote and OAuth, so the stdio env path,
 * the `--env` argument ordering, the `--` separator and the populated branch of
 * `mcpKeysNeeded` are never exercised by catalog data. Mutation-testing proved
 * it: four assertions here stayed green against a broken implementation,
 * because `.every()` on an empty array is true and two empty sets are equal.
 *
 * These invariants still have to hold — the moment one stdio provider is added
 * back, a config that emits `<your KEY>` or drops `--` is broken output. So
 * they're tested directly rather than incidentally.
 */
function fake(id: string, mcp: McpServer): Provider {
  return {
    id,
    capability: "database",
    name: id,
    about: "",
    free_tier: "",
    tradeoffs: { pro: [], con: [] },
    env_vars: [],
    mcp_server: mcp,
    docs_url: "",
    last_verified: "",
  };
}

const SYNTHETIC: Provider[] = [
  fake("s-stdio", {
    transport: "stdio",
    name: "stdio-server",
    command: "npx",
    args: ["-y", "some-mcp-server"],
    env: ["FAKE_TOKEN", "SECOND_TOKEN"],
  }),
  fake("s-headers", {
    transport: "http",
    name: "header-server",
    url: "https://example.com/mcp",
    headers: { Authorization: "Bearer ${HEADER_TOKEN}" },
  }),
  fake("s-oauth", {
    transport: "http",
    name: "oauth-server",
    url: "https://example.com/mcp",
    oauth: true,
  }),
];
const ALL_SYNTHETIC = new Set(SYNTHETIC.map((p) => p.id));

/** The config as a parsed object, for the client that produced it. */
function parse(client: McpClient = "claude-code") {
  const raw = buildMcpConfig(ALL_MCP, client);
  const root = JSON.parse(raw) as Record<string, Record<string, never>>;
  return root[client === "vscode" ? "servers" : "mcpServers"];
}

describe("MCP config is valid for the client that reads it", () => {
  it("emits parseable JSON", () => {
    for (const client of ["claude-code", "cursor", "vscode"] as McpClient[]) {
      expect(() => JSON.parse(buildMcpConfig(ALL_MCP, client))).not.toThrow();
    }
  });

  it("gives every remote entry a type", () => {
    /**
     * The failure this test exists for is silent. A `url` entry with no `type`
     * is read as a stdio server, so the client skips it and reports
     * "has a url but no type" — the panel shows a config that connects to
     * nothing. Nothing else in the suite would catch it.
     */
    const bad = Object.entries(parse())
      .filter(([, v]) => "url" in v && !("type" in v))
      .map(([name]) => name);
    expect(bad).toEqual([]);
  });

  it("never mixes transports in one entry", () => {
    const mixed = Object.entries(parse())
      .filter(([, v]) => "url" in v === "command" in v)
      .map(([name]) => name);
    expect(mixed).toEqual([]);
  });

  it("puts servers under the key each client actually reads", () => {
    // VS Code reads `servers`; Claude Code and Cursor read `mcpServers`.
    expect(JSON.parse(buildMcpConfig(ALL_MCP, "vscode"))).toHaveProperty(
      "servers",
    );
    expect(JSON.parse(buildMcpConfig(ALL_MCP, "cursor"))).toHaveProperty(
      "mcpServers",
    );
    expect(JSON.parse(buildMcpConfig(ALL_MCP, "vscode"))).not.toHaveProperty(
      "mcpServers",
    );
  });

  it("includes only connected providers", () => {
    const one = new Set([withMcp[0].id]);
    const servers = JSON.parse(buildMcpConfig(one)).mcpServers;
    expect(Object.keys(servers)).toEqual([withMcp[0].mcp_server?.name]);
  });

  it("emits an empty block rather than throwing when nothing is connected", () => {
    expect(JSON.parse(buildMcpConfig(new Set())).mcpServers).toEqual({});
  });
});

describe("the config never carries a secret, and never pretends to", () => {
  it("writes every env value as a bare ${NAME} reference", () => {
    /**
     * The bug this replaces: `<your STRIPE_SECRET_KEY>`. That is not a
     * placeholder the client understands — it is passed through verbatim as
     * the key, so the server starts and fails on its first authenticated call.
     * `${NAME}` is expanded from the user's own environment instead.
     *
     * Run against SYNTHETIC, not the catalog: no shipped provider is stdio, so
     * against catalog data this assertion iterates nothing and passes whatever
     * the implementation does.
     */
    const servers = JSON.parse(
      buildMcpConfig(ALL_SYNTHETIC, "claude-code", SYNTHETIC),
    ).mcpServers;
    expect(servers["stdio-server"].env).toEqual({
      FAKE_TOKEN: "${FAKE_TOKEN}",
      SECOND_TOKEN: "${SECOND_TOKEN}",
    });
  });

  it("contains no angle-bracket placeholder anywhere", () => {
    const raw = buildMcpConfig(ALL_MCP);
    expect(raw).not.toMatch(/<your |<YOUR |<[A-Z_]+>/);
  });

  it("writes header templates as ${NAME} references only", () => {
    const leaked: string[] = [];
    for (const p of withMcp) {
      const s = p.mcp_server;
      if (!s || s.transport === "stdio") continue;
      for (const [h, v] of Object.entries(s.headers ?? {})) {
        // Anything that isn't literal text plus a ${NAME} reference is a value.
        if (!/\$\{[A-Z0-9_]+\}/.test(v)) leaked.push(`${p.id}.${h}`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it("reports exactly the keys the user must export", () => {
    // Against the catalog both sides are empty and this compares nothing, so
    // it runs on SYNTHETIC, which has one stdio server and one header server.
    expect(mcpKeysNeeded(ALL_SYNTHETIC, SYNTHETIC)).toEqual([
      "FAKE_TOKEN",
      "HEADER_TOKEN",
      "SECOND_TOKEN",
    ]);
  });

  it("agrees with what the config actually references", () => {
    const declared = mcpKeysNeeded(ALL_SYNTHETIC, SYNTHETIC);
    const referenced = new Set(
      [
        ...buildMcpConfig(ALL_SYNTHETIC, "claude-code", SYNTHETIC).matchAll(
          /\$\{([A-Z0-9_]+)\}/g,
        ),
      ].map((m) => m[1]),
    );
    expect(declared).toEqual([...referenced].sort());
  });

  it("needs no keys at all for an OAuth-only selection", () => {
    // The real catalog: every shipped server is OAuth, so this is the live
    // claim the Integrations panel makes.
    expect(mcpKeysNeeded(ALL_MCP)).toEqual([]);
  });
});

describe("no provider points at a dead server", () => {
  it("does not reference the archived GitHub reference server", () => {
    // `@modelcontextprotocol/server-github` was moved to github/github-mcp-server
    // and archived. The old entry installed a package nobody maintains.
    expect(buildMcpConfig(ALL_MCP)).not.toContain(
      "@modelcontextprotocol/server-github",
    );
  });

  it("uses native remote transport rather than shimming through mcp-remote", () => {
    // `npx mcp-remote <url>` is a stdio bridge for clients with no remote
    // support. Every client this targets has it, and the shim adds a process
    // and a failure mode for nothing.
    expect(buildMcpConfig(ALL_MCP)).not.toContain("mcp-remote");
  });

  it("gives every remote server an https url", () => {
    const bad = withMcp
      .filter((p) => p.mcp_server?.transport !== "stdio")
      .filter(
        (p) => !(p.mcp_server as { url: string }).url.startsWith("https://"),
      )
      .map((p) => p.id);
    expect(bad).toEqual([]);
  });

  it("uses sse only where a vendor exposes nothing else", () => {
    // SSE is deprecated. One entry is expected (Cloudinary); a second means a
    // provider was added on the deprecated transport without checking.
    const sse = withMcp.filter((p) => p.mcp_server?.transport === "sse");
    expect(sse.map((p) => p.id)).toEqual(["cloudinary"]);
  });
});

describe("provider freshness is checked rather than asserted", () => {
  // Fixed instants, so these say nothing about the day the suite is run.
  const NOW = new Date("2026-08-07T12:00:00Z");
  const dated = (id: string, last_verified: string): Provider => ({
    ...fake(id, { transport: "http", name: id, url: "https://e.com/mcp" }),
    last_verified,
  });

  it("measures age in whole UTC days regardless of the machine's timezone", () => {
    // Date-only strings parse as UTC midnight. Measuring against a local
    // midnight instead drifts by a day either side, depending on the offset —
    // which would make the boundary below mean different things per machine.
    expect(ageInDays("2026-08-07", new Date("2026-08-07T00:00:00Z"))).toBe(0);
    expect(ageInDays("2026-08-07", new Date("2026-08-07T23:59:59Z"))).toBe(0);
    expect(ageInDays("2026-08-06", new Date("2026-08-07T00:00:00Z"))).toBe(1);
  });

  it("returns NaN for anything that is not a YYYY-MM-DD date", () => {
    expect(ageInDays("", NOW)).toBeNaN();
    expect(ageInDays("2026-08", NOW)).toBeNaN();
    expect(ageInDays("Aug 4 2026", NOW)).toBeNaN();
    // Right day, sloppy format. Node's fallback parser accepts it; the round
    // trip is what refuses it, so a date nobody can compare is never scored.
    expect(ageInDays("2026-8-4", NOW)).toBeNaN();
    // Shape-valid but not a real day. `Date.parse` does NOT reject this — it
    // rolls over to 2026-03-03 and reads three days fresher than intended.
    // Only the round-trip check catches it.
    expect(ageInDays("2026-02-31", NOW)).toBeNaN();
  });

  it("holds the bar at exactly FRESHNESS_DAYS", () => {
    // The off-by-one that matters: `>=` here would flag a provider re-checked
    // the same morning the window closes.
    const fresh = dated("fresh", isoDaysBefore(NOW, FRESHNESS_DAYS));
    const stale = dated("stale", isoDaysBefore(NOW, FRESHNESS_DAYS + 1));
    expect(staleProviders(NOW, [fresh])).toEqual([]);
    expect(staleProviders(NOW, [stale]).map((s) => s.reason)).toEqual([
      "stale",
    ]);
  });

  it("flags a future date instead of reading it as fresh", () => {
    // A one-character typo in the year buys twelve months of silence, which is
    // worse than the rot the check replaces.
    const [hit] = staleProviders(NOW, [dated("typo", "2027-08-04")]);
    expect(hit.reason).toBe("future");
    expect(hit.ageDays).toBeLessThan(0);
  });

  it("flags an unparseable date rather than skipping it", () => {
    const [hit] = staleProviders(NOW, [dated("broken", "soon")]);
    expect(hit.reason).toBe("unparseable");
  });

  it("ignores providers the builder added themselves", () => {
    /**
     * `makeCustomProvider` leaves `last_verified` empty on purpose — a custom
     * entry never claims verification. Flagging it would fail the check on the
     * user's own data, turning a catalog-maintenance signal into noise they
     * have no way to act on.
     */
    const mine = makeCustomProvider({
      capability: "database",
      name: "My Postgres",
      about: "",
      envKeys: ["DATABASE_URL"],
    });
    expect(mine.last_verified).toBe("");
    expect(staleProviders(NOW, [mine])).toEqual([]);
  });

  it("names every stale provider and what to do about it", () => {
    // A bare `expected [...] to equal []` tells whoever hits this in three
    // months nothing about which claim to go and re-read.
    const text = describeStale(
      staleProviders(NOW, [
        dated("b-old", "2020-01-01"),
        dated("a-broken", "nope"),
      ]),
    );
    expect(text).toContain("a-broken");
    expect(text).toContain("b-old");
    expect(text).toContain("lib/catalog/providers/index.ts");
    expect(describeStale([])).toBe("");
  });

  it("sorts by id so the report reads the same on every run", () => {
    const ids = staleProviders(NOW, [
      dated("zulu", "2020-01-01"),
      dated("alpha", "2020-01-01"),
    ]).map((s) => s.id);
    expect(ids).toEqual(["alpha", "zulu"]);
  });

  it("passes for the shipped catalog today", () => {
    /**
     * The live gate, and the only assertion here that depends on the clock. It
     * is meant to start failing on its own — that is the whole point of G4.
     * When it does, re-check the free tiers and move the date; do not move the
     * date to make it green.
     */
    const stale = staleProviders(new Date());
    expect(describeStale(stale)).toBe("");
  });
});

/** `YYYY-MM-DD` for the UTC day `days` before `from`. */
function isoDaysBefore(from: Date, days: number): string {
  return new Date(from.getTime() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

describe("the CLI commands run as written", () => {
  const commands = buildMcpCliCommands(ALL_MCP);
  // The stdio form is unreachable from catalog data — see SYNTHETIC above.
  const stdioCommand = buildMcpCliCommands(ALL_SYNTHETIC, SYNTHETIC)[0];

  it("produces one command per connected server", () => {
    expect(commands.length).toBe(withMcp.length);
  });

  it("never puts --env directly before the server name", () => {
    /**
     * The CLI reads the token after `--env` as another KEY=value pair, so
     * `--env K=$K name` is rejected outright. `--transport` has to sit between
     * the last pair and the name.
     */
    expect(stdioCommand).toContain(
      "--env SECOND_TOKEN=$SECOND_TOKEN --transport",
    );
    expect(stdioCommand).not.toMatch(/--env \S+ stdio-server/);
  });

  it("separates server arguments with --", () => {
    // Without it the CLI parses the server's own flags as its own options.
    expect(stdioCommand).toContain(" -- npx -y some-mcp-server");
  });

  it("passes env through shell expansion, never a value", () => {
    expect(stdioCommand).toContain("--env FAKE_TOKEN=$FAKE_TOKEN");
    expect(stdioCommand).not.toContain("<your");
  });

  it("names a real transport on every command", () => {
    const bad = commands.filter(
      (c) => !/--transport (stdio|http|sse) /.test(c),
    );
    expect(bad).toEqual([]);
  });

  it("quotes header templates rather than inlining a value", () => {
    const headerCommand = buildMcpCliCommands(ALL_SYNTHETIC, SYNTHETIC)[1];
    expect(headerCommand).toContain(
      '--header "Authorization: Bearer ${HEADER_TOKEN}"',
    );
  });

  it("carries no secret value", () => {
    expect(commands.join("\n")).not.toMatch(/<your |sk_|pk_live/);
  });
});
