# Instalação e execução

## Requisitos
- Node.js ≥ 20
- Para regenerar dados: Python 3.9+ e `pdftotext` (poppler) — **não** são necessários para usar o MCP.

## Compilar e testar
```bash
npm install
npm run build
npm test            # 41 testes
```

## Registar o MCP no seu cliente
Use `--dry-run` para ver o que será alterado. Os ficheiros editados ganham cópia `.bak-…`. Um ficheiro que não seja JSON simples (comentários, erro de sintaxe) **não é modificado**.

```bash
node dist/cli.js install claude-code --scope user
node dist/cli.js install codex
node dist/cli.js install gemini
node dist/cli.js install antigravity
node dist/cli.js install opencode --scope project
node dist/cli.js install vscode --scope project
node dist/cli.js install generic        # imprime o JSON "mcpServers"
```

| Cliente | Onde grava | Formato | Notas |
|---|---|---|---|
| Claude Code | `claude mcp add --transport stdio rgpd …` (user/project) ou `.mcp.json` | `mcpServers` | Testado de ponta a ponta |
| Codex | `~/.codex/config.toml` ou `.codex/config.toml` | `[mcp_servers.rgpd]` | Idempotente |
| Gemini CLI | `~/.gemini/settings.json` ou `.gemini/settings.json` | `mcpServers` | Evitar `_` no nome |
| Antigravity | `~/.gemini/config/mcp_config.json` | `mcpServers` | A forma stdio `command/args` não consta da doc da Google: confirmar em *MCP Servers › Manage › View raw config* |
| OpenCode | `opencode.json` do projeto | `mcp.<nome> = {type:"local", command:[…]}` | `--scope user` recusado (caminho global não verificado) |
| VS Code | `.vscode/mcp.json` ou `code --add-mcp` | `servers.<nome> = {type:"stdio"…}` | |
| Outros (Claude Desktop, Cursor, Windsurf…) | — | `install generic` imprime o snippet | Caminhos de ficheiro não verificados |

Opções: `--scope user|project`, `--name <nome>` (padrão `rgpd`), `--dry-run`, `--npx` (usa `npx -y rgpd-mcp serve` em vez do caminho local). Fontes dos formatos: [CLIENTS.md](CLIENTS.md).

> Só o **Claude Code** foi instalado de verdade; os demais foram testados em pastas temporárias. Se o caminho do projeto mudar, o registo deixa de funcionar.

## Instalar o agente `rgpd-integrador` (Claude Code)
```bash
node dist/cli.js install-agent --scope user      # ~/.claude/agents/rgpd-integrador.md
node dist/cli.js install-agent --scope project   # ./.claude/agents/
node dist/cli.js install-agent --force           # substitui o ficheiro existente
```
Abra uma **sessão nova** do Claude Code para carregar o agente.

## Executar

### Servidor MCP (stdio)
```bash
node dist/cli.js serve              # só MCP
node dist/cli.js serve --http       # MCP + API/modal em 127.0.0.1:7433
```
Com vários clientes, o segundo processo deteta a porta ocupada por outro `rgpd-mcp` e reutiliza o servidor HTTP.

### API HTTP e modal (produção)
```bash
RGPD_MCP_API_KEY=<chave-forte> node dist/cli.js http --port 7433 --frame-ancestors https://seu-sistema.com
```
Escuta em loopback por omissão; **recusa arrancar em outro endereço sem chave de API**. Em produção ponha HTTPS num proxy reverso. Não há instalador de serviço (Serviço do Windows/systemd): configure à parte.

## Comandos da CLI

| Comando | Descrição |
|---|---|
| `serve [--http] [--port N]` | Servidor MCP em stdio; `--http` expõe também a API/modal |
| `http [--port 7433] [--host 127.0.0.1] [--api-key KEY] [--cors o1,o2] [--frame-ancestors o1,o2] [--geoip-db FICHEIRO.mmdb]` | API HTTP + modal |
| `install <cliente> [--scope] [--name] [--dry-run] [--npx]` | Regista o MCP num cliente |
| `install-agent [--scope] [--force]` | Instala o agente `rgpd-integrador` |
| `doctor` | Verifica dados, locales e ledger |
| `coverage` | Estado de verificação por país (JSON) |
| `verify-ledger` | Recalcula a cadeia de hash do ledger (código de saída 1 se quebrada) |

## Variáveis de ambiente

| Variável | Padrão | Função |
|---|---|---|
| `RGPD_MCP_STATE_DIR` | `~/.rgpd-mcp` | Estado: `ledger.jsonl`, `documents/`, `capture.secret` |
| `RGPD_MCP_API_KEY` | — | Chave de API (Bearer) da API HTTP |
| `RGPD_MCP_PORT` | `7433` | Porta HTTP |
| `RGPD_GEOIP_DB` | — | Opcional: ficheiro `.mmdb` (GeoLite2/GeoIP2 Country ou City, DB-IP) para detetar o país pelo IP. Também aceito por `serve` |
| `RGPD_MCP_DATA` | `<repo>/data` | Pasta de dados alternativa |

## Estado persistente
`ledger.jsonl` (apenas-acrescenta, encadeado por hash), `documents/<id>.json` (texto exato mostrado, para provar o que o titular viu) e `capture.secret` (segredo HMAC dos tokens, modo 0600). É um ledger de **ficheiro para um escritor**; sistemas com várias instâncias devem espelhar os registos na sua base de dados.

## Regenerar dados e documentação
```bash
python -X utf8 -I tools/extract_gdpr.py        # RGPD → data/gdpr (a partir de tools/source/gdpr)
python -X utf8 -I tools/build_countries.py     # perfis de país; FALHA se uma evidência não for encontrada
python -X utf8 -I tools/build_i18n.py && python tools/i18n_more_a.py && python tools/i18n_more_b.py && python tools/i18n_manage.py
node tools/gen_docs.mjs                        # docs/PAISES.md
```
