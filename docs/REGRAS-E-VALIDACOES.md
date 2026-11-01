# Regras e validações do construtor

`build_consent_document` (MCP) e `POST /v1/consent-documents` (HTTP) executam as mesmas verificações. **Erros** impedem a geração (HTTP 422 / MCP `isError`); **avisos** e **informações** acompanham o documento em `issues[]`.

## Erros (o documento não é gerado)

| Código | Regra | Base |
|---|---|---|
| `ART9_CONDITION_MISSING` | Finalidade que trata categoria especial (saúde, genéticos, biométricos, origem racial/étnica, opiniões políticas, convicções religiosas, filiação sindical, vida sexual) sem `art9Condition` | Art. 9(1) e 9(2) |
| `LI_SPECIAL` | Interesses legítimos (Art. 6(1)(f)) não cobrem sozinhos categorias especiais | Art. 9 |
| `CONSENT_NOT_OPTIONAL` | Finalidade baseada em consentimento (ou em consentimento explícito do Art. 9(2)(a)) marcada como obrigatória | Art. 7(4); considerando 43 |
| `PURPOSE_ID` | `id` fora de `[A-Za-z0-9_-]{1,64}` | — |
| `PURPOSE_DUP` | `id` repetido | — |
| `PURPOSE_LABEL` | Finalidade sem texto | — |
| `NO_PURPOSE` | Nenhuma finalidade | Art. 5(1)(b) |
| `CATEGORY_UNKNOWN` | Categoria de dados desconhecida | — |

## Avisos

| Código | Quando |
|---|---|
| `ART9H_NO_HEALTH` | Usa o Art. 9(2)(h) sem declarar dados de saúde/genéticos |
| `OPTIONAL_NO_CONSENT` | Finalidade facultativa que não se baseia em consentimento (será apresentada só como informação) |
| `ART9_UNUSED` | Condição do Art. 9(2) declarada sem dados de categoria especial |
| `COUNTRY_DATA_PARTIAL` / `COUNTRY_DATA_UNVERIFIED` | Dados nacionais do país só parcialmente verificados ou por verificar |
| `AGE_UNVERIFIED` | Idade do Art. 8 do país não verificada: aplica-se o teto de 16 anos |
| `AGE_UNKNOWN` | Serviço da sociedade da informação sem idade do titular: recolher a idade primeiro |
| `MINOR_NON_ISS` | Menor em serviço que não é da sociedade da informação: o Art. 8 não se aplica; a capacidade segue o direito nacional |
| `HEALTH_NATIONAL_MISSING` | Dados de saúde num país sem disposições do Art. 9(4) verificadas |
| `LEGAL_TEXT_FALLBACK` | Não há texto oficial do RGPD no idioma pedido; usa-se o inglês |

## Informações
| Código | Significado |
|---|---|
| `UI_FALLBACK` | Não há rótulos no idioma pedido; a interface sai em inglês (o texto legal mantém-se no idioma oficial) |
| `UI_UNREVIEWED` | Os rótulos do idioma foram redigidos pelo projeto e **não foram revistos** por falante nativo com formação jurídica |

## Menores e responsável legal (Art. 8)
Com `informationSocietyService: true`:
- idade conhecida **abaixo** da idade verificada do país → `guardian.required = true`;
- país com idade **não verificada** → usa-se 16 e emite-se `AGE_UNVERIFIED`;
- idade desconhecida → `AGE_UNKNOWN`.
O ledger então exige `guardian {name, relationship, confirmed}` quando há consentimento concedido.

## Tipos de item do documento
| Tipo | Origem | Obrigatório | Retirável |
|---|---|---|---|
| `notice_ack` | “Li e compreendi esta informação” (Art. 13) | sim | não |
| `consent` | Finalidade com `legalBasis: consent` | não | sim |
| `explicit_consent` | Finalidade com `art9Condition: explicit_consent` | não | sim |

## Idiomas
- **Texto legal:** o do país (o 1.º idioma configurado) ou o pedido em `language`; é sempre o RGPD oficial nesse idioma. Noruega e Islândia: inglês (não há versão oficial no conjunto de dados).
- **Rótulos:** 25 idiomas (bg, cs, da, de, el, en, es, et, fi, fr, hr, hu, is, it, lt, lv, mt, nl, no, pl, pt, ro, sk, sl, sv). Sem rótulos: irlandês (`ga`). Idiomas de países multilingues: Bélgica nl/fr/de, Luxemburgo fr/de, Finlândia fi/sv, Irlanda en/ga, Malta mt/en. O primeiro é o padrão; use `language` para outro.
