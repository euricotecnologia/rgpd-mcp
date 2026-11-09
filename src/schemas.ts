import { z } from "zod";
import { ART6, ART9, DATA_CATEGORIES } from "./consent.js";

const cats = Object.keys(DATA_CATEGORIES) as [keyof typeof DATA_CATEGORIES, ...(keyof typeof DATA_CATEGORIES)[]];
const art6 = Object.keys(ART6) as [keyof typeof ART6, ...(keyof typeof ART6)[]];
const art9 = Object.keys(ART9) as [keyof typeof ART9, ...(keyof typeof ART9)[]];

export const PurposeSchema = z.object({
  id: z.string().min(1).max(64).describe("Stable id, [A-Za-z0-9_-]"),
  label: z.string().min(1).max(500).describe("Text shown to the data subject, in the document language"),
  legalBasis: z.enum(art6).describe("Art. 6(1) basis: consent=a, contract=b, legal_obligation=c, vital_interests=d, public_task=e, legitimate_interests=f"),
  art9Condition: z.enum(art9).optional().describe("Art. 9(2) condition; mandatory when special-category data (health, genetic, biometric...) is processed. health_care=Art. 9(2)(h), explicit_consent=Art. 9(2)(a)"),
  required: z.boolean().describe("true = processing occurs regardless of the person's choice (information only). Consent-based purposes MUST be false (Art. 7(4))"),
  dataCategories: z.array(z.enum(cats)).optional(),
  recipients: z.array(z.string().max(300)).max(50).optional(),
  retention: z.string().max(500).optional(),
  transferOutsideEea: z.object({ description: z.string().max(500), safeguard: z.string().max(500) }).optional(),
});

export const BuildSchema = z.object({
  country: z.string().length(2).describe("ISO 3166-1 alpha-2, e.g. PT, ES, FR"),
  language: z.string().min(2).max(5).optional().describe("ISO 639-1; default = primary official language of the country"),
  controller: z.object({
    name: z.string().min(1).max(200),
    address: z.string().max(500).optional(),
    email: z.string().max(200).optional(),
    taxId: z.string().max(60).optional(),
    dpo: z.object({ name: z.string().max(200).optional(), email: z.string().max(200) }).optional(),
  }),
  dataCategories: z.array(z.enum(cats)).min(1),
  purposes: z.array(PurposeSchema).min(1).max(50),
  subject: z.object({ ageYears: z.number().int().min(0).max(130).optional() }).optional(),
  informationSocietyService: z.boolean().optional().describe("true when an online service is offered directly to a child (Art. 8 applies)"),
  documentVersion: z.string().max(40).optional(),
});

export const DecisionSchema = z.object({ itemId: z.string().max(200), granted: z.boolean() });

export const RecordSchema = z.object({
  documentId: z.string().length(36),
  subjectRef: z.string().min(1).max(128).describe("Opaque pseudonymous id. NEVER a name, e-mail or national id"),
  decisions: z.array(DecisionSchema).max(100),
  guardian: z.object({ name: z.string().max(200), relationship: z.string().max(100), confirmed: z.boolean() }).optional(),
  channel: z.string().max(100).optional(),
});

export const WithdrawSchema = z.object({
  documentId: z.string().length(36),
  subjectRef: z.string().min(1).max(128),
  itemIds: z.array(z.string().max(200)).max(100).optional(),
  channel: z.string().max(100).optional(),
});

export const LocaleSchema = z.object({
  ip: z.string().max(64).optional().describe("Visitor IP as seen by your trusted backend. Personal data: not stored or logged"),
  acceptLanguage: z.string().max(300).optional().describe("Value of the Accept-Language header"),
  establishmentCountry: z.string().length(2).optional().describe("Country where the clinic/controller is established; wins over the IP"),
  userChoice: z.object({ country: z.string().length(2).optional(), language: z.string().min(2).max(5).optional() }).optional(),
});
