import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { startHttp } from "../dist/http.js";

// End-to-end simulation of examples/clinic: integrator backend <-> rgpd-mcp HTTP API.
// The browser step (user ticks the box in the modal) is replaced by the same POST the widget performs.
const KEY = "clinic-test-key";
let rg, clinic, cbase;

before(async () => {
  rg = await startHttp({ port: 0, apiKey: KEY, stateDir: mkdtempSync(path.join(tmpdir(), "rgpd-clinic-")) });
  const port = 7590 + Math.floor(Math.random() * 300);
  clinic = spawn(process.execPath, ["examples/clinic/server.mjs"], { env: { ...process.env, RGPD_BASE: rg.url, RGPD_MCP_API_KEY: KEY, CLINIC_PORT: String(port) }, stdio: "pipe" });
  cbase = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(cbase + "/")).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("clinic did not start");
});
after(() => { clinic.kill(); rg.server.close(); });

const post = (p, b) => fetch(cbase + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });

async function call(ref) {
  const r = await post("/api/call", { patientRef: ref });
  assert.equal(r.status, 200);
  const j = await r.json();
  const u = new URL(j.modalSrc);
  const frag = new URLSearchParams(u.hash.slice(1));
  assert.equal(frag.get("subjectRef"), ref);
  assert.ok(frag.get("token"));
  assert.equal(u.origin, rg.url);
  return { documentId: j.documentId, token: frag.get("token") };
}
const widgetPost = (documentId, token, ref, decisions) =>
  fetch(rg.url + "/v1/consents", { method: "POST", headers: { "Content-Type": "application/json", "X-Capture-Token": token }, body: JSON.stringify({ documentId, subjectRef: ref, decisions, channel: "recepcao-1" }) });

test("accept notice, refuse newsletter -> care proceeds; refusal of optional consent does not block", async () => {
  const { documentId, token } = await call("p-001");
  assert.equal((await widgetPost(documentId, token, "p-001", [{ itemId: "notice_ack", granted: true }, { itemId: "consent:newsletter", granted: false }])).status, 201);
  const pr = await (await post("/api/proceed", { patientRef: "p-001" })).json();
  assert.equal(pr.proceed, true);
  const care = await fetch(cbase + pr.next);
  assert.equal(care.status, 200);
  assert.match(await care.text(), /recusou/);
});

test("accept notice and newsletter -> care proceeds and newsletter is recorded as accepted", async () => {
  const { documentId, token } = await call("p-003");
  await widgetPost(documentId, token, "p-003", [{ itemId: "notice_ack", granted: true }, { itemId: "consent:newsletter", granted: true }]);
  assert.equal((await (await post("/api/proceed", { patientRef: "p-003" })).json()).proceed, true);
  assert.match(await (await fetch(cbase + "/atendimento?p=p-003")).text(), /aceitou/);
});

test("patient cancels / never confirms -> not allowed to proceed; direct URL is denied (server-side check)", async () => {
  await call("p-002"); // modal shown, then cancelled: the widget posts nothing
  assert.equal((await (await post("/api/proceed", { patientRef: "p-002" })).json()).proceed, false);
  const direct = await fetch(cbase + "/atendimento?p=p-002");
  assert.equal(direct.status, 403);
  assert.match(await direct.text(), /Acesso negado/);
  assert.equal((await fetch(cbase + "/atendimento?p=p-999")).status, 403);
  assert.equal((await fetch(cbase + "/saida?motivo=recusou&p=p-002")).status, 200);
});

test("a new visit requires a new acknowledgement (previous consent does not carry over)", async () => {
  await call("p-001"); // new document for the same patient, nothing answered yet
  assert.equal((await (await post("/api/proceed", { patientRef: "p-001" })).json()).proceed, false);
  assert.equal((await fetch(cbase + "/atendimento?p=p-001")).status, 403);
});

test("token cannot be reused for another patient or document; required item cannot be skipped", async () => {
  const { documentId, token } = await call("p-002");
  assert.equal((await widgetPost(documentId, token, "p-001", [{ itemId: "notice_ack", granted: true }])).status, 401);
  assert.equal((await widgetPost(documentId, token, "p-002", [{ itemId: "consent:newsletter", granted: true }])).status, 422);
  assert.equal((await (await post("/api/proceed", { patientRef: "p-002" })).json()).proceed, false);
});
