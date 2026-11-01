import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { ConsentDocument } from "./consent.js";

/**
 * Append-only, hash-chained consent ledger (Art. 7(1) GDPR: the controller must be able to
 * demonstrate that the data subject consented). File based (JSONL) so it works with zero
 * infrastructure; single-writer. Production systems with several instances should mirror
 * these records into their own database via the HTTP API/webhook.
 *
 * The ledger stores a pseudonymous `subjectRef` chosen by the integrator. Never send names,
 * e-mails or national identifiers as subjectRef (data minimisation, Art. 5(1)(c)).
 */

export interface Decision {
  itemId: string;
  granted: boolean;
}

export interface ConsentRecord {
  recordId: string;
  seq: number;
  prevHash: string;
  hash: string;
  createdAt: string;
  type: "decision" | "withdrawal";
  documentId: string;
  documentHash: string;
  country: string;
  language: string;
  subjectRef: string;
  decisions: Decision[];
  guardian?: { name: string; relationship: string; confirmed: boolean };
  /** informational, e.g. "reception-desk-2"; never personal data */
  channel?: string;
}

const GENESIS = "0".repeat(64);

function stable(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.keys(v as object)
        .sort()
        .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
        .map((k) => JSON.stringify(k) + ":" + stable((v as Record<string, unknown>)[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(v);
}

export class LedgerError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export class Ledger {
  private file: string;
  private docsDir: string;
  private last: { seq: number; hash: string } = { seq: 0, hash: GENESIS };

  constructor(public dir: string) {
    mkdirSync(path.join(dir, "documents"), { recursive: true });
    this.file = path.join(dir, "ledger.jsonl");
    this.docsDir = path.join(dir, "documents");
    if (existsSync(this.file)) {
      const recs = this.readAll();
      const l = recs.at(-1);
      if (l) this.last = { seq: l.seq, hash: l.hash };
    } else writeFileSync(this.file, "");
  }

  /* ---- documents: stored so a record can later be tied to the exact text shown ---- */
  saveDocument(doc: ConsentDocument): void {
    if (!/^[0-9a-f-]{36}$/.test(doc.documentId)) throw new LedgerError("BAD_DOC_ID", "invalid documentId");
    writeFileSync(path.join(this.docsDir, doc.documentId + ".json"), JSON.stringify(doc, null, 1), { flag: "wx" });
  }
  getDocument(id: string): ConsentDocument | null {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const f = path.join(this.docsDir, id + ".json");
    return existsSync(f) ? (JSON.parse(readFileSync(f, "utf-8")) as ConsentDocument) : null;
  }

  private readAll(): ConsentRecord[] {
    const txt = readFileSync(this.file, "utf-8");
    return txt
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as ConsentRecord);
  }

  /** Re-read the chain head: another process (e.g. a second MCP client) may have appended. */
  private refreshLast() {
    const recs = this.readAll();
    const l = recs.at(-1);
    this.last = l ? { seq: l.seq, hash: l.hash } : { seq: 0, hash: GENESIS };
  }

  private append(rec: Omit<ConsentRecord, "seq" | "prevHash" | "hash" | "recordId" | "createdAt">): ConsentRecord {
    this.refreshLast();
    const base = { ...rec, recordId: randomUUID(), seq: this.last.seq + 1, prevHash: this.last.hash, createdAt: new Date().toISOString() };
    const hash = createHash("sha256").update(base.prevHash + stable(base)).digest("hex");
    const full: ConsentRecord = { ...base, hash };
    appendFileSync(this.file, JSON.stringify(full) + "\n");
    this.last = { seq: full.seq, hash };
    return full;
  }

  /** Record the data subject's decisions on a previously built document. */
  recordDecision(input: { documentId: string; subjectRef: string; decisions: Decision[]; guardian?: ConsentRecord["guardian"]; channel?: string }): ConsentRecord {
    const doc = this.getDocument(input.documentId);
    if (!doc) throw new LedgerError("DOC_NOT_FOUND", `Document ${input.documentId} was not built by this server; build it first.`);
    if (!input.subjectRef || input.subjectRef.length > 128 || /[\s@]/.test(input.subjectRef))
      throw new LedgerError("BAD_SUBJECT_REF", "subjectRef must be an opaque pseudonymous id (<=128 chars, no spaces or '@').");
    const byId = new Map(doc.items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    for (const d of input.decisions) {
      if (!byId.has(d.itemId)) throw new LedgerError("UNKNOWN_ITEM", `Unknown item "${d.itemId}" for this document.`);
      if (seen.has(d.itemId)) throw new LedgerError("DUP_ITEM", `Duplicate decision for "${d.itemId}".`);
      seen.add(d.itemId);
    }
    for (const it of doc.items) {
      if (it.required && !input.decisions.some((d) => d.itemId === it.id && d.granted))
        throw new LedgerError("REQUIRED_MISSING", `Required item "${it.id}" was not acknowledged.`);
    }
    // anything not answered is recorded as refused: absence of consent is never consent
    const full: Decision[] = doc.items.map((it) => ({ itemId: it.id, granted: input.decisions.find((d) => d.itemId === it.id)?.granted === true }));
    const anyConsentGranted = full.some((d) => d.granted && byId.get(d.itemId)!.kind !== "notice_ack");
    if (doc.guardian.required && anyConsentGranted) {
      const g = input.guardian;
      if (!g || !g.confirmed || !g.name?.trim() || !g.relationship?.trim())
        throw new LedgerError("GUARDIAN_REQUIRED", `Guardian details are required (${doc.guardian.reason}).`);
    }
    return this.append({
      type: "decision",
      documentId: doc.documentId,
      documentHash: doc.documentHash,
      country: doc.country,
      language: doc.language,
      subjectRef: input.subjectRef,
      decisions: full,
      guardian: input.guardian,
      channel: input.channel,
    });
  }

  /** Art. 7(3): withdrawal must be as easy as giving consent. Withdraws the given items (or all consents). */
  withdraw(input: { subjectRef: string; documentId: string; itemIds?: string[]; channel?: string }): ConsentRecord {
    const doc = this.getDocument(input.documentId);
    if (!doc) throw new LedgerError("DOC_NOT_FOUND", "Unknown document");
    const consentIds = doc.items.filter((i) => i.kind !== "notice_ack").map((i) => i.id);
    const ids = input.itemIds?.length ? input.itemIds : consentIds;
    for (const id of ids) if (!consentIds.includes(id)) throw new LedgerError("UNKNOWN_ITEM", `"${id}" is not a withdrawable consent item.`);
    return this.append({
      type: "withdrawal",
      documentId: doc.documentId,
      documentHash: doc.documentHash,
      country: doc.country,
      language: doc.language,
      subjectRef: input.subjectRef,
      decisions: ids.map((itemId) => ({ itemId, granted: false })),
      channel: input.channel,
    });
  }

  /** Current effective state per (documentId,itemId) for a subject: last event wins. */
  status(subjectRef: string): { documentId: string; itemId: string; granted: boolean; since: string; recordId: string }[] {
    const m = new Map<string, { documentId: string; itemId: string; granted: boolean; since: string; recordId: string }>();
    for (const r of this.readAll()) {
      if (r.subjectRef !== subjectRef) continue;
      for (const d of r.decisions) m.set(r.documentId + "|" + d.itemId, { documentId: r.documentId, itemId: d.itemId, granted: d.granted, since: r.createdAt, recordId: r.recordId });
    }
    return [...m.values()];
  }

  /** Consent items (not the notice acknowledgement) of a document with the subject's current state, for the manage/withdraw screen. */
  itemStatus(subjectRef: string, documentId: string): { itemId: string; label: string; kind: string; granted: boolean }[] {
    const doc = this.getDocument(documentId);
    if (!doc) throw new LedgerError("DOC_NOT_FOUND", `Document ${documentId} not found`);
    const st = new Map(this.status(subjectRef).filter((x) => x.documentId === documentId).map((x) => [x.itemId, x.granted]));
    return doc.items.filter((i) => i.kind !== "notice_ack").map((i) => ({ itemId: i.id, label: i.label, kind: i.kind, granted: st.get(i.id) === true }));
  }

  records(subjectRef?: string): ConsentRecord[] {
    const a = this.readAll();
    return subjectRef ? a.filter((r) => r.subjectRef === subjectRef) : a;
  }

  /** Recompute the whole chain. Returns the first broken sequence number or null. */
  verify(): { ok: boolean; records: number; brokenAt: number | null } {
    let prev = GENESIS;
    const recs = this.readAll();
    for (const r of recs) {
      const { hash, ...base } = r;
      const expect = createHash("sha256").update(prev + stable(base)).digest("hex");
      if (r.prevHash !== prev || hash !== expect) return { ok: false, records: recs.length, brokenAt: r.seq };
      prev = hash;
    }
    return { ok: true, records: recs.length, brokenAt: null };
  }
}

export function defaultStateDir(): string {
  return process.env.RGPD_MCP_STATE_DIR ? path.resolve(process.env.RGPD_MCP_STATE_DIR) : path.join(homedir(), ".rgpd-mcp");
}
