import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = process.env.RGPD_MCP_DATA ? path.resolve(process.env.RGPD_MCP_DATA) : path.join(ROOT, "data");

/** Verification state of a single fact. Nothing is ever presented as law unless `verified`. */
export type FactStatus =
  | "verified" // value read from the official/primary text; evidence excerpt stored
  | "inferred" // follows from absence of a national derogation; evidence = the law text lacks it. Needs legal review
  | "unverified"; // not yet confirmed against a primary source: MUST NOT be shown as authoritative

export interface Evidence {
  url: string;
  retrievedAt: string; // ISO date
  sha256: string; // hash of the downloaded source file
  excerpt: string; // verbatim excerpt supporting the fact
  language: string;
}

export interface LawRef {
  id: string;
  role: "implementation" | "health-sector" | "main" | "other";
  title: string; // official title, in the official language
  language: string;
  number?: string;
  date?: string;
  journal?: string;
  url: string;
  status: FactStatus;
  evidence?: Evidence;
}

export interface CountryProfile {
  code: string; // ISO 3166-1 alpha-2
  name: Record<string, string>; // localized names (at least en + official language)
  region: "EU" | "EEA" | "UK" | "CH" | "OTHER";
  languages: string[]; // official languages, ISO 639-1; first = primary for UI/legal text
  authority: { name: string; url: string; language: string; status: FactStatus };
  laws: LawRef[];
  digitalConsentAge: {
    value: number | null;
    status: FactStatus;
    article: string; // where the value comes from, e.g. "art. 16.º n.º 1 Lei 58/2019"
    lawId: string | null;
    evidence?: Evidence;
    note?: string;
  };
  health?: { provisions: { article: string; lawId: string; topic: string; status: FactStatus; headingOnly?: boolean; evidence?: Evidence }[] };
  /** Sector health legislation (patient rights, clinical records, professional secrecy, health-data hosting). Each provision carries verbatim evidence. */
  sectorHealth?: {
    id: string;
    title: string;
    number?: string;
    language: string;
    url: string;
    status: FactStatus;
    note?: string;
    provisions: { article: string; topic: string; status: FactStatus; evidence?: Evidence }[];
  }[];
  notes?: string[];
  lastReviewed: string;
}

export interface GdprDoc {
  celex: string;
  eli: string;
  language: string;
  chapters: Record<string, string>;
  articles: Record<string, { title: string; paragraphs: string[] }>;
  recitals: Record<string, string>;
}

const cache = new Map<string, unknown>();
function readJson<T>(file: string): T {
  const hit = cache.get(file);
  if (hit) return hit as T;
  const v = JSON.parse(readFileSync(file, "utf-8")) as T;
  cache.set(file, v);
  return v;
}

export function gdprLanguages(): string[] {
  const dir = path.join(DATA_DIR, "gdpr");
  return readdirSync(dir)
    .filter((f) => /^[a-z]{2}\.json$/.test(f))
    .map((f) => f.slice(0, 2))
    .sort();
}

export function getGdpr(lang: string): GdprDoc {
  const l = lang.toLowerCase().slice(0, 2);
  const f = path.join(DATA_DIR, "gdpr", `${l}.json`);
  if (!existsSync(f)) throw new Error(`GDPR text not available for language "${lang}". Available: ${gdprLanguages().join(", ")}`);
  return readJson<GdprDoc>(f);
}

export function countryCodes(): string[] {
  const dir = path.join(DATA_DIR, "countries");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^[A-Z]{2}\.json$/.test(f))
    .map((f) => f.slice(0, 2))
    .sort();
}

export function getCountry(code: string): CountryProfile {
  const c = code.toUpperCase();
  const f = path.join(DATA_DIR, "countries", `${c}.json`);
  if (!existsSync(f)) throw new Error(`Country "${code}" not available. Available: ${countryCodes().join(", ")}`);
  return readJson<CountryProfile>(f);
}

export function listCountries(): CountryProfile[] {
  return countryCodes().map(getCountry);
}

export type Locale = Record<string, string> & { _meta?: never };
/** `reviewed`: true only for the reference locale or one signed off in data/i18n/_review.json. */
export function getLocale(lang: string): { strings: Record<string, string>; resolved: string; fallback: boolean; reviewed: boolean } {
  const l = lang.toLowerCase().slice(0, 2);
  const rv = readJson<{ reviewed: Record<string, unknown>; reference: string[] }>(path.join(DATA_DIR, "i18n", "_review.json"));
  const f = path.join(DATA_DIR, "i18n", `${l}.json`);
  if (existsSync(f)) return { strings: readJson<Record<string, string>>(f), resolved: l, fallback: false, reviewed: rv.reference.includes(l) || l in rv.reviewed };
  return { strings: readJson<Record<string, string>>(path.join(DATA_DIR, "i18n", "en.json")), resolved: "en", fallback: true, reviewed: true };
}

export function availableLocales(): string[] {
  return readdirSync(path.join(DATA_DIR, "i18n"))
    .filter((f) => /^[a-z]{2}\.json$/.test(f))
    .map((f) => f.slice(0, 2));
}

/** Format an article as plain text (title + paragraphs) in the given language. */
export function articleText(lang: string, n: number | string): { number: string; title: string; paragraphs: string[]; language: string } {
  const doc = getGdpr(lang);
  const a = doc.articles[String(n)];
  if (!a) throw new Error(`Article ${n} not found`);
  return { number: String(n), title: a.title, paragraphs: a.paragraphs, language: doc.language };
}

export function searchGdpr(lang: string, query: string, limit = 10) {
  const doc = getGdpr(lang);
  const terms = query
    .toLocaleLowerCase(doc.language)
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (!terms.length) return [];
  const hits: { kind: "article" | "recital"; number: string; title?: string; score: number; snippet: string }[] = [];
  const score = (text: string) => {
    const low = text.toLocaleLowerCase(doc.language);
    let s = 0;
    for (const t of terms) {
      let i = -1;
      while ((i = low.indexOf(t, i + 1)) !== -1) s++;
    }
    return s;
  };
  const snippet = (text: string) => {
    const low = text.toLocaleLowerCase(doc.language);
    const idx = Math.max(0, low.indexOf(terms[0]!));
    return text.slice(Math.max(0, idx - 80), idx + 220).trim();
  };
  for (const [n, a] of Object.entries(doc.articles)) {
    const body = a.title + " " + a.paragraphs.join(" ");
    const s = score(body) + score(a.title) * 3;
    if (s) hits.push({ kind: "article", number: n, title: a.title, score: s, snippet: snippet(body) });
  }
  for (const [n, t] of Object.entries(doc.recitals)) {
    const s = score(t);
    if (s) hits.push({ kind: "recital", number: n, score: s, snippet: snippet(t) });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
