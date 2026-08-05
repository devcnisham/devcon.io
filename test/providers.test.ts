import { describe, expect, it } from "vitest";
import {
  type McpClient,
  type McpServer,
  PROVIDERS,
  type Provider,
  buildMcpCliCommands,
  buildMcpConfig,
  mcpKeysNeeded,
} from "@/lib/catalog/providers";

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
      .filter(([, v]) => ("url" in v) === ("command" in v))
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
      .filter((p) => !(p.mcp_server as { url: string }).url.startsWith("https://"))
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
    expect(stdioCommand).toContain("--env SECOND_TOKEN=$SECOND_TOKEN --transport");
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
