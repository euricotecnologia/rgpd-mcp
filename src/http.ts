import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT, articleText, getCountry, listCountries, searchGdpr, availableLocales, gdprLanguages } from "./data.js";
import { ConsentValidationError, buildConsentDocument } from "./consent.js";
import { Ledger, LedgerError, defaultStateDir } from "./ledger.js";
import { BuildSchema, RecordSchema, WithdrawSchema } from "./schemas.js";
import { z } from "zod";
import { coverage } from "./coverage.js";

export interface HttpOptions {
  host?: string;
  port?: number;
  apiKey?: string;
  corsOrigins?: string[];
  frameAncestors?: string[];
  stateDir?: string;
}

const MAX_BODY = 256 * 1024;

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const isStr = typeof body === "string";
  res.writeHead(status, {
    "Content-Type": isStr ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(isStr ? body : JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let n = 0;
  for await (const c of req) {
    n += (c as Buffer).length;
    if (n > MAX_BODY) throw Object.assign(new Error("Payload too large"), { status: 413 });
    chunks.push(c as Buffer);
  }
  if (!n) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { status: 400 });
  }
}

export function createHttpServer(opts: HttpOptions = {}): { server: Server; ledger: Ledger } {
  const ledger = new Ledger(opts.stateDir ?? defaultStateDir());
  const cors = new Set(opts.corsOrigins ?? []);
  const frameAncestors = (opts.frameAncestors?.length ? opts.frameAncestors : ["'self'"]).join(" ");
  const widgetDir = path.join(ROOT, "web");
  const secretFile = path.join(ledger.dir, "capture.secret");
  if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString("hex"), { mode: 0o600 });
  const secret = readFileSync(secretFile, "utf-8").trim();
  const sign = (documentId: string, subjectRef: string, exp: number) => createHmac("sha256", secret).update(`${documentId}|${subjectRef}|${exp}`).digest("base64url");
  const issueToken = (documentId: string, subjectRef: string, ttl: number) => {
    const exp = Math.floor(Date.now() / 1000) + ttl;
    return { token: `${exp}.${sign(documentId, subjectRef, exp)}`, expiresAt: new Date(exp * 1000).toISOString() };
  };
  const tokenOk = (token: string | undefined, documentId: string, subjectRef: string) => {
    if (!token) return false;
    const [expS, mac] = token.split(".");
    const exp = Number(expS);
    if (!mac || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    return safeEqual(mac, sign(documentId, subjectRef, exp));
  };
  const apiAuthed = (req: IncomingMessage) => {
    if (!opts.apiKey) return true;
    const h = req.headers.authorization ?? "";
    return h.startsWith("Bearer ") && safeEqual(h.slice(7), opts.apiKey);
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://local");
    const origin = req.headers.origin;
    const corsHeaders: Record<string, string> = {};
    if (origin && cors.has(origin)) {
      corsHeaders["Access-Control-Allow-Origin"] = origin;
      corsHeaders["Vary"] = "Origin";
      corsHeaders["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
      corsHeaders["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    }
    const reply = (status: number, body: unknown, h: Record<string, string> = {}) => send(res, status, body, { ...corsHeaders, ...h });
    try {
      if (req.method === "OPTIONS") return reply(204, "");
      const p = url.pathname;

      // ---- public, static, non-sensitive ----
      if (req.method === "GET" && p === "/health") return reply(200, { status: "ok", countries: listCountries().length, gdprLanguages: gdprLanguages().length });
      if (req.method === "GET" && (p === "/widget/rgpd-consent.js" || p === "/widget/modal-page.js")) {
        const f = path.join(widgetDir, path.basename(p));
        res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff", ...corsHeaders });
        return res.end(readFileSync(f));
      }
      if (req.method === "GET" && (p.startsWith("/modal/") || p.startsWith("/manage/"))) {
        const mode = p.startsWith("/manage/") ? "manage" : "consent";
        const id = decodeURIComponent(p.slice(mode === "manage" ? 8 : 7));
        if (!/^[0-9a-f-]{36}$/.test(id)) return reply(400, { error: "bad id" });
        const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consent</title></head><body style="margin:0;background:transparent"><script src="/widget/rgpd-consent.js"></script><script src="/widget/modal-page.js" data-document-id="${id}" data-mode="${mode}"></script></body></html>`;
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": `default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors ${frameAncestors}; base-uri 'none'; form-action 'none'`,
        });
        return res.end(html);
      }

      // ---- document text is public (it contains no data-subject data; id is an unguessable UUID) ----
      let m = p.match(/^\/v1\/consent-documents\/([0-9a-f-]{36})$/);
      if (req.method === "GET" && m) {
        const d = ledger.getDocument(m[1]!);
        return d ? reply(200, d) : reply(404, { error: "document not found" });
      }
      // ---- recording a decision: API key OR a short-lived capture token bound to document+subject ----
      if (req.method === "POST" && p === "/v1/consents") {
        const body = RecordSchema.parse(await readJson(req));
        const tok = (req.headers["x-capture-token"] as string | undefined) ?? undefined;
        if (!apiAuthed(req) && !tokenOk(tok, body.documentId, body.subjectRef)) return reply(401, { error: "unauthorized" }, { "WWW-Authenticate": "Bearer" });
        return reply(201, ledger.recordDecision(body));
      }
      // ---- withdrawal (Art. 7(3)) must be as easy as giving: same capture-token mechanism as recording ----
      if (req.method === "POST" && p === "/v1/consents/withdraw") {
        const body = WithdrawSchema.parse(await readJson(req));
        const tok = (req.headers["x-capture-token"] as string | undefined) ?? undefined;
        if (!apiAuthed(req) && !tokenOk(tok, body.documentId, body.subjectRef)) return reply(401, { error: "unauthorized" }, { "WWW-Authenticate": "Bearer" });
        return reply(201, ledger.withdraw(body));
      }
      if (req.method === "GET" && p === "/v1/consents/status") {
        const subjectRef = url.searchParams.get("subjectRef") ?? "";
        const documentId = url.searchParams.get("documentId") ?? "";
        const tok = (req.headers["x-capture-token"] as string | undefined) ?? undefined;
        if (!apiAuthed(req) && !tokenOk(tok, documentId, subjectRef)) return reply(401, { error: "unauthorized" }, { "WWW-Authenticate": "Bearer" });
        return reply(200, { items: ledger.itemStatus(subjectRef, documentId) });
      }
      // ---- everything else needs the API key (when configured) ----
      if (!apiAuthed(req)) return reply(401, { error: "unauthorized" }, { "WWW-Authenticate": "Bearer" });

      if (req.method === "GET" && p === "/v1/meta") return reply(200, { gdprLanguages: gdprLanguages(), uiLocales: availableLocales(), coverage: coverage() });
      if (req.method === "GET" && p === "/v1/countries") return reply(200, listCountries().map((c) => ({ code: c.code, name: c.name, region: c.region, languages: c.languages, digitalConsentAge: c.digitalConsentAge.value, status: coverage().byCountry[c.code] })));
      m = p.match(/^\/v1\/countries\/([A-Za-z]{2})$/);
      if (req.method === "GET" && m) return reply(200, getCountry(m[1]!));
      m = p.match(/^\/v1\/gdpr\/([a-z]{2})\/articles\/(\d{1,3})$/);
      if (req.method === "GET" && m) return reply(200, articleText(m[1]!, m[2]!));
      m = p.match(/^\/v1\/gdpr\/([a-z]{2})\/search$/);
      if (req.method === "GET" && m) return reply(200, searchGdpr(m[1]!, url.searchParams.get("q") ?? "", Number(url.searchParams.get("limit") ?? 10)));

      if (req.method === "POST" && p === "/v1/consent-documents") {
        const raw = (await readJson(req)) as Record<string, unknown>;
        const input = BuildSchema.parse(raw);
        const cap = z.object({ subjectRef: z.string().min(1).max(128), ttlSeconds: z.number().int().min(30).max(86400).optional() }).optional().parse(raw["capture"]);
        const doc = buildConsentDocument(input);
        ledger.saveDocument(doc);
        const out: Record<string, unknown> = { ...doc, modalUrl: `/modal/${doc.documentId}` };
        if (cap) {
          const t = issueToken(doc.documentId, cap.subjectRef, cap.ttlSeconds ?? 3600);
          Object.assign(out, { captureToken: t.token, captureExpiresAt: t.expiresAt, captureSubjectRef: cap.subjectRef });
        }
        return reply(201, out);
      }
      m = p.match(/^\/v1\/consent-documents\/([0-9a-f-]{36})\/capture$/);
      if (req.method === "POST" && m) {
        // new short-lived token for an EXISTING document (e.g. the patient comes back to manage/withdraw consents)
        if (!ledger.getDocument(m[1]!)) return reply(404, { error: "document not found" });
        const c = z.object({ subjectRef: z.string().min(1).max(128), ttlSeconds: z.number().int().min(30).max(86400).optional() }).parse(await readJson(req));
        const t = issueToken(m[1]!, c.subjectRef, c.ttlSeconds ?? 900);
        return reply(201, { captureToken: t.token, captureExpiresAt: t.expiresAt, manageUrl: `/manage/${m[1]}` });
      }
      if (req.method === "GET" && p === "/v1/consents") {
        const s = url.searchParams.get("subjectRef");
        if (!s) return reply(400, { error: "subjectRef required" });
        return reply(200, { status: ledger.status(s), records: ledger.records(s) });
      }
      if (req.method === "GET" && p === "/v1/ledger/verify") return reply(200, ledger.verify());

      return reply(404, { error: "not found" });
    } catch (e) {
      const err = e as Error & { status?: number; issues?: unknown };
      if (e instanceof ConsentValidationError) return reply(422, { error: "invalid consent document", issues: e.issues });
      if (e instanceof LedgerError) return reply(e.code === "DOC_NOT_FOUND" ? 404 : 422, { error: err.message, code: e.code });
      if (err.name === "ZodError") return reply(400, { error: "invalid request", issues: (e as { issues?: unknown }).issues });
      if (err.status) return reply(err.status, { error: err.message });
      if (/^(Country|GDPR text|Article)/.test(err.message)) return reply(404, { error: err.message });
      process.stderr.write(`[rgpd-mcp] internal error: ${err.stack ?? err}\n`);
      return reply(500, { error: "internal error" });
    }
  });
  return { server, ledger };
}

export function startHttp(opts: HttpOptions = {}): Promise<{ server: Server; url: string; ledger: Ledger }> {
  const host = opts.host ?? "127.0.0.1";
  const { server, ledger } = createHttpServer(opts);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port ?? 7433, host, () => {
      const a = server.address();
      const port = typeof a === "object" && a ? a.port : opts.port;
      resolve({ server, url: `http://${host}:${port}`, ledger });
    });
  });
}
