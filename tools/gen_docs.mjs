// Generates docs/PAISES.md from data/countries/*.json so the documentation can never drift from the data.
// Run: npm run build && node tools/gen_docs.mjs
import { writeFileSync } from "node:fs";
import { listCountries, availableLocales, gdprLanguages } from "../dist/data.js";
import { countryState, coverage } from "../dist/coverage.js";

const STATE = { verified: "✅ verificado", partial: "🟡 parcial", unverified: "⚪ por verificar" };
const FACT = { verified: "✅", inferred: "🟡 inferido", unverified: "⚪" };
const REGION = { EU: "UE", EEA: "EEE", UK: "Reino Unido", CH: "Suíça", OTHER: "Outro" };
const cs = listCountries().sort((a, b) => a.name.pt.localeCompare(b.name.pt, "pt"));
const cov = coverage();
const ui = new Set(availableLocales());
const eu = new Set(gdprLanguages());
const today = new Date().toISOString().slice(0, 10);

const out = [];
const w = (s = "") => out.push(s);

w("# Países integrados");
w();
w(`> Gerado automaticamente por \`tools/gen_docs.mjs\` a partir de \`data/countries/*.json\` em ${today}. **Não edite à mão**: altere \`tools/build_countries.py\` e regenere.`);
w();
w(`O MCP cobre **${cs.length} países**: os 27 da União Europeia e 3 do Espaço Económico Europeu (Noruega, Islândia e Liechtenstein). Reino Unido e Suíça **não** estão incluídos (regimes próprios: UK GDPR/DPA 2018 e nLPD).`);
w();
w("## Significado dos estados");
w();
w("| Estado | Significado |");
w("|---|---|");
w("| ✅ verificado | Autoridade, **todas** as leis listadas e a idade do Art. 8 confirmadas em texto oficial/público baixado (guardamos URL, data, SHA-256 e o excerto verbatim) |");
w("| 🟡 parcial | Pelo menos um facto nacional verificado ou **inferido** (a idade vale o teto de 16 anos do RGPD porque o texto lido não traz regra própria) |");
w("| ⚪ por verificar | Só a autoridade de controlo está verificada |");
w("| 🟡 inferido | Facto deduzido da **ausência** de regra no texto lido: exige revisão jurídica |");
w();
w("## Resumo");
w();
w(`- ✅ Verificados: **${cov.verified}** · 🟡 Parciais: **${cov.partial}** · ⚪ Por verificar: **${cov.unverified}**`);
const withSector = cs.filter((c) => c.sectorHealth?.length);
w(`- Legislação setorial de saúde verificada em **${withSector.length}** países; por fazer: ${cs.filter((c) => !c.sectorHealth?.length).map((c) => c.code).join(", ") || "nenhum"}.`);
w();
w("## Tabela geral");
w();
w("| País | Cód. | Região | Idiomas (1.º = padrão) | Idade Art. 8 | Estado | Saúde setorial | Rótulos na língua | Texto RGPD na língua |");
w("|---|---|---|---|---|---|---|---|---|");
for (const c of cs) {
  const a = c.digitalConsentAge;
  const age = a.value === null ? "?" : `${a.value}${a.status === "inferred" ? " (inferida)" : a.status === "unverified" ? " (não verificada)" : ""}`;
  w(`| ${c.name.pt} | ${c.code} | ${REGION[c.region]} | ${c.languages.join(", ")} | ${age} | ${STATE[countryState(c)]} | ${c.sectorHealth?.length ? "✅" : "—"} | ${ui.has(c.languages[0]) ? "sim" : "inglês"} | ${eu.has(c.languages[0]) ? "sim" : "inglês"} |`);
}
w();
w("> “Rótulos” = botões e títulos da interface (redigidos pelo autor do projeto, **não revistos** por falante nativo). O texto jurídico mostrado ao titular é sempre o texto oficial do RGPD no idioma indicado.");
w();
w("---");
w();
w("## Fichas por país");
for (const c of cs) {
  w();
  w(`### ${c.name.pt} (${c.code}) — ${STATE[countryState(c)]}`);
  w();
  w(`- **Região:** ${REGION[c.region]} · **Idiomas:** ${c.languages.join(", ")} · **Última revisão dos dados:** ${c.lastReviewed}`);
  w(`- **Autoridade de controlo:** [${c.authority.name}](${c.authority.url}) ${FACT[c.authority.status]}`);
  const a = c.digitalConsentAge;
  w(`- **Idade de consentimento digital (Art. 8 RGPD):** ${a.value === null ? "não determinada" : a.value + " anos"} ${FACT[a.status]} — ${a.article}`);
  w("- **Leis nacionais que executam o RGPD:**");
  if (!c.laws.length) w("  - (nenhuma lida)");
  for (const l of c.laws) w(`  - ${l.url ? `[${l.title}](${l.url})` : l.title}${l.number ? ` — ${l.number}` : ""} ${FACT[l.status]}`);
  if (c.health?.provisions?.length) {
    w("- **Disposições sobre dados de saúde (Art. 9(4)):**");
    for (const h of c.health.provisions) w(`  - ${h.article}: ${h.topic}${h.headingOnly ? " _(só o título foi verificado)_" : ""} ${FACT[h.status]}`);
  }
  if (c.sectorHealth?.length) {
    w("- **Legislação setorial de saúde (direitos do doente, prontuário, sigilo):**");
    for (const l of c.sectorHealth) {
      w(`  - [${l.title}](${l.url})${l.number ? ` — ${l.number}` : ""} ${FACT[l.status]}`);
      for (const p of l.provisions) w(`    - ${p.article}: ${p.topic}`);
      if (l.note) w(`    - _Nota:_ ${l.note}`);
    }
  }
  if (c.notes?.length) for (const n of c.notes) w(`- _Nota:_ ${n}`);
}
writeFileSync(new URL("../docs/PAISES.md", import.meta.url), out.join("\n") + "\n", "utf-8");
console.log("docs/PAISES.md", out.length, "linhas");
