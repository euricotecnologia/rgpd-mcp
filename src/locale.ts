import { BlockList, isIP } from "node:net";
import { existsSync } from "node:fs";
import { countryCodes, getCountry } from "./data.js";

/**
 * OPTIONAL country/language detection. The legal rule that applies does not follow the IP address
 * (GDPR Art. 3: establishment of the controller / whom the service targets), so the result is a
 * SUGGESTION with its source. Fully automatic (nobody is asked to pick a country). Priority: clinic establishment > IP > Accept-Language > fallbackCountry.
 * The IP is never stored or logged by this module.
 */
export type GeoLookup = (ip: string) => string | null;
export interface GeoResolver {
  lookup: GeoLookup;
  /** "mmdb" for a MaxMind-format database; custom resolvers may use any label. */
  kind: string;
}

export interface LocaleInput {
  /** Visitor IP as seen by YOUR trusted backend (behind a proxy: the validated client address, never a raw X-Forwarded-For). */
  ip?: string;
  acceptLanguage?: string;
  /** Country where the controller (clinic) is established. When set and covered, it wins: in-person care follows it. */
  establishmentCountry?: string;
  /** Used when nothing else determines a covered country (e.g. a visitor from outside the covered countries). Typically the clinic's country. */
  fallbackCountry?: string;
}

export type Source = "establishment" | "ip" | "accept-language" | "fallback" | "country-default" | "none";

export interface LocaleResult {
  country: string | null;
  language: string | null;
  countrySource: Source;
  languageSource: Source;
  /** ISO code detected from the IP (even when not covered), null when unavailable. */
  ipCountry: string | null;
  /** True when the country is one of the profiles shipped in this project. */
  supported: boolean;
  /** No covered country could be determined and no usable fallbackCountry was given: configure establishmentCountry or fallbackCountry. */
  undetermined: boolean;
  /** Official languages of the chosen country. */
  languageOptions: string[];
  warnings: string[];
}

const nonPublic = new BlockList();
for (const [a, p] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16], ["224.0.0.0", 4]] as const) nonPublic.addSubnet(a, p, "ipv4");
for (const [a, p] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) nonPublic.addSubnet(a, p, "ipv6");

/** Normalises an address; returns null when it is not a public, routable IP. */
export function publicIp(raw: string | undefined): string | null {
  if (!raw) return null;
  let ip = raw.trim();
  if (ip.startsWith("[") && ip.includes("]")) ip = ip.slice(1, ip.indexOf("]"));
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) ip = mapped[1]!;
  const v = isIP(ip);
  if (!v) return null;
  return nonPublic.check(ip, v === 4 ? "ipv4" : "ipv6") ? null : ip;
}

/** Parses an Accept-Language header into tags ordered by preference (q). */
export function parseAcceptLanguage(h: string | undefined): { tag: string; lang: string; region?: string }[] {
  if (!h) return [];
  return h
    .split(",")
    .map((part, i) => {
      const [tagRaw, ...params] = part.trim().split(";");
      const q = params.map((p) => /^\s*q\s*=\s*([\d.]+)\s*$/.exec(p)).find(Boolean);
      return { tag: (tagRaw ?? "").trim(), q: q ? Number(q[1]) : 1, i };
    })
    .filter((x) => /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(x.tag) && x.q > 0 && Number.isFinite(x.q))
    .sort((a, b) => b.q - a.q || a.i - b.i)
    .map(({ tag }) => {
      const parts = tag.split("-");
      const region = parts.slice(1).find((s) => /^[A-Za-z]{2}$/.test(s));
      return { tag, lang: parts[0]!.toLowerCase(), ...(region ? { region: region.toUpperCase() } : {}) };
    });
}

export function resolveLocale(input: LocaleInput, geo?: GeoResolver): LocaleResult {
  const covered = new Set(countryCodes());
  const warnings: string[] = [];
  const up = (s?: string) => (s && /^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : undefined);
  const accept = parseAcceptLanguage(input.acceptLanguage);

  // ---- IP -> country (optional) ----
  let ipCountry: string | null = null;
  if (input.ip) {
    const ip = publicIp(input.ip);
    if (!ip) warnings.push("The IP is not a public address (private, loopback or invalid): no geolocation.");
    else if (!geo) warnings.push("Geolocation by IP is not enabled on this server (no GeoIP database configured).");
    else {
      try { ipCountry = up(geo.lookup(ip) ?? undefined) ?? null; } catch { warnings.push("GeoIP lookup failed."); }
      if (!ipCountry && ip) warnings.push("The IP was not found in the GeoIP database.");
    }
  }
  const acceptRegion = accept.find((a) => a.region)?.region;

  // ---- country by priority (fully automatic) ----
  let country: string | null = null;
  let countrySource: Source = "none";
  const est = up(input.establishmentCountry);
  const fb = up(input.fallbackCountry);
  if (input.establishmentCountry && !est) warnings.push("establishmentCountry is not a valid ISO 3166-1 alpha-2 code.");
  if (input.fallbackCountry && !fb) warnings.push("fallbackCountry is not a valid ISO 3166-1 alpha-2 code.");
  if (est && covered.has(est)) { country = est; countrySource = "establishment"; }
  else {
    if (est) warnings.push(`The clinic's country (${est}) has no profile in this project.`);
    if (ipCountry && covered.has(ipCountry)) { country = ipCountry; countrySource = "ip"; }
    else {
      if (ipCountry) warnings.push(`The IP points to ${ipCountry}, which has no profile in this project.`);
      if (acceptRegion && covered.has(acceptRegion)) { country = acceptRegion; countrySource = "accept-language"; }
      else if (fb && covered.has(fb)) { country = fb; countrySource = "fallback"; warnings.push(`No covered country was detected: the fallback country (${fb}) was used.`); }
      else if (fb) warnings.push(`The fallback country (${fb}) has no profile in this project.`);
    }
  }
  if (countrySource === "establishment" && ipCountry && ipCountry !== country) warnings.push(`The IP points to ${ipCountry} but the clinic is established in ${country}: the clinic's country was used.`);
  if (countrySource === "ip") warnings.push("Country inferred from the IP: this is an estimate (VPNs, proxies and mobile networks mislead it).");

  if (!country) return { country: null, language: null, countrySource: "none", languageSource: "none", ipCountry, supported: false, undetermined: true, languageOptions: [], warnings };

  // ---- language: Accept-Language when it is an official language of the country, else the country's primary language ----
  const options = getCountry(country).languages;
  let language: string | null = null;
  let languageSource: Source = "none";
  const hit = accept.find((a) => options.includes(a.lang));
  if (hit) { language = hit.lang; languageSource = "accept-language"; }
  else { language = options[0] ?? null; languageSource = "country-default"; }
  if (options.length > 1 && languageSource === "country-default") warnings.push(`${country} has several official languages (${options.join(", ")}): the primary one (${language}) was used because the browser language is not one of them.`);
  return { country, language, countrySource, languageSource, ipCountry, supported: true, undetermined: false, languageOptions: options, warnings };
}

/**
 * Opens a MaxMind-format database (.mmdb: GeoLite2/GeoIP2 Country or City, DB-IP) with the optional
 * `maxmind` package. Lookups are local: the IP never leaves the machine.
 */
export async function openGeoDatabase(file: string): Promise<GeoResolver> {
  if (!existsSync(file)) throw new Error(`GeoIP database not found: ${file}`);
  let mm: typeof import("maxmind");
  try { mm = await import("maxmind"); } catch { throw new Error("The optional package 'maxmind' is not installed. Run: npm install maxmind"); }
  const reader = await mm.open<import("maxmind").CountryResponse>(file);
  return { kind: "mmdb", lookup: (ip) => reader.get(ip)?.country?.iso_code ?? null };
}
