import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Client installers. Config formats below were checked against each vendor's own documentation
 * (see docs/CLIENTS.md for the source URL and date of every format).
 */

export const CLIENTS = ["claude-code", "codex", "gemini", "antigravity", "opencode", "vscode", "generic"] as const;
export type Client = (typeof CLIENTS)[number];

export interface InstallOptions {
  client: Client;
  scope: "user" | "project";
  name: string;
  dryRun: boolean;
  useNpx: boolean;
  cwd: string;
}

export interface InstallResult {
  client: Client;
  action: string;
  file?: string;
  command?: string;
  snippet?: string;
  backup?: string;
  notes: string[];
}

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "cli.js");

function launch(useNpx: boolean): { command: string; args: string[] } {
  return useNpx ? { command: "npx", args: ["-y", "rgpd-mcp", "serve"] } : { command: process.execPath, args: [CLI, "serve"] };
}


/** Quote one argument for cmd.exe (used only when a .cmd/.bat shim forces a shell on Windows). */
export function quoteForCmd(a: string): string {
  return /[\s"&|<>^%]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a;
}

/** Run a CLI without a shell (arguments stay intact, e.g. paths with spaces). Falls back to cmd.exe with explicit quoting only for .cmd shims. */
function runCli(bin: string, args: string[], cwd?: string) {
  const r = spawnSync(bin, args, { encoding: "utf-8", cwd });
  if (process.platform === "win32" && (r.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
    return spawnSync([bin, ...args].map(quoteForCmd).join(" "), { encoding: "utf-8", cwd, shell: true });
  }
  return r;
}

function onPath(bin: string): boolean {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [bin], { encoding: "utf-8" });
  return r.status === 0;
}

function mergeJson(file: string, mutate: (o: Record<string, any>) => void, dryRun: boolean): { backup?: string; text: string } {
  let obj: Record<string, any> = {};
  let existed = false;
  if (existsSync(file)) {
    existed = true;
    try {
      obj = JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      throw new Error(`${file} is not plain JSON (comments or syntax error). Not modified: add the snippet manually.`);
    }
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) throw new Error(`${file} does not contain a JSON object. Not modified.`);
  }
  mutate(obj);
  const out = JSON.stringify(obj, null, 2) + "\n";
  if (dryRun) return { text: out };
  mkdirSync(path.dirname(file), { recursive: true });
  let backup: string | undefined;
  if (existed) {
    backup = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    copyFileSync(file, backup);
  }
  const tmp = file + ".tmp-" + process.pid;
  writeFileSync(tmp, out);
  renameSync(tmp, file);
  return { backup, text: out };
}

export function install(o: InstallOptions): InstallResult {
  const { command, args } = launch(o.useNpx);
  const home = homedir();
  const notes: string[] = [];
  const res: InstallResult = { client: o.client, action: "", notes };

  switch (o.client) {
    case "claude-code": {
      const full = ["mcp", "add", "--transport", "stdio", o.name, "--scope", o.scope, "--", command, ...args];
      res.command = ["claude", ...full.map((a) => (/[\s"]/.test(a) ? JSON.stringify(a) : a))].join(" ");
      if (o.dryRun) { res.action = "dry-run (would run)"; return res; }
      if (!onPath("claude")) {
        // documented project-scope file as fallback
        if (o.scope === "project") {
          const file = path.join(o.cwd, ".mcp.json");
          const m = mergeJson(file, (j) => { (j["mcpServers"] ??= {})[o.name] = { command, args }; }, false);
          res.action = "wrote .mcp.json"; res.file = file; res.backup = m.backup;
          return res;
        }
        res.action = "claude CLI not found on PATH; run the command above"; return res;
      }
      const r = runCli("claude", full, o.cwd);
      res.action = r.status === 0 ? "ran claude mcp add" : `claude mcp add failed (exit ${r.status}): ${(r.stderr || r.stdout).trim()}`;
      return res;
    }
    case "codex": {
      res.command = `codex mcp add ${o.name} -- ${command} ${args.join(" ")}`;
      const file = o.scope === "project" ? path.join(o.cwd, ".codex", "config.toml") : path.join(process.env["CODEX_HOME"] ?? path.join(home, ".codex"), "config.toml");
      const tomlStr = (s: string) => JSON.stringify(s); // JSON string escaping is valid TOML basic-string
      const block = `\n[mcp_servers.${o.name}]\ncommand = ${tomlStr(command)}\nargs = [${args.map(tomlStr).join(", ")}]\n`;
      res.snippet = block.trim();
      res.file = file;
      if (o.scope === "project") notes.push("Project-scoped .codex/config.toml is only read for trusted projects (Codex docs).");
      if (o.dryRun) { res.action = "dry-run (would append to config.toml)"; return res; }
      const cur = existsSync(file) ? readFileSync(file, "utf-8") : "";
      if (new RegExp(`^\\[mcp_servers\\.${o.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "m").test(cur)) { res.action = "already configured (not modified)"; return res; }
      mkdirSync(path.dirname(file), { recursive: true });
      if (existsSync(file)) { res.backup = `${file}.bak-${Date.now()}`; copyFileSync(file, res.backup); }
      writeFileSync(file, cur + (cur && !cur.endsWith("\n") ? "\n" : "") + block);
      res.action = "appended [mcp_servers] table"; return res;
    }
    case "gemini": {
      const file = o.scope === "project" ? path.join(o.cwd, ".gemini", "settings.json") : path.join(home, ".gemini", "settings.json");
      res.file = file;
      const m = mergeJson(file, (j) => { (j["mcpServers"] ??= {})[o.name] = { command, args }; }, o.dryRun);
      res.action = o.dryRun ? "dry-run" : "updated settings.json"; res.backup = m.backup; res.snippet = m.text;
      notes.push("Gemini CLI docs: avoid underscores in server names.");
      return res;
    }
    case "antigravity": {
      const file = path.join(home, ".gemini", "config", "mcp_config.json");
      res.file = file;
      const m = mergeJson(file, (j) => { (j["mcpServers"] ??= {})[o.name] = { command, args }; }, o.dryRun);
      res.action = o.dryRun ? "dry-run" : "updated mcp_config.json"; res.backup = m.backup; res.snippet = m.text;
      notes.push("Path and remote-server format ('serverUrl') confirmed in Google's Antigravity codelab; the stdio command/args shape follows the standard mcpServers format and was NOT confirmed in Google's own docs. Verify in Antigravity: MCP Servers > Manage MCP Servers > View raw config.");
      if (o.scope === "project") notes.push("Antigravity has a single shared user config; --scope project ignored.");
      return res;
    }
    case "opencode": {
      if (o.scope === "user") throw new Error("OpenCode docs do not state a global config path on the MCP page; use --scope project (opencode.json in the project) or paste the snippet into your global config.");
      const file = path.join(o.cwd, "opencode.json");
      res.file = file;
      const m = mergeJson(file, (j) => { j["$schema"] ??= "https://opencode.ai/config.json"; (j["mcp"] ??= {})[o.name] = { type: "local", command: [command, ...args], enabled: true }; }, o.dryRun);
      res.action = o.dryRun ? "dry-run" : "updated opencode.json"; res.backup = m.backup; res.snippet = m.text;
      return res;
    }
    case "vscode": {
      const entry = { type: "stdio", command, args };
      res.command = `code --add-mcp '${JSON.stringify({ name: o.name, ...entry })}'`;
      if (o.scope === "user") {
        res.action = o.dryRun ? "dry-run (would run)" : "";
        if (o.dryRun) return res;
        if (!onPath("code")) { res.action = "VS Code CLI 'code' not found on PATH; run the command above or use project scope"; return res; }
        const r = runCli("code", ["--add-mcp", JSON.stringify({ name: o.name, ...entry })]);
        res.action = r.status === 0 ? "ran code --add-mcp (user profile)" : `code --add-mcp failed (exit ${r.status}): ${(r.stderr || r.stdout).trim()}`;
        return res;
      }
      const file = path.join(o.cwd, ".vscode", "mcp.json");
      res.file = file;
      const m = mergeJson(file, (j) => { (j["servers"] ??= {})[o.name] = entry; }, o.dryRun);
      res.action = o.dryRun ? "dry-run" : "updated .vscode/mcp.json"; res.backup = m.backup; res.snippet = m.text;
      return res;
    }
    case "generic": {
      res.action = "snippet only";
      res.snippet = JSON.stringify({ mcpServers: { [o.name]: { command, args } } }, null, 2);
      notes.push("Standard 'mcpServers' shape used by Claude Desktop, Cursor, Windsurf and others. File locations for those clients were not verified here: check each client's documentation.");
      return res;
    }
  }
}
