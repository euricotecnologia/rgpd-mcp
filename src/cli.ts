#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CLIENTS, install, type Client } from "./installers.js";
import { Ledger, defaultStateDir } from "./ledger.js";
import { startHttp } from "./http.js";
import { createMcpServer, VERSION } from "./mcp.js";
import { coverage } from "./coverage.js";
import { AGENT_NAME, installAgent } from "./agent.js";
import { gdprLanguages, availableLocales, listCountries } from "./data.js";

function parse(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  const pos: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2);
      if (v !== undefined) flags[k!] = v;
      else if (argv[i + 1] && !argv[i + 1]!.startsWith("--") && ["port", "host", "api-key", "cors", "frame-ancestors", "scope", "name", "state-dir"].includes(k!)) flags[k!] = argv[++i]!;
      else flags[k!] = true;
    } else pos.push(a);
  }
  return { flags, pos };
}

const HELP = `rgpd-mcp ${VERSION}
  serve [--http] [--port N]    MCP server on stdio (add --http to also expose the modal/API on 127.0.0.1)
  http  [--port 7433] [--host 127.0.0.1] [--api-key KEY|env RGPD_MCP_API_KEY] [--cors origin,origin] [--frame-ancestors origin,origin]
  install-agent [--scope user|project] [--force]   instala o agente rgpd-integrador (Claude Code)
  install <client> [--scope user|project] [--name rgpd] [--dry-run] [--npx]
          clients: ${CLIENTS.join(", ")}
  doctor                       checks data, locales, ledger
  coverage                     verification status per country
  verify-ledger                recompute the consent hash chain
Env: RGPD_MCP_STATE_DIR (default ~/.rgpd-mcp), RGPD_MCP_API_KEY, RGPD_MCP_PORT`;

async function main() {
  const { flags, pos } = parse(process.argv.slice(2));
  const cmd = pos[0];
  const stateDir = (flags["state-dir"] as string) || defaultStateDir();

  switch (cmd) {
    case "serve": {
      const ledger = new Ledger(stateDir);
      let httpBase: string | undefined;
      if (flags["http"]) {
        const port = Number(flags["port"] ?? process.env["RGPD_MCP_PORT"] ?? 7433);
        try {
          const h = await startHttp({ port, stateDir, apiKey: process.env["RGPD_MCP_API_KEY"] });
          httpBase = h.url;
          process.stderr.write(`[rgpd-mcp] HTTP/modal on ${h.url}\n`);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === "EADDRINUSE") {
            // another rgpd-mcp instance (same state dir) already serves the modal
            try {
              const r = await fetch(`http://127.0.0.1:${port}/health`);
              if (r.ok) httpBase = `http://127.0.0.1:${port}`;
            } catch { /* port held by something else */ }
            process.stderr.write(httpBase ? `[rgpd-mcp] reusing HTTP server on ${httpBase}\n` : `[rgpd-mcp] port ${port} is busy and not rgpd-mcp; modal disabled\n`);
          } else throw e;
        }
      }
      const server = createMcpServer({ ledger, httpBase });
      await server.connect(new StdioServerTransport());
      process.stderr.write(`[rgpd-mcp] ${VERSION} ready (stdio)\n`);
      return;
    }
    case "http": {
      const host = (flags["host"] as string) ?? "127.0.0.1";
      const apiKey = (typeof flags["api-key"] === "string" ? (flags["api-key"] as string) : undefined) ?? process.env["RGPD_MCP_API_KEY"];
      const loopback = ["127.0.0.1", "localhost", "::1"].includes(host);
      if (!loopback && !apiKey) {
        process.stderr.write("Refusing to listen on a non-loopback address without an API key (--api-key or RGPD_MCP_API_KEY).\n");
        process.exit(2);
      }
      const h = await startHttp({
        host,
        port: Number(flags["port"] ?? process.env["RGPD_MCP_PORT"] ?? 7433),
        apiKey,
        stateDir,
        corsOrigins: typeof flags["cors"] === "string" ? (flags["cors"] as string).split(",").map((s) => s.trim()).filter(Boolean) : [],
        frameAncestors: typeof flags["frame-ancestors"] === "string" ? (flags["frame-ancestors"] as string).split(",").map((s) => s.trim()).filter(Boolean) : [],
      });
      process.stderr.write(`[rgpd-mcp] HTTP API + modal on ${h.url}  state: ${stateDir}${apiKey ? "  (API key required)" : "  (no API key: loopback only)"}\n`);
      return;
    }
    case "install": {
      const client = pos[1] as Client;
      if (!CLIENTS.includes(client)) { process.stderr.write(`Unknown client "${client}". Use one of: ${CLIENTS.join(", ")}\n`); process.exit(2); }
      const r = install({
        client,
        scope: (flags["scope"] as "user" | "project") ?? "user",
        name: (flags["name"] as string) ?? "rgpd",
        dryRun: !!flags["dry-run"],
        useNpx: !!flags["npx"],
        cwd: process.cwd(),
      });
      process.stdout.write(JSON.stringify(r, null, 2) + "\n");
      return;
    }
    case "install-agent": {
      const r = installAgent({ scope: (flags["scope"] as "user" | "project") ?? "user", cwd: process.cwd(), force: !!flags["force"] });
      process.stdout.write(JSON.stringify({ ...r, use: `@agent-${AGENT_NAME} integre o consentimento RGPD no meu sistema (clínica: <nome>, país: PT)`, note: r.restartNeeded ? "Abra uma sessão nova do Claude Code para carregar o agente." : "Já existia: use --force para substituir." }, null, 2) + "\n");
      return;
    }
    case "coverage": {
      process.stdout.write(JSON.stringify(coverage(), null, 2) + "\n");
      return;
    }
    case "verify-ledger": {
      const v = new Ledger(stateDir).verify();
      process.stdout.write(JSON.stringify(v) + "\n");
      process.exit(v.ok ? 0 : 1);
    }
    case "doctor": {
      const cov = coverage();
      const out = { version: VERSION, node: process.version, gdprLanguages: gdprLanguages().length, uiLocales: availableLocales(), countries: listCountries().length, coverage: { verified: cov.verified, partial: cov.partial, unverified: cov.unverified }, stateDir, ledger: new Ledger(stateDir).verify() };
      process.stdout.write(JSON.stringify(out, null, 2) + "\n");
      return;
    }
    default:
      process.stdout.write(HELP + "\n");
      process.exit(cmd ? 2 : 0);
  }
}

main().catch((e) => {
  process.stderr.write(`[rgpd-mcp] fatal: ${(e as Error).stack ?? e}\n`);
  process.exit(1);
});
