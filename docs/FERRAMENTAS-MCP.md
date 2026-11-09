# Ferramentas, recursos e prompts MCP

Servidor MCP `rgpd` (stdio). Todas as ferramentas, exceto `build_consent_document` e `open_consent_modal`, são **só de leitura**. **Não existe** ferramenta para registar consentimento: quem consente é o titular, no modal.

## Instruções ao agente (enviadas pelo servidor)
Resumo: texto jurídico só vem das ferramentas; tratar apenas `verified` como autoritativo e avisar o utilizador dos outros estados; `build_consent_document` rejeita desenhos ilegais; o agente constrói formulários e o titular consente; **quando pedirem para criar/integrar o consentimento no sistema, fazer o trabalho todo** (guia → explorar projeto → validar → implementar backend + modal + bloqueio no servidor + saída alternativa → testar → relatar) e delegar ao subagente `rgpd-integrador` se existir; não é aconselhamento jurídico.

## Ferramentas

| Ferramenta | Entrada | O que devolve |
|---|---|---|
| `list_countries` | `region?` (`EU`, `EEA`, `UK`, `CH`, `OTHER`) | Relatório de cobertura e, por país: código, nomes, região, idiomas, autoridade, idade do Art. 8 e estado |
| `get_country_law` | `country` (ISO 3166-1 alfa-2) | Perfil completo: leis, autoridade, idade, disposições de saúde e legislação setorial, **com estado e evidência** de cada facto |
| `get_gdpr_article` | `article` (1–99), `language` (2 letras; padrão `en`) | Texto oficial do artigo no idioma pedido |
| `get_gdpr_recital` | `recital` (1–173), `language` | Texto oficial do considerando |
| `search_gdpr` | `query`, `language`, `limit` (1–30) | Pesquisa por palavras-chave em artigos e considerandos |
| `get_reference` | — | Categorias de dados, bases do Art. 6(1), condições do Art. 9(2), locales, idiomas do RGPD e **regras impostas** pelo construtor. Chamar antes de construir |
| `build_consent_document` | ver [Entrada do construtor](#entrada-do-construtor) | Valida, guarda e devolve o documento (secções com artigos oficiais, itens, `issues`, `modalUrl` se o HTTP estiver ativo). Falha com razões explícitas se o desenho for ilegal |
| `open_consent_modal` | `documentId` | Abre a **pré-visualização** do modal no navegador local (só URLs de loopback). Sem token de captura não grava nada |
| `get_consent_status` | `subjectRef` | Estado efetivo por item (última decisão vence; retiradas incluídas) |
| `verify_ledger` | — | Recalcula a cadeia de hash e indica o primeiro registo quebrado |
| `get_integration_snippet` | `language` (`html`, `react`, `node`, `go`, `java`, `rust`, `delphi`, `python`, `csharp`, `php`), `baseUrl?` | Código de integração com nota honesta sobre se foi executado nos testes |
| `resolve_locale` | `ip?`, `acceptLanguage?`, `establishmentCountry?`, `fallbackCountry?` | **Opcional.** Sugere país e idioma (ver [INTEGRACAO.md](INTEGRACAO.md#país-e-idioma-por-ip-opcional)). Devolve `country`, `language`, a origem de cada um, `undetermined`, `languageOptions` e avisos. O IP é dado pessoal: não é gravado nem registado |
| `get_integration_guide` | `country` (padrão `PT`), `language?` | Receita completa para integrar o consentimento no início do atendimento: arquitetura, endpoints a criar, bloqueio no servidor, pedido-modelo da primeira consulta, retirada (Art. 7(3)), regras e 5 testes de aceitação |

### Entrada do construtor
`build_consent_document`:

| Campo | Tipo | Descrição |
|---|---|---|
| `country` | string(2) | País (ISO alfa-2) |
| `language` | string? | Idioma da interface **e** do texto legal; padrão = 1.º idioma do país |
| `controller` | objeto | `name` (obrigatório), `address?`, `email?`, `taxId?`, `dpo?: {name?, email}` |
| `dataCategories` | lista | `identification`, `contact`, `demographic`, `financial`, `location`, `online_identifiers`, `images`, `health`, `genetic`, `biometric`, `racial_ethnic`, `political`, `religious`, `trade_union`, `sex_life`, `criminal` |
| `purposes` | lista (1–50) | Finalidades (abaixo) |
| `subject.ageYears?` | inteiro | Idade do titular |
| `informationSocietyService?` | boolean | `true` quando um serviço online é oferecido diretamente a uma criança (Art. 8) |
| `documentVersion?` | string | Versão do documento |

Cada finalidade: `id`, `label` (texto do responsável, no idioma do documento), `legalBasis` (`consent`=6(1)(a), `contract`=(b), `legal_obligation`=(c), `vital_interests`=(d), `public_task`=(e), `legitimate_interests`=(f)), `art9Condition?` (`explicit_consent`=9(2)(a), `employment_social_security`=(b), `vital_interests`=(c), `nonprofit_body`=(d), `made_public_by_subject`=(e), `legal_claims`=(f), `substantial_public_interest`=(g), **`health_care`=(h)**, `public_health`=(i), `research_archiving_statistics`=(j)), `required`, `dataCategories?`, `recipients?`, `retention?`, `transferOutsideEea?: {description, safeguard}`.

**Cuidados de saúde**: `legalBasis: contract`, `art9Condition: health_care`, `required: true` → aparece como **aviso informativo**, não como consentimento.

### Saída do documento
`documentId` (UUID), `documentHash` (SHA-256 do conteúdo; igual para entradas iguais), `schema`, `version`, `createdAt`, `country`, `language`, `uiFallback`, `legalTextLanguage`, `controller`, `title`, `intro`, `sections[]` (cada uma com `legalRefs[]`: citação, título, texto oficial, idioma, fonte, verificação), `items[]` (`notice_ack`, `consent`, `explicit_consent`), `guardian` (`required`, `reason`), `strings` (rótulos), `issues[]`, `dataStatus`.

Secções geradas: responsável, encarregado (DPO), finalidades e fundamento jurídico, categorias, categorias especiais (Art. 9, quando aplicável), destinatários, prazo de conservação, transferências fora da UE/EEE (Arts. 44, 46, 49), direitos (Arts. 15–22), retirada do consentimento (Art. 7), autoridade de controlo (Art. 77), **enquadramento legal** (leis nacionais; excertos verificados da idade do Art. 8 e das disposições de saúde e setoriais quando há dados de saúde) e, se necessário, titular da responsabilidade parental (Art. 8).

## Recursos
| URI | Conteúdo |
|---|---|
| `rgpd://gdpr/{language}/article/{number}` | Artigo oficial em JSON |
| `rgpd://country/{code}` | Perfil do país em JSON |

## Prompts
| Prompt | Argumentos | Função |
|---|---|---|
| `integrar_no_sistema` | `country`, `clinicName`, `stack?` | Instrui o agente a implementar, **no projeto aberto**, o consentimento ao iniciar o atendimento, em 6 passos, com testes e relatório. Em clientes que expõem prompts como comandos, o nome costuma ser `/mcp__rgpd__integrar_no_sistema` (não verificado num cliente real) |
| `healthcare_first_visit` | `country`, `clinicName` | Desenho do fluxo da primeira consulta e relatório dos factos não verificados |

## Agente `rgpd-integrador`
Subagente do Claude Code (`install-agent`). Processo: explorar o projeto → obter a receita (`get_integration_guide`, `get_reference`, `get_country_law`) → validar com `build_consent_document` → implementar (backend, modal, bloqueio no servidor, saída alternativa, retirada, configuração) → testar de verdade (5 casos) → relatório final. Regras: nunca registar consentimento pelo paciente; `subjectRef` pseudónimo; chave de API só no backend; sem commit; usa marcadores `<PREENCHER: …>` quando faltam dados da clínica (não pode fazer perguntas durante a execução). Invocação: `@agent-rgpd-integrador …`, linguagem natural, ou `claude --agent rgpd-integrador`.
