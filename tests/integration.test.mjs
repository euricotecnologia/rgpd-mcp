import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { startHttp } from "../dist/http.js";
import { integrationSnippet } from "../dist/snippets.js";

const KEY = "test-key-123";
let h, base;
const body = {
  country: "PT",
  controller: { name: "Clínica Exemplo, Lda.", email: "privacidade@exemplo.pt", dpo: { email: "dpo@exemplo.pt" } },
  dataCategories: ["identification", "contact", "health"],
  purposes: [
    { id: "care", label: "Prestação de cuidados de saúde", legalBasis: "contract", art9Condition: "health_care", required: true, dataCategories: ["identification", "contact", "health"] },
    { id: "newsletter", label: "Envio de comunicações informativas", legalBasis: "consent", required: false, dataCategories: ["contact"] },
  ],
  capture: { subjectRef: "p-8f3a21" },
};
const auth = { Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

before(async () => {
  h = await startHttp({ port: 0, apiKey: KEY, stateDir: mkdtempSync(path.join(tmpdir(), "rgpd-int-")), corsOrigins: ["https://app.example.com"] });
  base = h.url;
});
after(() => h.server.close());

test("health + widget are public; API requires key", async () => {
  assert.equal((await fetch(base + "/health")).status, 200);
  const w = await fetch(base + "/widget/rgpd-consent.js");
  assert.equal(w.status, 200);
  assert.match(await w.text(), /customElements\.define\("rgpd-consent-modal"/);
  assert.equal((await fetch(base + "/v1/countries")).status, 401);
  assert.equal((await fetch(base + "/v1/countries", { headers: auth })).status, 200);
});

test("build -> modal page headers -> record via capture token only for bound document+subject", async () => {
  const r = await fetch(base + "/v1/consent-documents", { method: "POST", headers: auth, body: JSON.stringify(body) });
  assert.equal(r.status, 201);
  const d = await r.json();
  assert.equal(d.language, "pt");
  assert.ok(d.captureToken && d.modalUrl === "/modal/" + d.documentId);

  const page = await fetch(base + d.modalUrl);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'self'/);
  assert.match(page.headers.get("content-security-policy"), /script-src 'self'/);

  // public read of the document text
  assert.equal((await fetch(base + "/v1/consent-documents/" + d.documentId)).status, 200);

  const rec = (subjectRef, token, extra = {}) =>
    fetch(base + "/v1/consents", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "X-Capture-Token": token } : {}) },
      body: JSON.stringify({ documentId: d.documentId, subjectRef, decisions: [{ itemId: "notice_ack", granted: true }, { itemId: "consent:newsletter", granted: false }], ...extra }),
    });
  assert.equal((await rec("p-8f3a21", null)).status, 401, "no token");
  assert.equal((await rec("p-other", d.captureToken)).status, 401, "token bound to another subject");
  assert.equal((await rec("p-8f3a21", d.captureToken + "x")).status, 401, "tampered token");
  const ok = await rec("p-8f3a21", d.captureToken);
  assert.equal(ok.status, 201);
  const st = await (await fetch(base + "/v1/consents?subjectRef=p-8f3a21", { headers: auth })).json();
  assert.equal(st.status.find((s) => s.itemId === "notice_ack").granted, true);
  assert.equal(st.status.find((s) => s.itemId === "consent:newsletter").granted, false);
  assert.deepEqual((await (await fetch(base + "/v1/ledger/verify", { headers: auth })).json()).ok, true);
  // listing/withdraw need the API key, a token is not enough
  assert.equal((await fetch(base + "/v1/consents?subjectRef=p-8f3a21", { headers: { "X-Capture-Token": d.captureToken } })).status, 401);
});

test("unlawful design returns 422 with issues; bad input 400; unknown country 404", async () => {
  const bad = structuredClone(body);
  bad.purposes[0].art9Condition = undefined;
  const r = await fetch(base + "/v1/consent-documents", { method: "POST", headers: auth, body: JSON.stringify(bad) });
  assert.equal(r.status, 422);
  assert.ok((await r.json()).issues.some((i) => i.code === "ART9_CONDITION_MISSING"));
  assert.equal((await fetch(base + "/v1/consent-documents", { method: "POST", headers: auth, body: "{" })).status, 400);
  assert.equal((await fetch(base + "/v1/consent-documents", { method: "POST", headers: auth, body: JSON.stringify({ country: "PT" }) })).status, 400);
  assert.equal((await fetch(base + "/v1/countries/ZZ", { headers: auth })).status, 404);
  const big = await fetch(base + "/v1/consent-documents", { method: "POST", headers: auth, body: "x".repeat(300000) });
  assert.equal(big.status, 413);
});

test("CORS only for allow-listed origins", async () => {
  const a = await fetch(base + "/health", { headers: { Origin: "https://app.example.com" } });
  assert.equal(a.headers.get("access-control-allow-origin"), "https://app.example.com");
  const b = await fetch(base + "/health", { headers: { Origin: "https://evil.example" } });
  assert.equal(b.headers.get("access-control-allow-origin"), null);
});

test("MCP over stdio: tools, official text, build, error path", async () => {
  const state = mkdtempSync(path.join(tmpdir(), "rgpd-mcp-"));
  const t = new StdioClientTransport({ command: process.execPath, args: ["dist/cli.js", "serve"], env: { ...process.env, RGPD_MCP_STATE_DIR: state }, stderr: "pipe" });
  const c = new Client({ name: "test", version: "0" });
  await c.connect(t);
  try {
    assert.match(c.getInstructions() ?? "", /get_integration_guide/);
    assert.match(c.getInstructions() ?? "", /rgpd-integrador/);
    const tools = (await c.listTools()).tools.map((x) => x.name);
    for (const n of ["list_countries", "get_country_law", "get_gdpr_article", "search_gdpr", "build_consent_document", "get_integration_snippet", "get_consent_status", "verify_ledger", "get_reference", "get_integration_guide"]) assert.ok(tools.includes(n), n);
    assert.ok(!tools.some((n) => /record|grant/.test(n)), "the agent must not be able to record consent for a person");
    const art = await c.callTool({ name: "get_gdpr_article", arguments: { article: 9, language: "pt" } });
    assert.match(art.content[0].text, /dados relativos à saúde/);
    const country = JSON.parse((await c.callTool({ name: "get_country_law", arguments: { country: "es" } })).content[0].text);
    assert.equal(country.status, "verified");
    assert.equal(country.profile.digitalConsentAge.value, 14);
    const { capture, ...input } = body;
    const built = await c.callTool({ name: "build_consent_document", arguments: input });
    assert.ok(!built.isError, built.content[0].text);
    const b = JSON.parse(built.content[0].text);
    assert.equal(b.language, "pt");
    const bad = await c.callTool({ name: "build_consent_document", arguments: { ...input, purposes: [{ ...input.purposes[0], art9Condition: undefined }] } });
    assert.equal(bad.isError, true);
    assert.match(bad.content[0].text, /ART9_CONDITION_MISSING/);
    const nf = await c.callTool({ name: "get_country_law", arguments: { country: "ZZ" } });
    assert.equal(nf.isError, true);
    const prompts = await c.listPrompts();
    assert.ok(prompts.prompts.some((p) => p.name === "healthcare_first_visit"));
    assert.ok(prompts.prompts.some((p) => p.name === "integrar_no_sistema"));
    const pr = await c.getPrompt({ name: "integrar_no_sistema", arguments: { country: "pt", clinicName: "Clínica X" } });
    assert.match(pr.messages[0].content.text, /get_integration_guide/);
    assert.match(pr.messages[0].content.text, /Clínica X/);
    const guide = JSON.parse((await c.callTool({ name: "get_integration_guide", arguments: { country: "pt", language: "node" } })).content[0].text);
    assert.equal(guide.country.code, "PT");
    assert.equal(guide.country.status, "verified");
    assert.ok(guide.endpointsToCreateInTheSystem.length >= 3 && guide.acceptanceTests.length === 5);
    assert.equal(guide.firstVisitRequest.body.purposes[0].art9Condition, "health_care");
    assert.equal(guide.snippet.language, "node");
    // the guide's own request template must pass the builder once placeholders are filled in
    const req = guide.firstVisitRequest.body; delete req.capture;
    req.controller = { name: "Clínica X", email: "a@b.pt" };
    req.purposes[0].label = "Cuidados"; req.purposes[1].label = "Newsletter"; delete req.purposes[0].retention;
    const ok = await c.callTool({ name: "build_consent_document", arguments: req });
    assert.ok(!ok.isError, ok.content[0].text);
    const res = await c.readResource({ uri: "rgpd://gdpr/fr/article/7" });
    assert.match(res.contents[0].text, /consentement/i);
  } finally {
    await c.close();
  }
});

// The HTTP server lives in this process: child processes must be async or the event loop would deadlock.
const runAsync = (cmd, args, cwd, env) =>
  new Promise((resolve) => {
    const c = spawn(cmd, args, { cwd, env });
    let stdout = "", stderr = "";
    c.stdout.on("data", (d) => (stdout += d));
    c.stderr.on("data", (d) => (stderr += d));
    const t = setTimeout(() => c.kill(), 100000);
    c.on("close", (status) => { clearTimeout(t); resolve({ status, stdout, stderr }); });
    c.on("error", (e) => { clearTimeout(t); resolve({ status: -1, stdout, stderr: String(e) }); });
  });

test("snippets that run here: python, node, go work against the live server", { timeout: 200000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rgpd-snip-"));
  const env = { ...process.env, RGPD_MCP_API_KEY: KEY };
  const run = (cmd, args, cwd = dir) => runAsync(cmd, args, cwd, env);

  const py = integrationSnippet("python", base).files[0];
  writeFileSync(path.join(dir, py.name), py.code);
  let r = await run("python", ["-X", "utf8", "-I", py.name]);
  assert.equal(r.status, 0, "python: " + r.stderr);
  assert.match(r.stdout, /\/modal\/[0-9a-f-]{36}#subjectRef=p-8f3a21&token=/);

  const nd = integrationSnippet("node", base).files[0];
  writeFileSync(path.join(dir, nd.name), nd.code + `\nconst d = await createConsent(); console.log(d.modalUrl); console.log(JSON.stringify(await consentStatus("p-8f3a21")).slice(0, 40));\n`);
  r = await run(process.execPath, [nd.name]);
  assert.equal(r.status, 0, "node: " + r.stderr);
  assert.match(r.stdout, /^\/modal\//);

  const go = integrationSnippet("go", base).files[0];
  const gdir = path.join(dir, "go");
  mkdirSync(gdir);
  writeFileSync(path.join(gdir, go.name), go.code);
  const has = spawnSync("go", ["version"], { encoding: "utf-8" });
  if (has.status !== 0) return; // Go toolchain not present: skipped honestly
  r = await run("go", ["run", go.name], gdir);
  assert.equal(r.status, 0, "go: " + r.stderr);
  assert.match(r.stdout, /\/modal\/[0-9a-f-]{36}#subjectRef=p-8f3a21&token=/);
});

const has = (cmd, args = ["--version"]) => spawnSync(cmd, args, { encoding: "utf-8" }).status === 0;

test("snippets: java compiles and runs against the live server", { timeout: 200000, skip: !has("javac") || !has("java") }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rgpd-java-"));
  const j = integrationSnippet("java", base).files[0];
  writeFileSync(path.join(dir, j.name), j.code);
  const env = { ...process.env, RGPD_MCP_API_KEY: KEY };
  let r = await runAsync("javac", ["-encoding", "UTF-8", j.name], dir, env);
  assert.equal(r.status, 0, "javac: " + r.stderr);
  r = await runAsync("java", ["-Dfile.encoding=UTF-8", "Consent"], dir, env);
  assert.equal(r.status, 0, "java: " + r.stderr);
  assert.match(r.stdout, /"documentId"/);
});

test("snippets: rust builds with cargo and runs against the live server", { timeout: 400000, skip: !has("cargo") }, async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "rgpd-rust-"));
  mkdirSync(path.join(dir, "src"));
  const r0 = integrationSnippet("rust", base).files[0];
  writeFileSync(path.join(dir, r0.name), r0.code);
  writeFileSync(path.join(dir, "Cargo.toml"), '[package]\nname = "consent"\nversion = "0.1.0"\nedition = "2021"\n[dependencies]\nreqwest = { version = "0.12", features = ["blocking", "json"] }\nserde_json = "1"\n');
  const env = { ...process.env, RGPD_MCP_API_KEY: KEY };
  const r = await runAsync("cargo", ["run", "--quiet"], dir, env);
  // Some Windows hosts (security software / policy) refuse to execute a freshly built binary: the snippet still has to COMPILE,
  // and the run is then reported as skipped, never as passed.
  if (r.status !== 0 && /could not execute process|os error (5|32)|Access is denied|Acesso negado/i.test(r.stderr)) {
    const b = await runAsync("cargo", ["build", "--quiet"], dir, env);
    assert.equal(b.status, 0, "cargo build: " + b.stderr.slice(-800));
    return t.skip("the snippet compiles, but this host blocks executing the new binary: " + r.stderr.split("\n").find((l) => /os error|denied|negado/i.test(l)));
  }
  assert.equal(r.status, 0, "cargo: " + r.stderr.slice(-800));
  assert.match(r.stdout, /\/modal\/[0-9a-f-]{36}#subjectRef=p-8f3a21&token=/);
});

test("withdrawal (Art. 7(3)): patient returns with a fresh token, sees granted consents and withdraws with one request", async () => {
  const build = await (await fetch(base + "/v1/consent-documents", { method: "POST", headers: auth, body: JSON.stringify({ ...body, capture: { subjectRef: "p-w-1" } }) })).json();
  const docId = build.documentId;
  const post = (path, b, token) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { "X-Capture-Token": token } : {}) }, body: JSON.stringify(b) });
  assert.equal((await post("/v1/consents", { documentId: docId, subjectRef: "p-w-1", decisions: [{ itemId: "notice_ack", granted: true }, { itemId: "consent:newsletter", granted: true }] }, build.captureToken)).status, 201);

  // a new token for the EXISTING document needs the API key
  assert.equal((await post(`/v1/consent-documents/${docId}/capture`, { subjectRef: "p-w-1" })).status, 401);
  const cap = await (await fetch(`${base}/v1/consent-documents/${docId}/capture`, { method: "POST", headers: auth, body: JSON.stringify({ subjectRef: "p-w-1" }) })).json();
  assert.equal(cap.manageUrl, `/manage/${docId}`);

  const status = (token, subject = "p-w-1") => fetch(`${base}/v1/consents/status?subjectRef=${subject}&documentId=${docId}`, { headers: token ? { "X-Capture-Token": token } : {} });
  assert.equal((await status(null)).status, 401);
  assert.equal((await status(cap.captureToken, "p-other")).status, 401, "token bound to the subject");
  const before = (await (await status(cap.captureToken)).json()).items;
  assert.deepEqual(before.map((i) => [i.itemId, i.granted]), [["consent:newsletter", true]], "only consent items, not the notice");

  assert.equal((await post("/v1/consents/withdraw", { documentId: docId, subjectRef: "p-other", itemIds: ["consent:newsletter"] }, cap.captureToken)).status, 401);
  assert.equal((await post("/v1/consents/withdraw", { documentId: docId, subjectRef: "p-w-1", itemIds: ["notice_ack"] }, cap.captureToken)).status, 422, "the notice acknowledgement is not a withdrawable consent");
  assert.equal((await post("/v1/consents/withdraw", { documentId: docId, subjectRef: "p-w-1", itemIds: ["consent:newsletter"] }, cap.captureToken)).status, 201);
  assert.equal((await (await status(cap.captureToken)).json()).items[0].granted, false);
  const full = await (await fetch(base + "/v1/consents?subjectRef=p-w-1", { headers: auth })).json();
  assert.equal(full.records.at(-1).type, "withdrawal");
  assert.equal((await (await fetch(base + "/v1/ledger/verify", { headers: auth })).json()).ok, true);

  const page = await fetch(`${base}/manage/${docId}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /data-mode="manage"/);
});
