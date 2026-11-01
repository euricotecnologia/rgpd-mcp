// Simulated medical clinic integrating rgpd-mcp over HTTP only (no code from the package is imported).
// Roles: this is the *integrator's* backend. It holds the API key; the browser only gets a short-lived capture token.
//   node examples/clinic/server.mjs   (env: RGPD_BASE, RGPD_MCP_API_KEY, CLINIC_PORT)
import { createServer } from "node:http";

const RGPD = process.env.RGPD_BASE ?? "http://127.0.0.1:7433";
const KEY = process.env.RGPD_MCP_API_KEY ?? "";
const PORT = Number(process.env.CLINIC_PORT ?? 7500);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const H = { "Content-Type": "application/json", ...(KEY ? { Authorization: "Bearer " + KEY } : {}) };

// pseudonymous references only: the consent ledger never sees names
const PATIENTS = { "p-001": "Ana (1.ª consulta)", "p-002": "Bruno (1.ª consulta)", "p-003": "Carla (1.ª consulta)" };

const documentRequest = (subjectRef) => ({
  country: "PT",
  controller: { name: "Clínica Exemplo, Lda.", address: "Rua Exemplo 1, 1000-001 Lisboa", email: "privacidade@exemplo.pt", dpo: { name: "Encarregado de Proteção de Dados", email: "dpo@exemplo.pt" } },
  dataCategories: ["identification", "contact", "health"],
  purposes: [
    { id: "care", label: "Prestação de cuidados de saúde e gestão do seu processo clínico", legalBasis: "contract", art9Condition: "health_care", required: true, dataCategories: ["identification", "contact", "health"], retention: "Conforme a legislação aplicável aos processos clínicos" },
    { id: "newsletter", label: "Envio de comunicações informativas sobre a clínica", legalBasis: "consent", required: false, dataCategories: ["contact"] },
  ],
  capture: { subjectRef, ttlSeconds: 900 },
});

const state = new Map(); // subjectRef -> latest documentId (server side)

async function rgpd(path, init = {}) {
  const r = await fetch(RGPD + path, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error ?? "rgpd-mcp " + r.status), { status: r.status, body: j });
  return j;
}

/** Source of truth: ask the consent ledger (server to server). Care may start only if the notice was acknowledged for THIS visit's document. */
async function noticeAcknowledged(subjectRef) {
  const docId = state.get(subjectRef);
  if (!docId) return { ok: false, reason: "no document shown" };
  const { status } = await rgpd("/v1/consents?subjectRef=" + encodeURIComponent(subjectRef));
  const ack = status.find((s) => s.documentId === docId && s.itemId === "notice_ack");
  const news = status.find((s) => s.documentId === docId && s.itemId === "consent:newsletter");
  return { ok: !!ack?.granted, newsletter: !!news?.granted };
}

const page = (title, body, extra = "") => `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#f4f6f9;color:#14181f}header{background:#0b57d0;color:#fff;padding:14px 24px}main{max-width:760px;margin:24px auto;padding:0 16px}
.card{background:#fff;border:1px solid #d5dae1;border-radius:10px;padding:16px;margin:12px 0}button,a.btn{font:inherit;padding:10px 18px;border-radius:8px;border:1px solid #0b57d0;background:#0b57d0;color:#fff;cursor:pointer;text-decoration:none;display:inline-block}
.ok{border-color:#1a7f37;background:#e9f7ee}.warn{border-color:#b26a00;background:#fff4dc}.row{display:flex;justify-content:space-between;align-items:center;gap:12px}
#overlay{position:fixed;inset:0;border:0;width:100%;height:100%;background:transparent;z-index:10;display:none}</style></head><body>
<header><b>Clínica Exemplo</b> — sistema de atendimento (simulação)</header><main>${body}</main>${extra}</body></html>`;

const reception = () =>
  page("Receção", `<h2>Fila de atendimento</h2><p>O paciente é chamado; antes de iniciar, deve confirmar o aviso de proteção de dados.</p>
${Object.entries(PATIENTS).map(([ref, name]) => `<div class="card row"><span>${name} <small>(${ref})</small></span><button data-ref="${ref}">Chamar paciente</button></div>`).join("")}
<div id="msg"></div><iframe id="overlay" title="Aviso de proteção de dados"></iframe>`,
`<script>
const msg=document.getElementById('msg'), ov=document.getElementById('overlay'); let current=null;
document.querySelectorAll('button[data-ref]').forEach(b=>b.addEventListener('click',async()=>{
  current=b.dataset.ref; msg.innerHTML='';
  const r=await fetch('/api/call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientRef:current})});
  const j=await r.json(); if(!r.ok){msg.innerHTML='<div class="card warn">Erro: '+j.error+'</div>';return}
  ov.src=j.modalSrc; ov.style.display='block';
}));
window.addEventListener('message',async(e)=>{
  if(e.origin!==${JSON.stringify(RGPD)}||!e.data||e.data.source!=='rgpd-mcp')return;
  ov.style.display='none'; ov.removeAttribute('src');
  if(e.data.type==='decision'){
    const r=await fetch('/api/proceed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientRef:current})}); const j=await r.json();
    if(j.proceed) location.href=j.next; else location.href='/saida?motivo=sem-confirmacao&p='+encodeURIComponent(current);
  } else if(e.data.type==='cancel'){
    msg.innerHTML='<div class="card warn" id="declined"><b>Sem a confirmação do aviso de proteção de dados não podemos iniciar o atendimento digital.</b><br>O paciente será encaminhado para a receção presencial.<br><br><a class="btn" id="goexit" href="/saida?motivo=recusou&p='+encodeURIComponent(current)+'">Ir para a saída alternativa</a></div>';
  } else if(e.data.type==='error'){ msg.innerHTML='<div class="card warn">Erro no consentimento: '+(e.data.payload&&e.data.payload.message)+'</div>'; }
});
</script>`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  const send = (code, body, type = "text/html; charset=utf-8") => { res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(body); };
  const json = (code, o) => send(code, JSON.stringify(o), "application/json");
  const body = async () => { let s = ""; for await (const c of req) s += c; return s ? JSON.parse(s) : {}; };
  try {
    if (url.pathname === "/") return send(200, reception());
    if (req.method === "POST" && url.pathname === "/api/call") {
      const { patientRef } = await body();
      if (!PATIENTS[patientRef]) return json(404, { error: "paciente desconhecido" });
      const doc = await rgpd("/v1/consent-documents", { method: "POST", body: JSON.stringify(documentRequest(patientRef)) });
      state.set(patientRef, doc.documentId);
      const frag = new URLSearchParams({ subjectRef: patientRef, token: doc.captureToken, parentOrigin: ORIGIN, channel: "recepcao-1" });
      return json(200, { modalSrc: `${RGPD}${doc.modalUrl}#${frag}`, documentId: doc.documentId });
    }
    if (req.method === "POST" && url.pathname === "/api/proceed") {
      const { patientRef } = await body();
      const r = await noticeAcknowledged(patientRef);
      return json(200, r.ok ? { proceed: true, next: "/atendimento?p=" + encodeURIComponent(patientRef) } : { proceed: false });
    }
    if (url.pathname === "/atendimento") {
      const p = url.searchParams.get("p") ?? "";
      const r = PATIENTS[p] ? await noticeAcknowledged(p) : { ok: false };
      if (!r.ok) return send(403, page("Acesso negado", `<div class="card warn" id="denied"><b>Acesso negado:</b> o aviso de proteção de dados não foi confirmado para esta consulta.</div><a class="btn" href="/">Voltar à receção</a>`));
      return send(200, page("Atendimento", `<div class="card ok" id="care"><h2>Atendimento iniciado</h2><p>Paciente: ${PATIENTS[p]}</p><p id="news">Comunicações informativas: <b>${r.newsletter ? "aceitou" : "recusou"}</b> (não afeta o atendimento).</p></div><a class="btn" href="/">Voltar à receção</a>`));
    }
    if (url.pathname === "/saida") {
      return send(200, page("Saída alternativa", `<div class="card warn" id="exit"><h2>Encaminhado para a receção presencial</h2><p>O atendimento digital não foi iniciado porque o aviso de proteção de dados não foi confirmado. Um funcionário prestará o atendimento e informará o paciente presencialmente.</p><p><small>Motivo: ${(url.searchParams.get("motivo") ?? "").replace(/[^a-z-]/g, "")}</small></p></div><a class="btn" href="/">Voltar à receção</a>`));
    }
    send(404, "not found", "text/plain");
  } catch (e) {
    json(e.status ?? 500, { error: e.message });
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`clinic on ${ORIGIN} using ${RGPD}`));
