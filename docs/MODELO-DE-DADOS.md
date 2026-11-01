# Modelo de dados e método de verificação

## Estados de um facto

| Estado | Significado | Como o sistema o trata |
|---|---|---|
| `verified` | Valor lido em texto oficial/público **descarregado**; guardamos URL, data, SHA-256 do ficheiro e excerto verbatim | Apresentado como autoritativo |
| `inferred` | Resulta da **ausência** de regra no texto lido (ex.: a idade fica no teto de 16 anos do Art. 8) | Mostrado com etiqueta; exige revisão jurídica |
| `unverified` | Pista de fonte secundária ou não investigado | Nunca autoritativo; o documento avisa |

O estado do país (`src/coverage.ts`): **verified** = autoridade, todas as leis listadas e a idade do Art. 8 verificadas; **partial** = pelo menos uma lei ou a idade verificada/inferida; **unverified** = só a autoridade.

## Perfil de país (`data/countries/<CC>.json`)

| Campo | Conteúdo |
|---|---|
| `code`, `name{}`, `region`, `languages[]` | Identificação; nomes em en/pt/es/fr/de/it/nl e idioma nativo; região UE/EEE; 1.º idioma = padrão |
| `authority` | Nome, site e evidência (lista oficial de membros do EDPB) |
| `laws[]` | Leis nacionais que executam o RGPD: título oficial, número, data, jornal, URL, estado, evidência |
| `digitalConsentAge` | `value`, `status`, `article`, `lawId`, evidência |
| `health.provisions[]` | Disposições do Art. 9(4) (dados de saúde): artigo, tema, estado, evidência, `headingOnly?` |
| `sectorHealth[]` | Legislação setorial de saúde: lei, URL, estado, nota e `provisions[]` (artigo, tema, evidência) |
| `notes[]`, `lastReviewed` | Notas e data |

`Evidence` = `{url, retrievedAt, sha256, language, excerpt}`. `headingOnly` marca disposições cujo texto só foi confirmado pelo título/índice (o modal mostra apenas o título e o link, nunca um índice como se fosse texto da lei).

Os excertos têm resíduos de interface dos sites removidos (por exemplo, “Subir [Bloque…]” do BOE, “Toon relaties in LiDO…”, “Paragraph 51,” do RIS); o texto jurídico não é alterado.

## RGPD oficial (`data/gdpr/<idioma>.json`)
24 idiomas da UE, extraídos da rendição XHTML do ato publicado no Jornal Oficial (Serviço de Publicações da UE, CELEX 32016R0679, JO L 119, 4.5.2016). Estrutura: `celex`, `eli`, `language`, `chapters`, `articles{n:{title,paragraphs[]}}`, `recitals{n}`. `manifest.json` guarda o SHA-256 de cada fonte. O extrator falha se não houver 99 artigos, 173 considerandos e 11 capítulos com título e corpo. Para Noruega e Islândia não há versão no conjunto de dados.

## Rótulos da interface (`data/i18n/<idioma>.json`)
59 chaves de rótulos + 6 da tela de retirada. `_review.json` regista que nenhum idioma além do inglês de referência foi revisto por falante nativo. As frases mostradas como “o que diz a lei” **não** vêm daqui.

## Fontes por tipo
- **RGPD:** Serviço de Publicações da UE (Cellar).
- **Autoridades:** lista de membros do EDPB, verificada por script (o nome tem de constar do ficheiro guardado).
- **Leis nacionais:** portais oficiais (BOE, Normattiva, Riksdagen, RIS, Lovdata, Finlex, Retsinformation, Slov-Lex, e-TAR, Riigi Teataja, Latvijas Vēstnesis, Diário da República, Légifrance, Althingi, …), páginas de autoridades ou de organismos públicos, e em poucos casos portais não oficiais (marcados nas notas de cada país).
- **Leitura:** descarga direta (`curl`), PDF convertido com `pdftotext`, ou páginas renderizadas no Chrome/navegador embutido (nestes casos o ficheiro guardado é um **extrato**, não o texto integral).

## Como estender
1. Descarregar o texto oficial para `tools/source/national/<CC>.html` (ou `health/` para setorial).
2. Registar em `tools/build_countries.py` (`law(...)`, `AGE[...]`, `HEALTH[...]`, `sector(...)`) com a regex da evidência.
3. `python -X utf8 -I tools/build_countries.py` — **falha** se a evidência não for encontrada.
4. `npm test` e `node tools/gen_docs.mjs`.

## Documento de consentimento e ledger
Ver [FERRAMENTAS-MCP.md](FERRAMENTAS-MCP.md) (saída do documento) e [API-HTTP.md](API-HTTP.md) (regras e campos do ledger). O `documentHash` é determinístico: entradas iguais geram o mesmo hash (o `documentId` e a data são únicos).
