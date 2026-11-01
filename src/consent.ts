import { createHash, randomUUID } from "node:crypto";
import { countryState } from "./coverage.js";
import { articleText, getCountry, getGdpr, getLocale, gdprLanguages, type CountryProfile } from "./data.js";

/* ------------------------------------------------------------------ catalogs */

/** Data categories. `special` = Art. 9(1)/Art. 10 GDPR (listed in the official Art. 9(1) text). */
export const DATA_CATEGORIES = {
  identification: { special: false },
  contact: { special: false },
  demographic: { special: false },
  financial: { special: false },
  location: { special: false },
  online_identifiers: { special: false },
  images: { special: false },
  health: { special: true, art4: "4(15)" },
  genetic: { special: true, art4: "4(13)" },
  biometric: { special: true, art4: "4(14)" },
  racial_ethnic: { special: true },
  political: { special: true },
  religious: { special: true },
  trade_union: { special: true },
  sex_life: { special: true },
  criminal: { special: false, art: 10 }, // Art. 10: own regime, not Art. 9
} as const;
export type DataCategory = keyof typeof DATA_CATEGORIES;

/** Article 6(1) points. */
export const ART6 = {
  consent: "a",
  contract: "b",
  legal_obligation: "c",
  vital_interests: "d",
  public_task: "e",
  legitimate_interests: "f",
} as const;
export type Art6Basis = keyof typeof ART6;

/** Article 9(2) points. */
export const ART9 = {
  explicit_consent: "a",
  employment_social_security: "b",
  vital_interests: "c",
  nonprofit_body: "d",
  made_public_by_subject: "e",
  legal_claims: "f",
  substantial_public_interest: "g",
  health_care: "h",
  public_health: "i",
  research_archiving_statistics: "j",
} as const;
export type Art9Condition = keyof typeof ART9;

/* --------------------------------------------------------------------- types */

export interface PurposeInput {
  id: string;
  /** Wording the controller shows to the data subject, in the document language (controller's own words). */
  label: string;
  legalBasis: Art6Basis;
  art9Condition?: Art9Condition;
  /** true = processing happens regardless of the data subject's choice (information only, no consent). */
  required: boolean;
  dataCategories?: DataCategory[];
  recipients?: string[];
  retention?: string;
  transferOutsideEea?: { description: string; safeguard: string };
}

export interface BuildInput {
  country: string;
  /** UI + legal-text language (ISO 639-1). Default: primary official language of the country. */
  language?: string;
  controller: { name: string; address?: string; email?: string; taxId?: string; dpo?: { name?: string; email: string } };
  dataCategories: DataCategory[];
  purposes: PurposeInput[];
  subject?: { ageYears?: number };
  /** Art. 8 applies only to information society services offered directly to a child. */
  informationSocietyService?: boolean;
  documentVersion?: string;
}

export interface LegalRef {
  instrument: "GDPR" | "NATIONAL";
  citation: string;
  title: string;
  text: string[];
  language: string;
  source?: string;
  verification?: "verified" | "inferred" | "unverified";
}

export interface Section {
  id: string;
  heading: string;
  paragraphs: string[];
  legalRefs: LegalRef[];
}

export type ItemKind = "notice_ack" | "consent" | "explicit_consent";
export interface Item {
  id: string;
  kind: ItemKind;
  required: boolean;
  label: string;
  purposeId?: string;
  legalRefs: string[]; // citations
}

export interface Issue {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
  refs?: string[];
}

export interface ConsentDocument {
  documentId: string;
  documentHash: string;
  schema: "rgpd-mcp/consent-document@1";
  version: string;
  createdAt: string;
  country: string;
  language: string; // UI + legal text language actually used
  uiFallback: boolean;
  legalTextLanguage: string;
  controller: BuildInput["controller"];
  title: string;
  intro: string;
  sections: Section[];
  items: Item[];
  guardian: { required: boolean; reason?: string };
  strings: Record<string, string>;
  issues: Issue[];
  dataStatus: { countryProfile: "verified" | "partial" | "unverified" };
}

export class ConsentValidationError extends Error {
  constructor(public issues: Issue[]) {
    super("Consent document invalid:\n" + issues.map((i) => `- [${i.code}] ${i.message}`).join("\n"));
  }
}

/* ------------------------------------------------------------------- helpers */

const ELI = "https://eur-lex.europa.eu/eli/reg/2016/679/oj";

function stable(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.keys(v as object)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + stable((v as Record<string, unknown>)[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(v);
}

function fill(s: string, vars: Record<string, string>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function gdprRef(lang: string, n: number, short: string, art: string, focus = ""): LegalRef {
  const a = articleText(lang, n);
  return {
    instrument: "GDPR",
    citation: `${short} · ${art} ${n}${focus}`,
    title: a.title,
    text: a.paragraphs,
    language: a.language,
    source: ELI,
    verification: "verified",
  };
}

const profileStatus = (p: CountryProfile) => countryState(p);

/* --------------------------------------------------------------------- build */

export function buildConsentDocument(input: BuildInput): ConsentDocument {
  const profile = getCountry(input.country);
  const issues: Issue[] = [];

  // ---- language resolution -------------------------------------------------
  const wanted = (input.language ?? profile.languages[0]!).toLowerCase().slice(0, 2);
  const euLangs = gdprLanguages();
  let legalLang = wanted;
  if (!euLangs.includes(wanted)) {
    legalLang = "en";
    issues.push({
      level: "warning",
      code: "LEGAL_TEXT_FALLBACK",
      message: `Official GDPR text is not stored for language "${wanted}"; English official text is used.`,
    });
  }
  const loc = getLocale(wanted);
  const S = loc.strings;
  const en = getLocale("en").strings;
  const uiFallback = loc.fallback;
  if (uiFallback)
    issues.push({ level: "info", code: "UI_FALLBACK", message: en["msg_ui_fallback"]! });
  if (!loc.reviewed)
    issues.push({ level: "info", code: "UI_UNREVIEWED", message: `UI labels in "${loc.resolved}" are machine-drafted and not yet reviewed by a native speaker with legal training; review before production. Legal texts are unaffected (official GDPR text).` });
  const short = S["gdpr_short"]!;
  const art = S["lbl_article"]!;
  const countryName = profile.name[wanted] ?? profile.name["en"] ?? profile.code;

  // ---- structural validation ------------------------------------------------
  const ids = new Set<string>();
  for (const p of input.purposes) {
    if (!/^[a-z0-9_-]{1,64}$/i.test(p.id))
      issues.push({ level: "error", code: "PURPOSE_ID", message: `Purpose id "${p.id}" must match [A-Za-z0-9_-]{1,64}.` });
    if (ids.has(p.id)) issues.push({ level: "error", code: "PURPOSE_DUP", message: `Duplicate purpose id "${p.id}".` });
    ids.add(p.id);
    if (!p.label?.trim()) issues.push({ level: "error", code: "PURPOSE_LABEL", message: `Purpose "${p.id}" has no label.` });
  }
  if (!input.purposes.length) issues.push({ level: "error", code: "NO_PURPOSE", message: "At least one purpose is required (Art. 5(1)(b): purpose limitation)." });
  for (const c of input.dataCategories)
    if (!(c in DATA_CATEGORIES)) issues.push({ level: "error", code: "CATEGORY_UNKNOWN", message: `Unknown data category "${c}".` });

  const allCats = new Set<DataCategory>(input.dataCategories);
  for (const p of input.purposes) for (const c of p.dataCategories ?? []) allCats.add(c);
  const specialCats = [...allCats].filter((c) => DATA_CATEGORIES[c]?.special);
  const hasHealth = allCats.has("health") || allCats.has("genetic");

  // ---- GDPR rule checks (rule -> article) -----------------------------------
  const consentItemsPurposes: PurposeInput[] = [];
  for (const p of input.purposes) {
    const cats = new Set<DataCategory>([...(p.dataCategories ?? input.dataCategories)]);
    const purposeSpecial = [...cats].some((c) => DATA_CATEGORIES[c]?.special);
    if (purposeSpecial && !p.art9Condition)
      issues.push({
        level: "error",
        code: "ART9_CONDITION_MISSING",
        message: `Purpose "${p.id}" processes special categories (${[...cats].filter((c) => DATA_CATEGORIES[c]?.special).join(", ")}) but declares no Art. 9(2) condition. Art. 9(1) prohibits it unless a condition of Art. 9(2) applies.`,
        refs: ["Art. 9(1)", "Art. 9(2)"],
      });
    if (p.art9Condition === "health_care" && ![...cats].some((c) => c === "health" || c === "genetic"))
      issues.push({ level: "warning", code: "ART9H_NO_HEALTH", message: `Purpose "${p.id}" uses Art. 9(2)(h) but declares no health/genetic data category.`, refs: ["Art. 9(2)(h)"] });
    const isConsent = p.legalBasis === "consent" || p.art9Condition === "explicit_consent";
    if (isConsent) {
      if (p.required)
        issues.push({
          level: "error",
          code: "CONSENT_NOT_OPTIONAL",
          message: `Purpose "${p.id}" relies on consent but is marked required. Consent must be freely given; making it a condition for the service when not necessary is not permitted (Art. 7(4), recital 43). If the processing is necessary for the service, use another legal basis (e.g. contract, Art. 6(1)(b)) and, for special categories, an Art. 9(2) condition.`,
          refs: ["Art. 7(4)", "Recital 43"],
        });
      consentItemsPurposes.push(p);
    } else if (!p.required) {
      issues.push({
        level: "warning",
        code: "OPTIONAL_NO_CONSENT",
        message: `Purpose "${p.id}" is optional for the data subject but not based on consent; the document will present it as information only. Confirm that the chosen basis (${p.legalBasis}) is appropriate.`,
        refs: ["Art. 6(1)"],
      });
    }
    if (p.legalBasis === "legitimate_interests" && purposeSpecial && p.art9Condition === undefined)
      issues.push({ level: "error", code: "LI_SPECIAL", message: `Purpose "${p.id}": legitimate interests (Art. 6(1)(f)) alone cannot cover special categories.`, refs: ["Art. 9"] });
  }
  if (specialCats.length === 0 && input.purposes.some((p) => p.art9Condition))
    issues.push({ level: "warning", code: "ART9_UNUSED", message: "An Art. 9(2) condition is declared but no special-category data is listed." });

  // ---- country profile checks --------------------------------------------------
  const pStatus = profileStatus(profile);
  if (pStatus !== "verified")
    issues.push({ level: "warning", code: "COUNTRY_DATA_" + pStatus.toUpperCase(), message: en["msg_unverified"]! });
  const dca = profile.digitalConsentAge;
  let guardian: ConsentDocument["guardian"] = { required: false };
  if (input.informationSocietyService) {
    if (dca.status === "unverified" || dca.value === null) {
      issues.push({ level: "warning", code: "AGE_UNVERIFIED", message: `Digital age of consent for ${profile.code} is not verified; the Art. 8(1) default of 16 is the GDPR ceiling. Confirm with national law before relying on a lower age.`, refs: ["Art. 8(1)"] });
      if (input.subject?.ageYears !== undefined && input.subject.ageYears < 16) guardian = { required: true, reason: "age<16 (GDPR default; national value unverified)" };
    } else if (input.subject?.ageYears === undefined) {
      issues.push({ level: "warning", code: "AGE_UNKNOWN", message: `Subject age not provided; Art. 8 threshold in ${profile.code} is ${dca.value}. Collect the age first, or always request guardian details for consent-based purposes.`, refs: ["Art. 8"] });
    } else if (input.subject.ageYears < dca.value) {
      guardian = { required: true, reason: `age<${dca.value} (${profile.code}, ${dca.article})` };
    }
  } else if (input.subject?.ageYears !== undefined && input.subject.ageYears < 18) {
    issues.push({ level: "warning", code: "MINOR_NON_ISS", message: "Subject is a minor and the service is not an information society service: Art. 8 does not apply. Capacity and legal representation follow national health/civil law, which this document does not decide. Obtain representative consent according to local rules.", refs: ["Art. 8"] });
  }
  if (hasHealth && !profile.health?.provisions?.length)
    issues.push({ level: "warning", code: "HEALTH_NATIONAL_MISSING", message: `No verified national health-data provisions are stored for ${profile.code}. Art. 9(4) lets Member States add conditions for health/genetic/biometric data: check national law with the DPO.`, refs: ["Art. 9(4)"] });

  const errors = issues.filter((i) => i.level === "error");
  if (errors.length) throw new ConsentValidationError(issues);

  // ---- sections ------------------------------------------------------------------
  const vars = { controller: input.controller.name, country: countryName };
  const sections: Section[] = [];
  const g = (n: number, focus = "") => gdprRef(legalLang, n, short, art, focus);

  const ctrl: string[] = [input.controller.name];
  if (input.controller.address) ctrl.push(input.controller.address);
  if (input.controller.email) ctrl.push(input.controller.email);
  if (input.controller.taxId) ctrl.push(input.controller.taxId);
  sections.push({ id: "controller", heading: S["sec_controller"]!, paragraphs: ctrl, legalRefs: [g(13, "(1)(a)")] });
  if (input.controller.dpo)
    sections.push({ id: "dpo", heading: S["sec_dpo"]!, paragraphs: [[input.controller.dpo.name, input.controller.dpo.email].filter(Boolean).join(" · ")], legalRefs: [g(13, "(1)(b)")] });

  sections.push({
    id: "purposes",
    heading: S["sec_purposes"]!,
    paragraphs: input.purposes.map((p) => {
      const a6 = `${short} · ${art} 6(1)(${ART6[p.legalBasis]})`;
      const a9 = p.art9Condition ? ` + ${short} · ${art} 9(2)(${ART9[p.art9Condition]})` : "";
      return `${p.label} — ${S["lbl_basis"]}: ${a6}${a9} — ${p.required ? S["lbl_required"] : S["lbl_optional"]}`;
    }),
    legalRefs: [g(6), g(13, "(1)(c)")],
  });

  sections.push({
    id: "categories",
    heading: S["sec_categories"]!,
    paragraphs: [...allCats].map((c) => S["cat_" + c] ?? en["cat_" + c] ?? c),
    legalRefs: [],
  });

  if (specialCats.length) {
    const refs: LegalRef[] = [g(9)];
    sections.push({ id: "special", heading: S["sec_special"]!, paragraphs: [], legalRefs: refs });
  }

  const recipients = [...new Set(input.purposes.flatMap((p) => p.recipients ?? []))];
  if (recipients.length) sections.push({ id: "recipients", heading: S["sec_recipients"]!, paragraphs: recipients, legalRefs: [g(13, "(1)(e)")] });
  const retention = input.purposes.filter((p) => p.retention).map((p) => `${p.label}: ${p.retention}`);
  if (retention.length) sections.push({ id: "retention", heading: S["sec_retention"]!, paragraphs: retention, legalRefs: [g(13, "(2)(a)")] });
  const transfers = input.purposes.filter((p) => p.transferOutsideEea);
  if (transfers.length)
    sections.push({
      id: "transfers",
      heading: S["sec_transfers"]!,
      paragraphs: transfers.map((p) => `${p.label}: ${p.transferOutsideEea!.description} — ${p.transferOutsideEea!.safeguard}`),
      legalRefs: [g(13, "(1)(f)"), g(44), g(46), g(49)],
    });

  sections.push({
    id: "rights",
    heading: S["sec_rights"]!,
    paragraphs: [],
    legalRefs: [15, 16, 17, 18, 19, 20, 21, 22].map((n) => g(n)),
  });
  sections.push({ id: "withdraw", heading: S["sec_withdraw"]!, paragraphs: [], legalRefs: [g(7)] });

  const nat: LegalRef[] = [];
  const natLang = profile.languages[0]!;
  for (const law of profile.laws)
    nat.push({
      instrument: "NATIONAL",
      citation: law.number ? `${law.title} (${law.number})` : law.title,
      title: law.title,
      text: [],
      language: law.language,
      source: law.url,
      verification: law.status,
    });
  if (hasHealth)
    for (const h of profile.health?.provisions ?? []) {
      const law = profile.laws.find((l) => l.id === h.lawId);
      nat.push({ instrument: "NATIONAL", citation: `${law?.title ?? h.lawId} — ${h.article}`, title: h.topic, text: h.evidence && !h.headingOnly ? [`${h.evidence.excerpt}…`] : [], language: natLang, source: h.evidence?.url ?? law?.url, verification: h.status });
    }
  if (hasHealth)
    for (const law of profile.sectorHealth ?? [])
      for (const pr of law.provisions)
        nat.push({ instrument: "NATIONAL", citation: `${law.title} — ${pr.article}`, title: pr.topic, text: pr.evidence ? [`${pr.evidence.excerpt}…`] : [], language: law.language, source: pr.evidence?.url ?? law.url, verification: pr.status });
  if ((guardian.required || input.informationSocietyService) && dca.value !== null) {
    const law = profile.laws.find((l) => l.id === dca.lawId);
    nat.push({ instrument: "NATIONAL", citation: `${law?.title ?? ""} — ${dca.article} (${dca.value})`, title: "Art. 8 GDPR", text: dca.evidence ? [`${dca.evidence.excerpt}…`] : [], language: natLang, source: dca.evidence?.url ?? law?.url, verification: dca.status });
  }
  sections.push({
    id: "authority",
    heading: S["sec_authority"]!,
    paragraphs: [`${profile.authority.name} — ${profile.authority.url}`],
    legalRefs: [g(77)],
  });
  sections.push({ id: "law", heading: S["sec_law"]!, paragraphs: [], legalRefs: nat });
  if (guardian.required) sections.push({ id: "minor", heading: S["sec_guardian"]!, paragraphs: [], legalRefs: [g(8)] });

  // ---- items ----------------------------------------------------------------------
  const items: Item[] = [];
  items.push({ id: "notice_ack", kind: "notice_ack", required: true, label: S["lbl_notice_ack"]!, legalRefs: [`${short} · ${art} 13`] });
  for (const p of consentItemsPurposes) {
    const explicit = p.art9Condition === "explicit_consent";
    items.push({
      id: "consent:" + p.id,
      kind: explicit ? "explicit_consent" : "consent",
      required: false,
      label: `${explicit ? S["lbl_explicit"] : S["lbl_consent"]}: ${p.label}`,
      purposeId: p.id,
      legalRefs: [explicit ? `${short} · ${art} 9(2)(a)` : `${short} · ${art} 6(1)(a)`, `${short} · ${art} 7`],
    });
  }

  const strings: Record<string, string> = {};
  for (const [k, v] of Object.entries(S)) strings[k] = fill(v, vars);

  const body = {
    schema: "rgpd-mcp/consent-document@1" as const,
    version: input.documentVersion ?? "1",
    country: profile.code,
    language: loc.resolved,
    uiFallback,
    legalTextLanguage: legalLang,
    controller: input.controller,
    title: S["title_notice"]!,
    intro: fill(S["intro"]!, vars),
    sections,
    items,
    guardian,
    strings,
  };
  const documentHash = createHash("sha256").update(stable(body)).digest("hex");
  return {
    ...body,
    documentId: randomUUID(),
    documentHash,
    createdAt: new Date().toISOString(),
    issues,
    dataStatus: { countryProfile: pStatus },
  };
}

/** Check that every article cited by the builder exists in every stored language. Used by tests. */
export function selfCheckArticles(): string[] {
  const missing: string[] = [];
  for (const l of gdprLanguages()) {
    const d = getGdpr(l);
    for (const n of [6, 7, 8, 9, 13, 15, 16, 17, 18, 19, 20, 21, 22, 44, 46, 49, 77]) if (!d.articles[String(n)]) missing.push(`${l}:${n}`);
  }
  return missing;
}
