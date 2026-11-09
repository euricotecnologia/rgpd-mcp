import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveLocale, publicIp, parseAcceptLanguage, openGeoDatabase } from "../dist/locale.js";
import { startHttp } from "../dist/http.js";
import { buildConsentDocument } from "../dist/consent.js";

// stub resolver: no database needed
const geo = { kind: "stub", lookup: (ip) => ({ "203.0.113.7": "ES", "198.51.100.9": "FR", "192.0.2.50": "BR", "203.0.113.99": "BE" })[ip] ?? null };
const base = { controller: { name: "Clínica", email: "p@x.pt" }, dataCategories: ["identification"], purposes: [{ id: "care", label: "x", legalBasis: "contract", required: true, dataCategories: ["identification"] }] };

test("publicIp rejects private, loopback and invalid addresses; unwraps IPv4-mapped", () => {
  for (const bad of ["10.1.2.3", "127.0.0.1", "192.168.0.5", "172.20.1.1", "169.254.1.1", "::1", "fe80::1", "fd00::1", "abc", "", undefined, "999.1.1.1"]) assert.equal(publicIp(bad), null, String(bad));
  assert.equal(publicIp("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(publicIp("[2001:db8::1]"), "2001:db8::1");
  assert.equal(publicIp("203.0.113.7"), "203.0.113.7");
});

test("Accept-Language is parsed by quality and region", () => {
  const r = parseAcceptLanguage("fr-CH, fr;q=0.9, en;q=0.8, de;q=0, xx!!;q=1");
  assert.deepEqual(r.map((x) => x.tag), ["fr-CH", "fr", "en"]);
  assert.equal(r[0].region, "CH");
  assert.deepEqual(parseAcceptLanguage(undefined), []);
});

test("country from IP picks the national language and the right law profile", () => {
  const r = resolveLocale({ ip: "203.0.113.7" }, geo);
  assert.equal(r.country, "ES");
  assert.equal(r.language, "es");
  assert.equal(r.countrySource, "ip");
  assert.equal(r.languageSource, "country-default");
  assert.ok(r.warnings.some((w) => /estimate/.test(w)));
  const doc = buildConsentDocument({ ...base, country: r.country, language: r.language });
  assert.equal(doc.country, "ES");
  assert.equal(doc.language, "es");
});

test("priority: clinic establishment > IP > Accept-Language > fallbackCountry", () => {
  assert.equal(resolveLocale({ ip: "203.0.113.7", establishmentCountry: "PT" }, geo).countrySource, "establishment");
  assert.equal(resolveLocale({ ip: "203.0.113.7", establishmentCountry: "PT" }, geo).country, "PT");
  assert.ok(resolveLocale({ ip: "203.0.113.7", establishmentCountry: "PT" }, geo).warnings.some((w) => /clinic's country was used/.test(w)));
  const f = resolveLocale({ ip: "192.0.2.50", fallbackCountry: "PT" }, geo); // visitor from a country without a profile
  assert.deepEqual([f.country, f.countrySource, f.language, f.undetermined], ["PT", "fallback", "pt", false]);
  assert.ok(f.warnings.some((w) => /fallback country/.test(w)));
  const a = resolveLocale({ acceptLanguage: "pt-PT,pt;q=0.9" });
  assert.deepEqual([a.country, a.countrySource, a.language], ["PT", "accept-language", "pt"]);
});

test("country without a profile never guesses another law: fallback is explicit, otherwise undetermined", () => {
  const br = resolveLocale({ ip: "192.0.2.50", acceptLanguage: "pt-BR" }, geo);
  assert.equal(br.country, null);
  assert.equal(br.undetermined, true);
  assert.equal(br.ipCountry, "BR");
  assert.ok(br.warnings.some((w) => /no profile/.test(w)));
  assert.equal(resolveLocale({ establishmentCountry: "GB" }).country, null);
  assert.equal(resolveLocale({}).undetermined, true);
  assert.equal(resolveLocale({ fallbackCountry: "GB" }).country, null);
});

test("private IP or no database: warns and uses the other signals", () => {
  const p = resolveLocale({ ip: "192.168.1.10", acceptLanguage: "de-AT" }, geo);
  assert.equal(p.country, "AT");
  assert.ok(p.warnings.some((w) => /not a public address/.test(w)));
  const n = resolveLocale({ ip: "203.0.113.7" });
  assert.equal(n.country, null);
  assert.ok(n.warnings.some((w) => /not enabled/.test(w)));
});

test("multilingual country: Accept-Language picks the language, otherwise the primary one with a warning", () => {
  const nl = resolveLocale({ ip: "203.0.113.99", acceptLanguage: "fr-BE,fr;q=0.9" }, geo);
  assert.deepEqual([nl.country, nl.language, nl.languageSource], ["BE", "fr", "accept-language"]);
  assert.ok(nl.languageOptions.length > 1);
  const d = resolveLocale({ ip: "203.0.113.99" }, geo);
  assert.equal(d.languageSource, "country-default");
  assert.ok(d.warnings.some((w) => /several official languages/.test(w)));
  const ja = resolveLocale({ ip: "203.0.113.99", acceptLanguage: "ja" }, geo); // browser language is not official there: primary language
  assert.deepEqual([ja.language, ja.languageSource], ["nl", "country-default"]);
});

test("HTTP /v1/resolve-locale: needs the API key, works with and without GeoIP, does not echo the IP", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rgpd-loc-"));
  for (const withGeo of [true, false]) {
    const h = await startHttp({ port: 0, apiKey: "k", stateDir: dir, geoip: withGeo ? geo : undefined });
    try {
      const url = h.url + "/v1/resolve-locale";
      const payload = JSON.stringify({ ip: "203.0.113.7", acceptLanguage: "es-ES" });
      assert.equal((await fetch(url, { method: "POST", body: payload })).status, 401);
      const r = await fetch(url, { method: "POST", headers: { Authorization: "Bearer k", "Content-Type": "application/json" }, body: payload });
      assert.equal(r.status, 200);
      const text = await r.text();
      assert.ok(!text.includes("203.0.113.7"), "the IP must not be echoed back");
      const j = JSON.parse(text);
      assert.equal(j.country, "ES"); // from IP when enabled, from Accept-Language otherwise
      assert.equal(j.countrySource, withGeo ? "ip" : "accept-language");
      assert.equal(j.geoip, withGeo ? "stub" : null);
      assert.equal((await (await fetch(h.url + "/health")).json()).geoip, withGeo);
      const bad = await fetch(url, { method: "POST", headers: { Authorization: "Bearer k" }, body: JSON.stringify({ establishmentCountry: "PRT" }) });
      assert.equal(bad.status, 400);
    } finally { h.server.close(); }
  }
});

// Real MaxMind-format database: set RGPD_TEST_MMDB to a Country/City .mmdb (e.g. MaxMind's GeoIP2-Country-Test.mmdb)
const MMDB = process.env.RGPD_TEST_MMDB;
test("real .mmdb database lookup", { skip: !MMDB || !existsSync(MMDB) ? "RGPD_TEST_MMDB not set" : false }, async () => {
  const g = await openGeoDatabase(MMDB);
  assert.equal(g.lookup("89.160.20.112"), "SE");
  assert.equal(g.lookup("1.1.1.1"), null);
  const r = resolveLocale({ ip: "89.160.20.112" }, g);
  assert.deepEqual([r.country, r.language], ["SE", "sv"]);
  await assert.rejects(() => openGeoDatabase("does-not-exist.mmdb"), /not found/);
});

test("automatic: POST /v1/consent-documents with autoLocale builds the document in the detected country and language, no selector involved", async () => {
  const h = await startHttp({ port: 0, apiKey: "k", stateDir: mkdtempSync(path.join(tmpdir(), "rgpd-auto-")), geoip: geo });
  const post = (b) => fetch(h.url + "/v1/consent-documents", { method: "POST", headers: { Authorization: "Bearer k", "Content-Type": "application/json" }, body: JSON.stringify({ ...base, ...b }) });
  try {
    const ok = await post({ autoLocale: { ip: "203.0.113.7", acceptLanguage: "es-ES", fallbackCountry: "PT" } });
    assert.equal(ok.status, 201);
    const txt = await ok.text();
    assert.ok(!txt.includes("203.0.113.7"), "the IP must not appear in the document or response");
    const d = JSON.parse(txt);
    assert.deepEqual([d.country, d.language, d.locale.countrySource], ["ES", "es", "ip"]);
    // visitor from a country without a profile: the clinic's fallback law applies, reported in locale.warnings
    const fb = await (await post({ autoLocale: { ip: "192.0.2.50", fallbackCountry: "PT" } })).json();
    assert.deepEqual([fb.country, fb.language, fb.locale.countrySource], ["PT", "pt", "fallback"]);
    // an explicit language still wins over the detected one
    const ex = await (await post({ language: "en", autoLocale: { ip: "203.0.113.7" } })).json();
    assert.deepEqual([ex.country, ex.language], ["ES", "en"]);
    // nothing detected and no fallback: refuse instead of guessing a law
    const none = await post({ autoLocale: { ip: "192.0.2.50" } });
    assert.equal(none.status, 422);
    assert.equal((await none.json()).locale.undetermined, true);
    // the stored document carries no IP
    const got = await (await fetch(h.url + "/v1/consent-documents/" + d.documentId)).text();
    assert.ok(!got.includes("203.0.113.7"));
  } finally { h.server.close(); }
});

test("no country/language selector exists: widget, modal page and API expose none", async () => {
  const h = await startHttp({ port: 0, apiKey: "k", stateDir: mkdtempSync(path.join(tmpdir(), "rgpd-nopick-")) });
  try {
    const w = await (await fetch(h.url + "/widget/rgpd-consent.js")).text();
    const mp = await (await fetch(h.url + "/widget/modal-page.js")).text();
    assert.ok(!/locale-picker|localechange|<select|"select"/i.test(w + mp));
    assert.equal((await fetch(h.url + "/v1/locale-options")).status, 401); // route removed (falls under the API key wall)
  } finally { h.server.close(); }
});
