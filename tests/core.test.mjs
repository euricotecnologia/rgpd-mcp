import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildConsentDocument, ConsentValidationError, selfCheckArticles } from "../dist/consent.js";
import { getGdpr, gdprLanguages, listCountries, getCountry, searchGdpr, availableLocales } from "../dist/data.js";
import { Ledger } from "../dist/ledger.js";
import { coverage } from "../dist/coverage.js";

const ctrl = { name: "Clínica Exemplo, Lda.", email: "privacidade@exemplo.pt", dpo: { email: "dpo@exemplo.pt" } };
const care = { id: "care", label: "Prestação de cuidados de saúde", legalBasis: "contract", art9Condition: "health_care", required: true, dataCategories: ["identification", "health"] };
const news = { id: "news", label: "Comunicações informativas", legalBasis: "consent", required: false, dataCategories: ["contact"] };
const base = { country: "PT", controller: ctrl, dataCategories: ["identification", "contact", "health"], purposes: [care, news] };

test("GDPR text: 24 languages, 99 articles, 173 recitals, no encoding damage", () => {
  assert.equal(gdprLanguages().length, 24);
  for (const l of gdprLanguages()) {
    const d = getGdpr(l);
    assert.equal(Object.keys(d.articles).length, 99, l);
    assert.equal(Object.keys(d.recitals).length, 173, l);
    assert.equal(JSON.stringify(d).includes("�"), false, l);
  }
  assert.deepEqual(selfCheckArticles(), []);
});

test("GDPR text: Art. 9(2)(h) is present in English and Portuguese text", () => {
  assert.match(getGdpr("en").articles["9"].paragraphs.join(" "), /provision of health or social care/);
  assert.match(getGdpr("pt").articles["9"].paragraphs.join(" "), /presta/i);
  assert.match(getGdpr("en").articles["4"].paragraphs.find((p) => p.startsWith("(15)")), /data concerning health/);
});

test("search returns Art. 7 for 'consent' withdraw", () => {
  const r = searchGdpr("en", "withdraw consent", 5);
  assert.ok(r.some((h) => h.kind === "article" && h.number === "7"));
});

test("every country profile: verified facts carry evidence with sha256; languages have GDPR text", () => {
  const langs = new Set(gdprLanguages());
  for (const c of listCountries()) {
    assert.match(c.code, /^[A-Z]{2}$/);
    assert.equal(c.authority.status, "verified");
    assert.ok(c.authority.evidence?.sha256);
    for (const l of c.laws) if (l.status === "verified") assert.ok(l.evidence?.sha256 && l.evidence.excerpt, `${c.code} ${l.id}`);
    const a = c.digitalConsentAge;
    if (a.status === "verified") assert.ok(a.evidence?.excerpt, c.code);
    if (a.status !== "unverified" && a.value !== null) assert.ok(a.value >= 13 && a.value <= 16, c.code);
    if (c.region === "EU") for (const l of c.languages) assert.ok(langs.has(l), `${c.code} ${l}`);
  }
  assert.equal(listCountries().length, 30);
});

test("verified ages match the primary texts read during research", () => {
  const exp = { SE: 13, ES: 14, PT: 13, IT: 14, CZ: 15, AT: 14, IE: 16, NO: 13, HR: 16, FR: 15, DK: 13, FI: 13, CY: 14, BG: 14, EE: 13, SK: 16, BE: 13, SI: 15, IS: 13, LT: 14, GR: 15, LV: 13 };
  for (const [cc, v] of Object.entries(exp)) {
    const a = getCountry(cc).digitalConsentAge;
    assert.equal(a.status, "verified", cc);
    assert.equal(a.value, v, cc);
  }
  assert.equal(getCountry("NL").digitalConsentAge.status, "inferred");
  assert.equal(getCountry("MT").digitalConsentAge.status, "unverified");
  for (const cc of ["NL", "DE", "PL", "HU", "RO", "LI", "LU"]) { const a = getCountry(cc).digitalConsentAge; assert.equal(a.status, "inferred", cc); assert.equal(a.value, 16, cc); }
});

test("UI locales have identical key sets", () => {
  const dir = path.resolve("data/i18n");
  const sets = readdirSync(dir).filter((f) => !f.startsWith("_")).map((f) => [f, Object.keys(JSON.parse(readFileSync(path.join(dir, f), "utf-8"))).sort().join(",")]);
  const ref = sets.find(([f]) => f === "en.json")[1];
  for (const [f, k] of sets) assert.equal(k, ref, f);
  assert.ok(availableLocales().length >= 7);
});

test("build: PT healthcare first visit -> Portuguese, official text, one notice + one optional consent", () => {
  const d = buildConsentDocument(base);
  assert.equal(d.language, "pt");
  assert.equal(d.legalTextLanguage, "pt");
  assert.deepEqual(d.items.map((i) => [i.id, i.kind, i.required]), [["notice_ack", "notice_ack", true], ["consent:news", "consent", false]]);
  const special = d.sections.find((s) => s.id === "special");
  assert.match(special.legalRefs[0].text.join(" "), /dados relativos à saúde/);
  assert.equal(d.dataStatus.countryProfile, "verified");
  assert.match(d.documentHash, /^[0-9a-f]{64}$/);
  // deterministic hash for identical inputs
  assert.equal(buildConsentDocument(base).documentHash, d.documentHash);
});

test("build: ES->es, DE->de; PL now has its own labels (flagged unreviewed); unknown UI language falls back to English", () => {
  assert.equal(buildConsentDocument({ ...base, country: "ES" }).language, "es");
  assert.equal(buildConsentDocument({ ...base, country: "DE" }).language, "de");
  const pl = buildConsentDocument({ ...base, country: "PL" });
  assert.equal(pl.uiFallback, false);
  assert.equal(pl.language, "pl");
  assert.equal(pl.strings.btn_confirm, "Potwierdź mój wybór");
  assert.match(getGdpr("pl").articles["9"].paragraphs[0], /zdrowia/);
  assert.ok(pl.issues.some((i) => i.code === "UI_UNREVIEWED"));
  assert.ok(pl.issues.some((i) => i.code.startsWith("COUNTRY_DATA_")), "partially verified national data must be flagged");
  const ga = buildConsentDocument({ ...base, country: "IE", language: "ga" }); // Irish: official GDPR text exists, UI labels do not
  assert.equal(ga.uiFallback, true);
  assert.equal(ga.legalTextLanguage, "ga");
  assert.ok(ga.issues.some((i) => i.code === "UI_FALLBACK"));
  assert.equal(buildConsentDocument({ ...base, country: "IE" }).issues.some((i) => i.code === "UI_UNREVIEWED"), false, "reference locale is not flagged");
});

test("every country has UI labels in its default language, and EU official GDPR text (except NO/IS)", () => {
  const ui = new Set(availableLocales());
  const eu = new Set(gdprLanguages());
  for (const c of listCountries()) {
    const l = c.languages[0];
    assert.ok(ui.has(l), `${c.code}: no UI labels for ${l}`);
    if (!["NO", "IS"].includes(c.code)) assert.ok(eu.has(l), `${c.code}: no GDPR text for ${l}`);
    const d = buildConsentDocument({ ...base, country: c.code });
    assert.equal(d.uiFallback, false, c.code);
  }
});

test("rules: health data without Art. 9(2) condition is rejected", () => {
  assert.throws(() => buildConsentDocument({ ...base, purposes: [{ ...care, art9Condition: undefined }] }), (e) => e instanceof ConsentValidationError && e.issues.some((i) => i.code === "ART9_CONDITION_MISSING"));
});

test("rules: mandatory consent is rejected (Art. 7(4))", () => {
  assert.throws(() => buildConsentDocument({ ...base, purposes: [care, { ...news, required: true }] }), (e) => e.issues.some((i) => i.code === "CONSENT_NOT_OPTIONAL"));
});

test("rules: duplicate ids and unknown categories rejected", () => {
  assert.throws(() => buildConsentDocument({ ...base, purposes: [care, care] }), (e) => e.issues.some((i) => i.code === "PURPOSE_DUP"));
  assert.throws(() => buildConsentDocument({ ...base, dataCategories: ["nope"] }), (e) => e.issues.some((i) => i.code === "CATEGORY_UNKNOWN"));
});

test("minors: Art. 8 guardian required below verified national age (ES=14), not above", () => {
  const iss = { ...base, country: "ES", informationSocietyService: true, purposes: [news] , dataCategories: ["contact"] };
  assert.equal(buildConsentDocument({ ...iss, subject: { ageYears: 13 } }).guardian.required, true);
  assert.equal(buildConsentDocument({ ...iss, subject: { ageYears: 14 } }).guardian.required, false);
  // unverified country: GDPR ceiling of 16 is applied conservatively
  const fr = buildConsentDocument({ ...iss, country: "MT", subject: { ageYears: 12 } });
  assert.equal(fr.guardian.required, true);
  assert.ok(fr.issues.some((i) => i.code === "AGE_UNVERIFIED"));
});

test("ledger: record, defaults to refused, required enforced, withdraw, chain verifies and detects tampering", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rgpd-"));
  const L = new Ledger(dir);
  const d = buildConsentDocument(base);
  L.saveDocument(d);
  assert.throws(() => L.recordDecision({ documentId: d.documentId, subjectRef: "p-1", decisions: [] }), /Required item/);
  assert.throws(() => L.recordDecision({ documentId: d.documentId, subjectRef: "ana@x.pt", decisions: [{ itemId: "notice_ack", granted: true }] }), /opaque/);
  const r = L.recordDecision({ documentId: d.documentId, subjectRef: "p-1", decisions: [{ itemId: "notice_ack", granted: true }] });
  assert.equal(r.decisions.find((x) => x.itemId === "consent:news").granted, false, "unanswered optional consent must be recorded as refused");
  L.recordDecision({ documentId: d.documentId, subjectRef: "p-1", decisions: [{ itemId: "notice_ack", granted: true }, { itemId: "consent:news", granted: true }] });
  assert.equal(L.status("p-1").find((s) => s.itemId === "consent:news").granted, true);
  L.withdraw({ documentId: d.documentId, subjectRef: "p-1" });
  assert.equal(L.status("p-1").find((s) => s.itemId === "consent:news").granted, false);
  assert.deepEqual(L.verify(), { ok: true, records: 3, brokenAt: null });
  // a second Ledger instance (another process) appends on top of the same chain
  const L2 = new Ledger(dir);
  L2.recordDecision({ documentId: d.documentId, subjectRef: "p-2", decisions: [{ itemId: "notice_ack", granted: true }] });
  L.recordDecision({ documentId: d.documentId, subjectRef: "p-3", decisions: [{ itemId: "notice_ack", granted: true }] });
  assert.equal(L.verify().ok, true);
  // tamper
  const f = path.join(dir, "ledger.jsonl");
  const txt = readFileSync(f, "utf-8").replace('"granted":true', '"granted":false');
  writeFileSync(f, txt);
  assert.equal(new Ledger(dir).verify().ok, false);
});

test("ledger: guardian details enforced when guardian required and a consent is granted", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rgpd-"));
  const L = new Ledger(dir);
  const d = buildConsentDocument({ ...base, country: "ES", informationSocietyService: true, subject: { ageYears: 12 }, purposes: [news], dataCategories: ["contact"] });
  L.saveDocument(d);
  const dec = [{ itemId: "notice_ack", granted: true }, { itemId: "consent:news", granted: true }];
  assert.throws(() => L.recordDecision({ documentId: d.documentId, subjectRef: "k-1", decisions: dec }), /Guardian/);
  L.recordDecision({ documentId: d.documentId, subjectRef: "k-1", decisions: dec, guardian: { name: "Responsável", relationship: "mãe", confirmed: true } });
});

test("coverage report is consistent", () => {
  const c = coverage();
  assert.equal(c.verified + c.partial + c.unverified, c.total);
  assert.deepEqual(Object.keys(c.byCountry).length, 30);
  for (const cc of ["SE", "ES", "PT", "IT", "CZ"]) assert.equal(c.byCountry[cc], "verified", cc);
});

test("national law refs carry the verified verbatim excerpt (age rule, health provision) with source", () => {
  const d = buildConsentDocument({ ...base, country: "ES", informationSocietyService: true, subject: { ageYears: 20 }, purposes: [care, news] });
  const refs = d.sections.find((s) => s.id === "law").legalRefs.filter((r) => r.instrument === "NATIONAL");
  const age = refs.find((r) => r.title === "Art. 8 GDPR");
  assert.match(age.text[0], /mayor de catorce años/);
  assert.equal(age.verification, "verified");
  assert.match(age.source, /boe\.es/);
  const health = refs.find((r) => /Tratamientos de datos de salud/.test(r.title));
  assert.match(health.text[0], /Tratamientos de datos de salud/);
  const de = buildConsentDocument({ ...base, country: "DE" }).sections.find((s) => s.id === "law").legalRefs.find((r) => /Gesundheitsvorsorge/.test(r.title));
  assert.match(de.text[0], /Gesundheitsvorsorge/);
});

test("sector health legislation (PT, ES, FR): verbatim provisions with evidence, shown in the legal framework when health data is processed", () => {
  const want = { PT: [/Propriedade da informação de saúde/, /Consentimento ou recusa/, /Sigilo/], ES: [/derecho a la intimidad/, /Consentimiento informado/, /historia clínica/, /cinco años|conservación/i], FR: [/L1110-4/, /L1111-7/, /L1111-8/] };
  for (const [cc, pats] of Object.entries(want)) {
    const c = getCountry(cc);
    const provs = c.sectorHealth.flatMap((l) => l.provisions);
    assert.ok(provs.length >= 3, cc);
    for (const p of provs) { assert.equal(p.status, "verified"); assert.ok(p.evidence.sha256 && p.evidence.excerpt.length > 60, `${cc} ${p.article}`); }
    const d = buildConsentDocument({ ...base, country: cc });
    const refs = d.sections.find((s) => s.id === "law").legalRefs.filter((r) => r.instrument === "NATIONAL");
    for (const re of pats) assert.ok(refs.some((r) => re.test(r.citation + " " + r.title + " " + (r.text[0] ?? ""))), `${cc} ${re}`);
  }
  // no health data -> sector laws are not shown
  const nh = buildConsentDocument({ ...base, country: "ES", dataCategories: ["contact"], purposes: [news] });
  assert.equal(nh.sections.find((s) => s.id === "law").legalRefs.some((r) => /Ley 41\/2002/.test(r.citation)), false);
});
