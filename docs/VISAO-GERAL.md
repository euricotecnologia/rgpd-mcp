# Visão geral

**rgpd-mcp** é um servidor **MCP** (Model Context Protocol) com **API HTTP** e **janela modal web** para criar avisos de privacidade e consentimentos conforme o **RGPD** (Regulamento (UE) 2016/679) e as leis nacionais de proteção de dados de **30 países europeus**, **no idioma de cada país**. Foi pensado para sistemas de saúde, mas serve a qualquer sistema que trate dados pessoais.

> **Não é aconselhamento jurídico.** Antes de uso real, o conteúdo e os fluxos devem ser revistos por DPO/EPD e por jurista do país. Ver [LIMITACOES.md](LIMITACOES.md).

## O que o sistema entrega

| Camada | O que faz |
|---|---|
| **Base legal** | Texto oficial do RGPD (99 artigos, 173 considerandos) nas **24 línguas oficiais da UE**; perfil de 30 países com autoridade de controlo, lei nacional, idade do consentimento digital (Art. 8), disposições de saúde (Art. 9(4)) e legislação setorial de saúde. Ver [PAISES.md](PAISES.md) |
| **Servidor MCP** (stdio) | 12 ferramentas, 2 recursos e 2 prompts para agentes de IA (Claude Code, Codex, Gemini CLI, Antigravity, OpenCode, VS Code…). Ver [FERRAMENTAS-MCP.md](FERRAMENTAS-MCP.md) |
| **Construtor de consentimento** | Gera o documento (secções com artigos oficiais, itens a marcar) e **recusa desenhos ilegais** (ex.: dados de saúde sem condição do Art. 9(2); consentimento obrigatório). Ver [REGRAS-E-VALIDACOES.md](REGRAS-E-VALIDACOES.md) |
| **Modal web** | Web Component `<rgpd-consent-modal>` e páginas `/modal/<id>` e `/manage/<id>` (iframe/WebView). Funciona com qualquer linguagem. Ver [API-HTTP.md](API-HTTP.md) |
| **Ledger de consentimento** | Registo apenas-acrescenta, encadeado por hash, com retirada (Art. 7(3)) e verificação de integridade |
| **Agente `rgpd-integrador`** | Subagente do Claude Code que implementa a integração no projeto do utilizador, de ponta a ponta. Ver [INTEGRACAO.md](INTEGRACAO.md) |

## Princípios de desenho

1. **Nenhum facto jurídico sem evidência.** Cada dado de país guarda o URL de origem, a data, o SHA-256 do ficheiro lido e o excerto verbatim. Estados: `verified`, `inferred`, `unverified`. O build **falha** se uma evidência deixar de ser encontrada.
2. **Texto jurídico = citação oficial.** O que é mostrado ao titular como “o que a lei diz” vem do RGPD oficial no idioma do país (e de excertos verbatim das leis nacionais). As traduções do projeto só rotulam a interface.
3. **Cuidados de saúde não dependem de consentimento.** O fundamento é o Art. 9(2)(h) (+ Art. 9(3)); por isso o primeiro atendimento mostra um **aviso informativo** obrigatório e, à parte, **consentimentos facultativos e separados** (marketing, investigação, partilha), desmarcados por defeito (Art. 7(2),(4); considerandos 32 e 43).
4. **O agente constrói; o titular consente.** Não existe ferramenta MCP para registar consentimento em nome de alguém.
5. **O servidor decide, não o navegador.** O evento do modal só dispara uma verificação; quem libera o atendimento é o backend, lendo o ledger.
6. **Minimização.** O ledger guarda apenas um `subjectRef` pseudónimo; o servidor rejeita valores com `@` ou espaços.

## Arquitetura

```
 Claude Code / Codex / Gemini / ...        Sistema do utilizador (qualquer linguagem)
        │  MCP (stdio)                             │  HTTP (chave de API no backend)
        ▼                                          ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ rgpd-mcp                                                      │
 │  src/mcp.ts      ferramentas, recursos, prompts               │
 │  src/consent.ts  construtor + validação (regras do RGPD)      │
 │  src/data.ts     carregador (RGPD 24 línguas, 30 países, i18n)│
 │  src/ledger.ts   ledger JSONL encadeado por hash              │
 │  src/http.ts     API HTTP, /modal, /manage, tokens de captura │
 │  web/            rgpd-consent.js (Web Component), modal-page  │
 └───────────────────────────────────────────────────────────────┘
        │ data/gdpr/*.json (24)  data/countries/*.json (30)  data/i18n/*.json (25)
```

### Estrutura do repositório

| Pasta | Conteúdo |
|---|---|
| `src/` | Código TypeScript do servidor, API, construtor, ledger, instaladores, snippets, agente |
| `data/gdpr/` | RGPD oficial por idioma + `manifest.json` (hash de cada fonte) |
| `data/countries/` | 30 perfis de país com evidências |
| `data/i18n/` | Rótulos da interface em 25 idiomas + `_review.json` |
| `web/` | Web Component do modal e bootstrap das páginas iframe |
| `tools/` | Geradores de dados (`extract_gdpr.py`, `build_countries.py`, `build_i18n.py`, …) e `gen_docs.mjs`; `tools/source/` guarda os textos oficiais lidos |
| `examples/clinic/`, `examples/clinic-react/` | Clínica simulada (Node) e exemplo React + TypeScript |
| `tests/` | 41 testes (núcleo, integração HTTP/MCP, instaladores, simulação da clínica) |
| `docs/` | Esta documentação |

## Estado atual (resumo)

- RGPD oficial em **24 idiomas** ✅
- **30 países**: 22 verificados, 8 parciais (ver [PAISES.md](PAISES.md))
- Legislação setorial de saúde em **26 países** (faltam BE, IE, MT, RO)
- Rótulos da interface em **25 idiomas** (redigidos pelo projeto, **não revistos** por falante nativo)
- Testado: 41 testes automáticos; modal verificado em Chrome real (PT, ES, FR); snippets Python, Node, Go, Java, Rust e React executados/compilados
