# Registo de alterações

Formato: da mais recente para a mais antiga. Datas em AAAA-MM-DD.

> **Versão do pacote: 1.1.0** (definida a pedido em `package.json`, `package-lock.json`, `src/mcp.ts` e README). No GitHub, as tags/Releases `v1.1.0` e `v1.1.1` correspondem às duas iterações do dia descritas abaixo; o conteúdo atual do ramo `main` é o da segunda (automática, sem seletor).

## Iteração final de 2026-11-09 — país e idioma 100% automáticos (publicada como tag `v1.1.1`)

Correção da 1.1.0 a pedido: o paciente **não pode** ver nem escolher país ou idioma no modal.

**Removido (existia só na iteração inicial, publicada nesse mesmo dia)**
- Seletor de país/idioma do modal: atributo `locale-picker`, parâmetro `#localePicker=1`, evento `rgpd:localechange` e ponte `onLocaleChange` (`web/rgpd-consent.js`, `web/modal-page.js`).
- Rota pública `GET /v1/locale-options` (`src/http.ts`).
- Campo `userChoice` (país/idioma escolhidos pela pessoa) em `resolve-locale` e na ferramenta MCP `resolve_locale`.
- Campo de resposta `needsUserChoice`, substituído por `undetermined`.

**Adicionado**
- `autoLocale` em `POST /v1/consent-documents`: `{ip?, acceptLanguage?, establishmentCountry?, fallbackCountry?}` no lugar de `country`/`language`. O servidor deteta o país, constrói o documento na lei e no idioma desse país e devolve o objeto `locale` (origem de cada decisão e avisos). Um `language` explícito prevalece. Se não for possível determinar um país com perfil e não houver `fallbackCountry`, devolve **422** em vez de adivinhar uma lei.
- `fallbackCountry` (país de reserva, normalmente o da clínica) em `resolve-locale`, `resolve_locale` e `autoLocale`.
- Nova origem de país: `fallback`. Ordem de prioridade final: **país da clínica > IP > Accept-Language > país de reserva**.
- Guia `get_integration_guide` (secção `optionalCountryDetection`) e agente `rgpd-integrador` atualizados: usam `autoLocale` e **proíbem criar seletor** de país/idioma.

**Versão:** esta iteração saiu com `1.1.1`; depois foi fixada em **`1.1.0`** em `package.json`, `package-lock.json` e `src/mcp.ts` (versão anunciada pelo servidor).
**Publicação:** commit `425ff27`, tag e Release `v1.1.1`.

## Iteração inicial de 2026-11-09 — país e idioma por IP, opcional (publicada como tag `v1.1.0`)

**Adicionado**
- Módulo `src/locale.ts`:
  - `resolveLocale()`: sugere país e idioma pela ordem de prioridade; o país vem de um perfil existente (30 países), o idioma do `Accept-Language` quando é oficial no país, senão o idioma principal do país; avisos explícitos (estimativa por IP, VPN, vários idiomas oficiais, país sem perfil).
  - `publicIp()`: ignora endereços privados, de loopback, link-local, multicast e inválidos; desembrulha IPv4 mapeado em IPv6.
  - `parseAcceptLanguage()`: interpreta o cabeçalho com pesos `q`.
  - `openGeoDatabase()`: lê uma base MaxMind-format (`.mmdb`) **localmente** através do pacote opcional `maxmind` (`optionalDependencies`). O IP nunca sai da máquina e nunca é gravado.
- Rota `POST /v1/resolve-locale` (exige chave de API) e `GET /health` passou a indicar `geoip: true|false`.
- Ferramenta MCP `resolve_locale` (agora **13** ferramentas).
- Opção `--geoip-db FICHEIRO.mmdb` (comandos `http` e `serve`) e variável `RGPD_GEOIP_DB`.
- Comando `geoip-download [--out FICHEIRO]` (`src/geodb.ts`): descarrega a base gratuita **DB-IP Country Lite** do mês (ou do mês anterior), valida que é um MMDB legível e mostra o aviso de atribuição (licença Creative Commons Attribution). Só corre quando executado.
- Esquema `LocaleSchema` em `src/schemas.ts`.
- Agente `rgpd-integrador`: passo opcional e regra sobre o IP como dado pessoal.
- Seletor de país/idioma no modal — **retirado na iteração final** (ver acima).

**Alterado**
- Teste do snippet Rust (`tests/integration.test.mjs`): se o Windows bloquear a execução do binário recém-compilado, o teste exige que o código **compile** e é reportado como **saltado** (nunca como passado).
- Versão `1.1.0` (nesta iteração).

**Publicação:** commits `ba07734` e `3d709ae`, tag e Release `v1.1.0`. A Release v1.1.0 ainda descreve o seletor, removido na iteração final.

## Documentação alterada hoje

| Ficheiro | O que mudou |
|---|---|
| `README.md` | Versão 1.1.0; 13 ferramentas; linha “País e idioma por IP (opcional)”; `geoip-download`; índice com este registo |
| `docs/INTEGRACAO.md` | Nova secção “País e idioma por IP (opcional)”: chamada única com `autoLocale`, tabela de prioridade, ativação da base GeoIP, regras de privacidade, uso com o agente |
| `docs/API-HTTP.md` | Rota `/v1/resolve-locale`; `autoLocale` em `/v1/consent-documents` |
| `docs/FERRAMENTAS-MCP.md` | Ferramenta `resolve_locale` |
| `docs/INSTALACAO.md` | Comando `geoip-download`, opção `--geoip-db`, variável `RGPD_GEOIP_DB` |
| `docs/VISAO-GERAL.md` | 13 ferramentas |
| `docs/LIMITACOES.md` | Limites do recurso de IP |
| `docs/ALTERACOES.md` | Este ficheiro |

## Testes
- Antes: 41 testes. Agora: **52** (51 passam, 1 saltado).
- Novos (`tests/locale.test.mjs`): validação de IP, `Accept-Language`, país por IP, prioridade e país de reserva, país sem perfil (nunca adivinha), IP privado ou sem base, países com vários idiomas, rota HTTP (chave obrigatória, IP não devolvido), leitura de `.mmdb` real, `autoLocale` de ponta a ponta (sem IP no documento, `language` explícito, 422 sem país), e verificação de que o modal não tem seletor.
- O teste do `.mmdb` real só corre com `RGPD_TEST_MMDB` apontando para uma base (usada a base de teste da MaxMind).
- Saltado: snippet Rust, porque este Windows bloqueia a execução do binário novo (o código compila).

## Verificação manual
- `geoip-download` executado de verdade: base `2026-11`, consulta de teste `8.8.8.8 → US`.
- Modal aberto no navegador com um IP sueco: abriu em sueco, com a lei da Suécia e **sem nenhum seletor**.
- Ferramenta `resolve_locale` e `get_integration_guide` chamadas por stdio (13 ferramentas).

## Limites conhecidos desta entrega
- O país por IP é uma estimativa; a lei aplicável não depende do IP (RGPD, Art. 3). Visitantes de países sem perfil recebem a lei do país de reserva.
- As bases GeoIP gratuitas têm cobertura e precisão reduzidas; nenhuma base é distribuída com o projeto.
- Não testado com leitores de ecrã.

## Histórico anterior

| Versão / data | Resumo |
|---|---|
| 1.0.0 — 2026-11-01 | Primeira versão: MCP (12 ferramentas), API HTTP, modal, ledger, 30 países, RGPD em 24 línguas, instaladores, agente `rgpd-integrador`, documentação completa, repositório no GitHub |
| 2026-11-02 | README: estado real ampliado (ferramentas, agente, API, segurança, requisitos) e ajustes de texto |
