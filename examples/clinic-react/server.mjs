// Backend of the React clinic example. It is YOUR backend: it holds the rgpd-mcp API key,
// builds the consent document, and is the only place that decides whether an attendance may start.
//   RGPD_BASE=http://127.0.0.1:7433 RGPD_MCP_API_KEY=... PORT=7600 node server.mjs   (after `npm run build`)
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RGPD = process.env.RGPD_BASE ?? "http://127.0.0.1:7433";
const KEY = process.env.RGPD_MCP_API_KEY ?? "";
const PORT = Number(process.env.PORT ?? 7600);
const APP_ORIGIN = process.env.APP_ORIGIN ?? `http://127.0.0.1:${PORT}`;
const AUTH = { "Content-Type": "application/json", ...(KEY ? { Authorization: "Bearer " + KEY } : {}) };

// Demo data. In your system this comes from your patient/visit tables. Only pseudonymous ids reach rgpd-mcp.
const PATIENTS = { "p-001": "Ana", "p-002": "Bruno", "p-003": "Carla" };
const visits = new Map(); // visitId -> { patientRef, documentId }
let seq = 0;

const consentRequest = (subjectRef) => ({
  country: "PT",
  controller: { name: "Clínica Exemplo, Lda.", address: "Rua Exemplo 1, 1000-001 Lisboa", email: "privacidade@exemplo.pt", dpo: { name: "Encarregado de Proteção de Dados", email: "dpo@exemplo.pt" } },
  dataCategories: ["identification", "contact", "health"],
  purposes: [
    { id: "care", label: "Prestação de cuidados de saúde e gestão do seu processo clínico", legalBasis: "contract", art9Condition: "health_care", required: true, dataCategories: ["identification", "contact", "health"], retention: "Conforme a legislação aplicável aos processos clínicos" },
    { id: "newsletter", label: "Envio de comunicações informativas sobre a clínica", legalBasis: "consent", required: false, dataCategories: ["contact"] },
  ],
  capture: { subjectRef, ttlSeconds: 900 },
});

async function rgpd(p, init = {}) {
  const r = await fetch(RGPD + p, { ...init, headers: { ...AUTH, ...(init.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error ?? `rgpd-mcp ${r.status}`), { status: 502 });
  return j;
}

/** Source of truth. Care may start only if THIS visit's notice was acknowledged. */
async function consentState(visitId) {
  const v = visits.get(visitId);
  if (!v) return { ok: false };
  const { status } = await rgpd("/v1/consents?subjectRef=" + encodeURIComponent(v.patientRef));
  const get = (id) => status.find((s) => s.documentId === v.documentId && s.itemId === id)?.granted === true;
  return { ok: get("notice_ack"), newsletter: get("consent:newsletter"), patient: PATIENTS[v.patientRef] };
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  const url = new URL(req.url, APP_ORIGIN);
  const json = (code, o) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(o)); };
  const body = async () => { let s = ""; for await (const c of req) s += c; return s ? JSON.parse(s) : {}; };
  try {
    if (req.method === "GET" && url.pathname === "/api/config") return json(200, { rgpdOrigin: new URL(RGPD).origin, patients: PATIENTS });

    // 1) attendance about to start: create the visit + the consent document
    if (req.method === "POST" && url.pathname === "/api/consent/start") {
      const { patientRef } = await body();
      if (!PATIENTS[patientRef]) return json(404, { error: "paciente desconhecido" });
      const doc = await rgpd("/v1/consent-documents", { method: "POST", body: JSON.stringify(consentRequest(patientRef)) });
      const visitId = "v-" + ++seq;
      visits.set(visitId, { patientRef, documentId: doc.documentId });
      const frag = new URLSearchParams({ subjectRef: patientRef, token: doc.captureToken, parentOrigin: APP_ORIGIN, channel: "recepcao-react" });
      return json(200, { visitId, modalSrc: `${RGPD}${doc.modalUrl}#${frag}` });
    }
    // 2) after the modal posted 'decision': ask the ledger (never trust the browser event)
    if (req.method === "POST" && url.pathname === "/api/consent/check") {
      const { visitId } = await body();
      const s = await consentState(visitId);
      return json(200, { proceed: s.ok });
    }
    // 3) the route that really starts the attendance re-checks and refuses without consent
    if (req.method === "POST" && url.pathname === "/api/attendance/start") {
      const { visitId } = await body();
      const s = await consentState(visitId);
      if (!s.ok) return json(403, { error: "aviso de proteção de dados não confirmado nesta consulta" });
      return json(200, { started: true, patient: s.patient, newsletter: s.newsletter });
    }

    // static files of the built React app
    const dist = path.join(HERE, "dist");
    let file = path.join(dist, url.pathname === "/" ? "index.html" : url.pathname);
    if (!file.startsWith(dist) || !existsSync(file)) file = path.join(dist, "index.html");
    if (!existsSync(file)) { res.writeHead(500); return res.end("run `npm run build` first"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  } catch (e) {
    json(e.status ?? 500, { error: e.message });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`clinic-react on ${APP_ORIGIN} -> ${RGPD}`));
