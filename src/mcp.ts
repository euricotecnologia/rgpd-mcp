import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spawn } from "node:child_process";
import { z } from "zod";
import { ART6, ART9, DATA_CATEGORIES, ConsentValidationError, buildConsentDocument } from "./consent.js";
import { articleText, gdprLanguages, getCountry, getGdpr, listCountries, searchGdpr, availableLocales } from "./data.js";
import { coverage, countryState } from "./coverage.js";
import type { Ledger } from "./ledger.js";
import { BuildSchema } from "./schemas.js";
import { SNIPPET_LANGUAGES, integrationSnippet } from "./snippets.js";
import { LocaleSchema } from "./schemas.js";
import { resolveLocale, type GeoResolver } from "./locale.js";

export const VERSION = "1.0.0";

const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
const fail = (e: unknown) => ({ isError: true, content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }] });

function openInBrowser(url: string) {
  // Only ever invoked with our own http://127.0.0.1:<port>/modal/<uuid> URL (validated by the caller).
  if (process.platform === "win32") spawn("cmd", ["/c", "start", "", url.replace(/&/g, "^&")], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  else if (process.platform === "darwin") spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  else spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

export interface McpContext {
  ledger: Ledger;
  /** Base URL of the HTTP API/modal server when it is running in this or another process. */
  httpBase?: string;
  /** Optional local IP -> country resolver. */
  geoip?: GeoResolver;
}

export function createMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: "rgpd", version: VERSION },
    {
      instructions: [
        "RGPD/GDPR MCP: official GDPR text (24 EU languages), national data-protection profiles of European countries, a consent-document builder and a language-agnostic consent modal.",
        "Rules: (1) legal statements come only from the official texts returned by tools; never invent article numbers or national rules. (2) Each country profile fact has a status: verified / inferred / unverified. Treat only 'verified' as authoritative and tell the user about the others. (3) Build documents with build_consent_document; it rejects unlawful designs (e.g. special-category data without an Art. 9(2) condition, mandatory consent). (4) You build forms; the data subject records consent through the modal. Never record consent on someone's behalf. (5) This is not legal advice: a DPO/lawyer must review before production.",
        "WHEN THE USER ASKS TO CREATE/INTEGRATE/IMPLEMENT consent, the data-protection law or the privacy notice IN THEIR SYSTEM (e.g. when a patient attendance starts): do not just explain. Do the whole job in their project: call get_integration_guide first, explore the project, validate with build_consent_document, implement backend + frontend modal + server-side gate + alternative exit, write and run the tests, and report what was and was not verified. If a subagent named rgpd-integrador is available, delegate to it.",
      ].join(" "),
    },
  );

  server.registerTool(
    "list_countries",
    {
      title: "List European countries",
      description: "Lists countries available with their official languages, supervisory authority, digital age of consent and verification status. Also returns the coverage report.",
      inputSchema: { region: z.enum(["EU", "EEA", "UK", "CH", "OTHER"]).optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ region }) => {
      try {
        const list = listCountries().filter((c) => !region || c.region === region);
        return text({
          coverage: coverage(),
          countries: list.map((c) => ({ code: c.code, name: c.name, region: c.region, languages: c.languages, authority: c.authority.name, digitalConsentAge: c.digitalConsentAge.value, ageStatus: c.digitalConsentAge.status, status: countryState(c) })),
        });
      } catch (e) { return fail(e); }
    },
  );

  server.registerTool(
    "get_country_law",
    {
      title: "Country data-protection profile",
      description: "Full profile of a country: national implementing laws (official title, number, date, link), supervisory authority, digital age of consent (Art. 8 GDPR) and national health-data provisions (Art. 9(4)), each with verification status and evidence.",
      inputSchema: { country: z.string().length(2).describe("ISO 3166-1 alpha-2") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ country }) => { try { return text({ status: countryState(getCountry(country)), profile: getCountry(country) }); } catch (e) { return fail(e); } },
  );

  server.registerTool(
    "get_gdpr_article",
    {
      title: "Official GDPR article",
      description: "Returns the authentic text of an article of Regulation (EU) 2016/679 in one of the 24 official EU languages (e.g. 'pt', 'es', 'fr', 'de', 'en').",
      inputSchema: { article: z.number().int().min(1).max(99), language: z.string().length(2).default("en") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ article, language }) => { try { return text(articleText(language, article)); } catch (e) { return fail(e); } },
  );

  server.registerTool(
    "get_gdpr_recital",
    {
      title: "Official GDPR recital",
      description: "Returns a recital (considerando) of Regulation (EU) 2016/679 in the given official language.",
      inputSchema: { recital: z.number().int().min(1).max(173), language: z.string().length(2).default("en") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ recital, language }) => {
      try { const d = getGdpr(language); const t = d.recitals[String(recital)]; if (!t) throw new Error("Recital not found"); return text({ recital, language: d.language, text: t }); } catch (e) { return fail(e); }
    },
  );

  server.registerTool(
    "search_gdpr",
    {
      title: "Search GDPR text",
      description: "Keyword search over the official GDPR articles and recitals in the given language.",
      inputSchema: { query: z.string().min(2).max(200), language: z.string().length(2).default("en"), limit: z.number().int().min(1).max(30).default(10) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, language, limit }) => { try { return text(searchGdpr(language, query, limit)); } catch (e) { return fail(e); } },
  );

  server.registerTool(
    "get_reference",
    {
      title: "Reference enumerations",
      description: "Lists data categories, Art. 6(1) legal bases, Art. 9(2) conditions, supported UI locales, and the design rules the builder enforces. Call before build_consent_document.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => text({
      dataCategories: Object.entries(DATA_CATEGORIES).map(([k, v]) => ({ id: k, specialCategory: v.special })),
      art6Bases: Object.entries(ART6).map(([k, v]) => ({ id: k, article: `6(1)(${v})` })),
      art9Conditions: Object.entries(ART9).map(([k, v]) => ({ id: k, article: `9(2)(${v})` })),
      uiLocales: availableLocales(),
      gdprTextLanguages: gdprLanguages(),
      rules: [
        "Special-category data (Art. 9(1)) needs an Art. 9(2) condition in every purpose that processes it.",
        "Healthcare provision uses Art. 9(2)(h) (+ Art. 9(3) professional secrecy), not consent: present it as an information notice (required=true).",
        "Consent-based purposes must be optional (required=false), separate per purpose, and unticked by default (Art. 7(2),(4); recital 32, 43).",
        "Withdrawal must be as easy as giving consent (Art. 7(3)).",
        "Art. 8 (child consent) applies to information society services offered directly to a child; in-person care follows national health/civil law on capacity.",
      ],
    }),
  );

  server.registerTool(
    "build_consent_document",
    {
      title: "Build consent document",
      description: "Builds a legally-grounded consent/information document for a country in its official language, validates it against GDPR rules, stores it, and returns the document (sections quoting the official GDPR text, items to tick, issues) plus the modal URL when the HTTP server is running. Fails with explicit reasons if the design is unlawful.",
      inputSchema: BuildSchema,
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      try {
        const doc = buildConsentDocument(input);
        ctx.ledger.saveDocument(doc);
        return text({
          documentId: doc.documentId,
          documentHash: doc.documentHash,
          country: doc.country,
          language: doc.language,
          dataStatus: doc.dataStatus,
          issues: doc.issues,
          items: doc.items,
          guardian: doc.guardian,
          sections: doc.sections.map((s) => ({ id: s.id, heading: s.heading, paragraphs: s.paragraphs, legalRefs: s.legalRefs.map((r) => ({ citation: r.citation, title: r.title, verification: r.verification, source: r.source })) })),
          modalUrl: ctx.httpBase ? `${ctx.httpBase}/modal/${doc.documentId}` : null,
          note: ctx.httpBase ? "Open modalUrl (needs #subjectRef=... and a capture token from POST /v1/consent-documents to record) or use open_consent_modal for a local preview." : "HTTP server not running: start `rgpd-mcp http` to display the modal.",
        });
      } catch (e) {
        if (e instanceof ConsentValidationError) return { isError: true, content: [{ type: "text" as const, text: JSON.stringify({ error: "invalid consent document", issues: e.issues }, null, 2) }] };
        return fail(e);
      }
    },
  );

  server.registerTool(
    "open_consent_modal",
    {
      title: "Preview modal in local browser",
      description: "Opens the consent modal for a built document in the user's default browser (developer preview). Decisions made in a preview are recorded under subjectRef 'preview-<n>' only if the user confirms. Requires the local HTTP server.",
      inputSchema: { documentId: z.string().length(36) },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ documentId }) => {
      try {
        if (!ctx.httpBase) throw new Error("HTTP server is not running; start `rgpd-mcp http` or use `rgpd-mcp serve --http`.");
        if (!/^[0-9a-f-]{36}$/.test(documentId) || !ctx.ledger.getDocument(documentId)) throw new Error("Unknown documentId");
        if (!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(ctx.httpBase)) throw new Error("Preview only opens loopback URLs.");
        const url = `${ctx.httpBase}/modal/${documentId}`;
        openInBrowser(url);
        return text({ opened: url, note: "Preview shows the dialog; without a capture token it will not record anything." });
      } catch (e) { return fail(e); }
    },
  );

  server.registerTool(
    "get_consent_status",
    {
      title: "Consent status of a subject",
      description: "Current effective consent per item for a pseudonymous subjectRef (last event wins; withdrawals included). Read-only.",
      inputSchema: { subjectRef: z.string().min(1).max(128) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ subjectRef }) => { try { return text({ status: ctx.ledger.status(subjectRef) }); } catch (e) { return fail(e); } },
  );

  server.registerTool(
    "verify_ledger",
    {
      title: "Verify consent ledger integrity",
      description: "Recomputes the hash chain of the consent ledger and reports the first broken record, if any.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => text(ctx.ledger.verify()),
  );

  server.registerTool(
    "resolve_locale",
    {
      title: "Suggest country and language (optional)",
      description: "OPTIONAL. Suggests the country (and so the national law) and the language for the consent modal from the clinic's country, an explicit user choice, the visitor IP (local GeoIP database only, if configured) and the Accept-Language header, in that priority. The result is a suggestion with its source and warnings: the applicable law does not follow the IP (GDPR Art. 3). The IP is personal data: pass it only from your own trusted backend; nothing is stored or logged. Feed `country` and `language` to build_consent_document.",
      inputSchema: LocaleSchema.shape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => { try { return text({ ...resolveLocale(input, ctx.geoip), geoip: ctx.geoip?.kind ?? null }); } catch (e) { return fail(e); } },
  );

  server.registerTool(
    "get_integration_snippet",
    {
      title: "Integration code",
      description: "Returns ready-to-use integration code for a programming language (html, react, node, go, java, rust, delphi, python, csharp, php) with an honest note on whether it was executed in this project's tests.",
      inputSchema: { language: z.enum(SNIPPET_LANGUAGES), baseUrl: z.string().url().optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ language, baseUrl }) => { try { return text(integrationSnippet(language, baseUrl ?? ctx.httpBase)); } catch (e) { return fail(e); } },
  );


  server.registerTool(
    "get_integration_guide",
    {
      title: "Integration guide for a clinic/health system",
      description: "Returns the complete recipe an agent must follow to add GDPR consent to a health system when an appointment/attendance starts: architecture, endpoints to create, server-side gate, security rules, a ready build_consent_document request for the first visit, and acceptance tests. Call this first when asked to 'create the data-protection law/consent in my system'.",
      inputSchema: { country: z.string().length(2).default("PT"), language: z.enum(SNIPPET_LANGUAGES).optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ country, language }) => {
      try {
        const profile = getCountry(country);
        const base = ctx.httpBase ?? "http://127.0.0.1:7433";
        return text({
          goal: "When a patient's attendance starts, show the data-protection notice/consent modal; continue only if the patient confirmed the notice; otherwise show a message and route to an alternative exit.",
          country: { code: profile.code, status: countryState(profile), languages: profile.languages, note: "Tell the user which facts are not 'verified' (get_country_law)." },
          architecture: [
            "BACKEND (holds the API key) -> POST {base}/v1/consent-documents  => documentId, modalUrl, captureToken",
            "FRONTEND shows {base}{modalUrl}#subjectRef=..&token=..&parentOrigin=<app origin> in an iframe/WebView (or <rgpd-consent-modal>); listens for postMessage {source:'rgpd-mcp', type:'decision'|'cancel'|'error'}",
            "BACKEND gate -> GET {base}/v1/consents?subjectRef=..  and allow the attendance only if item 'notice_ack' is granted for THIS visit's documentId",
            "Cancel/no confirmation -> message to the patient + alternative exit (e.g. in-person reception). Never start the attendance.",
          ],
          environment: { RGPD_BASE_URL: base, RGPD_MCP_API_KEY: "secret, backend only, never sent to the browser", startServer: "RGPD_MCP_API_KEY=<key> node <path>/dist/cli.js http --port 7433 --frame-ancestors <app origin>" },
          endpointsToCreateInTheSystem: [
            { method: "POST", path: "/api/consent/start", does: "Called when the attendance is about to start. Builds the document (request below) with capture.subjectRef = pseudonymous patient id; returns {modalSrc, documentId}. Store documentId on the visit." },
            { method: "POST", path: "/api/consent/check", does: "Called after the modal posts 'decision'. Reads the ledger server-side and returns {proceed:boolean}. This, not the browser event, decides." },
            { method: "(existing) start-attendance route/handler", does: "Must re-check the ledger and refuse (403) when notice_ack is not granted for the visit's documentId." },
          ],
          firstVisitRequest: {
            note: "Replace controller data with the clinic's real data (ask the user if unknown). care = information notice (Art. 9(2)(h)); optional purposes are separate consents (required=false).",
            body: {
              country: profile.code,
              controller: { name: "<CLINIC LEGAL NAME>", address: "<ADDRESS>", email: "<PRIVACY E-MAIL>", dpo: { name: "<DPO NAME>", email: "<DPO E-MAIL>" } },
              dataCategories: ["identification", "contact", "health"],
              purposes: [
                { id: "care", label: "<care provision wording in the document language>", legalBasis: "contract", art9Condition: "health_care", required: true, dataCategories: ["identification", "contact", "health"], retention: "<per applicable clinical-record law>" },
                { id: "newsletter", label: "<optional communications wording>", legalBasis: "consent", required: false, dataCategories: ["contact"] },
              ],
              capture: { subjectRef: "<pseudonymous patient id>", ttlSeconds: 900 },
            },
          },
          withdrawal: {
            why: "Art. 7(3): withdrawing consent must be as easy as giving it. Give the patient a place to do it (e.g. 'Manage my consents' in the patient area or at the reception).",
            how: [
              "BACKEND (API key): POST {base}/v1/consent-documents/{documentId}/capture with {subjectRef} -> {captureToken, manageUrl}. Store documentId per visit/consent.",
              "FRONTEND: show {base}{manageUrl}#subjectRef=..&token=.. in an iframe/WebView (same as the consent modal). It lists the consents given and withdraws each with one click; events: rgpd:withdrawn, rgpd:closed.",
              "BACKEND: stop the processing that depended on the withdrawn consent (e.g. remove the patient from the newsletter list) when GET {base}/v1/consents?subjectRef=.. shows granted=false.",
            ],
            note: "The notice acknowledgement is not a consent and cannot be withdrawn here; care does not depend on consent.",
          },
          optionalCountryDetection: {
            note: "ONLY if the user asks for automatic country/language detection. Otherwise use the fixed country of the clinic.",
            how: [
              "BACKEND: POST {base}/v1/resolve-locale (API key) with {ip: <client IP validated by YOUR proxy setup>, acceptLanguage: <request header>, establishmentCountry: <clinic country, if fixed>, userChoice: {country?, language?}} -> {country, language, countrySource, supported, needsUserChoice, languageOptions, warnings}.",
              "Use the returned country/language in POST /v1/consent-documents. If needsUserChoice is true, show a country/language picker first and call again with userChoice.",
              "Offer the person a way to change country/language (required when languageOptions has several languages).",
              "Server option: start with --geoip-db <file.mmdb> (or RGPD_GEOIP_DB). The database is local (GeoLite2/DB-IP); the IP never leaves the machine and is never stored. Without a database the endpoint still works from the other signals.",
            ],
            rules: [
              "The IP is personal data: do not log or store it; mention it in the privacy notice.",
              "Priority: clinic establishment > explicit user choice > IP > Accept-Language. In-person care follows the clinic's country, not the IP.",
              "Behind a proxy, never trust a raw X-Forwarded-For from the client.",
              "A country without a profile in this project (e.g. UK, CH, rest of the world) returns needsUserChoice: do not apply another country's law silently.",
            ],
          },
          rules: [
            "subjectRef is an opaque pseudonymous id: never name, e-mail, phone or national id.",
            "The API key stays in the backend. The browser only gets the short-lived captureToken.",
            "Optional consents never block care. Only the notice acknowledgement gates the digital attendance, and that gate is the clinic's decision, not a GDPR requirement.",
            "Each new visit builds a new document and needs a new acknowledgement.",
            "Do not record consent on the patient's behalf; do not pre-tick boxes; do not auto-confirm.",
            "Run build_consent_document first to validate the design and read its issues; report every non-verified fact and recommend DPO/legal review.",
          ],
          acceptanceTests: [
            "accept notice -> attendance starts",
            "refuse optional consent only -> attendance still starts",
            "cancel the modal -> message shown and alternative exit; attendance route returns 403 when called directly",
            "second visit of the same patient -> modal shown again",
            "token of patient A rejected for patient B (401)",
          ],
          reference: "examples/clinic/server.mjs in the rgpd-mcp repository is a complete working example (Node, no dependencies).",
          snippet: language ? integrationSnippet(language, base) : "Pass `language` (html, react, node, go, java, rust, delphi, python, csharp, php) to get ready code, or call get_integration_snippet.",
        });
      } catch (e) { return fail(e); }
    },
  );

  server.registerResource(
    "gdpr-article",
    new ResourceTemplate("rgpd://gdpr/{language}/article/{number}", { list: undefined }),
    { title: "GDPR article", description: "Official GDPR article text", mimeType: "application/json" },
    async (uri, vars) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(articleText(String(vars["language"]), String(vars["number"])), null, 1) }] }),
  );
  server.registerResource(
    "country-profile",
    new ResourceTemplate("rgpd://country/{code}", { list: undefined }),
    { title: "Country profile", description: "National data-protection profile", mimeType: "application/json" },
    async (uri, vars) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(getCountry(String(vars["code"])), null, 1) }] }),
  );

  server.registerPrompt(
    "integrar_no_sistema",
    {
      title: "Criar o consentimento RGPD no meu sistema (início do atendimento)",
      description: "Implementa, no projeto aberto, a janela de consentimento RGPD ao iniciar o atendimento do paciente, com bloqueio no servidor e saída alternativa.",
      argsSchema: { country: z.string().length(2).describe("Pais do tratamento, ex. PT"), clinicName: z.string().describe("Nome legal da clinica"), stack: z.string().optional().describe("Linguagem/framework do sistema, se souber") },
    },
    ({ country, clinicName, stack }) => ({
      messages: [{
        role: "user" as const,
        content: { type: "text" as const, text: `Use o MCP rgpd para criar, NESTE projeto, o consentimento/aviso de proteção de dados quando o atendimento de um paciente é iniciado.
Clínica: "${clinicName}". País: ${country.toUpperCase()}.${stack ? ` Stack: ${stack}.` : ""}

Faça, por esta ordem:
1. Explore o projeto: linguagem/framework, onde o atendimento é iniciado (rota/ecrã/handler), como o frontend é servido e onde ficam configurações/variáveis de ambiente. Não invente: leia o código.
2. Chame get_integration_guide (country=${country.toUpperCase()}, language = a do projeto se for uma das suportadas), get_reference e get_country_law. Anote todo facto que não esteja "verified".
3. Valide o desenho chamando build_consent_document com o pedido de primeira consulta do guia, preenchendo os dados da clínica com o que o projeto já tiver (se faltar morada, e-mail de privacidade ou DPO, pergunte-me). Leia os "issues".
4. Implemente no projeto, seguindo o guia: (a) endpoint backend que cria o documento e devolve o URL do modal; (b) o frontend que mostra o modal ao iniciar o atendimento e reage a decision/cancel/error; (c) endpoint backend que consulta o ledger e devolve proceed; (d) bloqueio no servidor na própria rota que inicia o atendimento; (e) mensagem + saída alternativa quando o paciente não confirma; (f) variáveis RGPD_BASE_URL e RGPD_MCP_API_KEY só no backend.
5. Escreva e execute testes para os 5 casos de aceitação do guia.
6. No fim, diga-me: o que criou, como subir o servidor rgpd-mcp, os factos não verificados do país, e que é preciso revisão do DPO/jurista. Não registe consentimento em nome do paciente, não use nome/e-mail como subjectRef e não exponha a chave de API ao navegador.` },
      }],
    }),
  );

  server.registerPrompt(
    "healthcare_first_visit",
    {
      title: "Consent flow for a patient's first visit",
      description: "Guides the agent to design the first-visit notice and optional consents for a health system.",
      argsSchema: { country: z.string().length(2), clinicName: z.string() },
    },
    ({ country, clinicName }) => ({
      messages: [{
        role: "user" as const,
        content: { type: "text" as const, text: `Design the first-visit data-protection flow for "${clinicName}" in ${country.toUpperCase()}. Call get_integration_guide, get_reference and get_country_law for ${country}; build with build_consent_document using the guide's first-visit request. Report the issues returned and every non-verified fact. Do not claim legal certainty; recommend DPO review.` },
      }],
    }),
  );

  return server;
}
