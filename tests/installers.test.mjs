import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cli = path.resolve("dist/cli.js");
const run = (cwd, ...args) => {
  const r = spawnSync(process.execPath, [cli, "install", ...args], { cwd, encoding: "utf-8", env: { ...process.env, HOME: cwd, USERPROFILE: cwd } });
  return { status: r.status, out: r.stdout, err: r.stderr, json: r.stdout ? JSON.parse(r.stdout) : null };
};
const tmp = () => mkdtempSync(path.join(tmpdir(), "rgpd-inst-"));

test("vscode project scope writes .vscode/mcp.json with top-level 'servers' and type stdio", () => {
  const d = tmp();
  const r = run(d, "vscode", "--scope", "project");
  assert.equal(r.status, 0, r.err);
  const j = JSON.parse(readFileSync(path.join(d, ".vscode", "mcp.json"), "utf-8"));
  assert.equal(j.servers.rgpd.type, "stdio");
  assert.equal(j.servers.rgpd.args.at(-1), "serve");
  assert.ok(existsSync(j.servers.rgpd.args[0]), "points to an existing cli.js");
});

test("opencode project scope: 'mcp' key, type local, command array; user scope refused (path not verified)", () => {
  const d = tmp();
  const r = run(d, "opencode", "--scope", "project");
  assert.equal(r.status, 0, r.err);
  const j = JSON.parse(readFileSync(path.join(d, "opencode.json"), "utf-8"));
  assert.equal(j.mcp.rgpd.type, "local");
  assert.ok(Array.isArray(j.mcp.rgpd.command));
  assert.equal(j.mcp.rgpd.enabled, true);
  const u = run(d, "opencode", "--scope", "user");
  assert.notEqual(u.status, 0);
});

test("gemini project scope merges into existing settings and keeps a backup", () => {
  const d = tmp();
  mkdirSync(path.join(d, ".gemini"));
  writeFileSync(path.join(d, ".gemini", "settings.json"), JSON.stringify({ theme: "x", mcpServers: { other: { command: "foo" } } }));
  const r = run(d, "gemini", "--scope", "project");
  assert.equal(r.status, 0, r.err);
  const j = JSON.parse(readFileSync(path.join(d, ".gemini", "settings.json"), "utf-8"));
  assert.equal(j.theme, "x");
  assert.equal(j.mcpServers.other.command, "foo");
  assert.ok(j.mcpServers.rgpd.command);
  assert.ok(readdirSync(path.join(d, ".gemini")).some((f) => f.includes(".bak-")));
});

test("antigravity writes ~/.gemini/config/mcp_config.json", () => {
  const d = tmp();
  const r = run(d, "antigravity");
  assert.equal(r.status, 0, r.err);
  const j = JSON.parse(readFileSync(path.join(d, ".gemini", "config", "mcp_config.json"), "utf-8"));
  assert.ok(j.mcpServers.rgpd.command);
  assert.ok(r.json.notes.some((n) => /NOT confirmed/.test(n)), "honest note about unverified stdio shape");
});

test("codex project scope appends a TOML table once (idempotent)", () => {
  const d = tmp();
  assert.equal(run(d, "codex", "--scope", "project").status, 0);
  const f = path.join(d, ".codex", "config.toml");
  const t1 = readFileSync(f, "utf-8");
  assert.match(t1, /^\[mcp_servers\.rgpd\]$/m);
  assert.match(t1, /^command = ".*"$/m);
  assert.match(t1, /^args = \[".*", "serve"\]$/m);
  const r2 = run(d, "codex", "--scope", "project");
  assert.match(r2.json.action, /already configured/);
  assert.equal(readFileSync(f, "utf-8"), t1);
});

test("refuses to touch a settings file that is not plain JSON", () => {
  const d = tmp();
  mkdirSync(path.join(d, ".vscode"));
  const f = path.join(d, ".vscode", "mcp.json");
  writeFileSync(f, '{ // comment\n "servers": {} }');
  const r = run(d, "vscode", "--scope", "project");
  assert.notEqual(r.status, 0);
  assert.equal(readFileSync(f, "utf-8"), '{ // comment\n "servers": {} }');
});

test("dry-run changes nothing; claude-code builds the documented command; generic prints snippet", () => {
  const d = tmp();
  const r = run(d, "claude-code", "--scope", "project", "--dry-run");
  assert.match(r.json.command, /^claude mcp add --transport stdio rgpd --scope project -- /);
  assert.equal(existsSync(path.join(d, ".mcp.json")), false);
  const g = run(d, "generic");
  assert.ok(JSON.parse(g.json.snippet).mcpServers.rgpd.command);
  const v = run(d, "vscode", "--scope", "project", "--dry-run");
  assert.equal(existsSync(path.join(d, ".vscode")), false);
  assert.match(v.json.action, /dry-run/);
});

test("regression: arguments with spaces stay intact (Program Files bug)", async () => {
  const { quoteForCmd } = await import("../dist/installers.js");
  assert.equal(quoteForCmd("C:\Program Files\nodejs\node.exe"), '"C:\Program Files\nodejs\node.exe"');
  assert.equal(quoteForCmd("serve"), "serve");
});

test("install-agent writes a valid Claude Code subagent file, idempotent, --force overwrites", () => {
  const d = tmp();
  const run2 = (...a) => { const r = spawnSync(process.execPath, [cli, "install-agent", "--scope", "project", ...a], { cwd: d, encoding: "utf-8" }); return { status: r.status, json: JSON.parse(r.stdout) }; };
  const a = run2();
  assert.equal(a.status, 0);
  assert.equal(a.json.action, "created");
  const f = path.join(d, ".claude", "agents", "rgpd-integrador.md");
  const txt = readFileSync(f, "utf-8");
  const m = txt.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "YAML frontmatter present");
  assert.match(m[1], /^name: rgpd-integrador$/m);
  assert.match(m[1], /^description: .{80,}/m);
  assert.doesNotMatch(m[1], /^tools:/m, "tools omitted so MCP tools are inherited");
  for (const t of ["get_integration_guide", "build_consent_document", "get_country_law", "403", "subjectRef", "PREENCHER"]) assert.ok(txt.includes(t), t);
  assert.equal(run2().json.action, "exists");
  assert.equal(run2("--force").json.action, "overwritten");
});
