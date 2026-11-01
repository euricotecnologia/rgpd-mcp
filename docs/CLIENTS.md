# Clientes MCP suportados

Formatos confirmados na documentação de cada fornecedor em 2026-11-01. `node dist/cli.js install <cliente>` aplica-os.

| Cliente | Ficheiro / comando | Formato | Fonte |
|---|---|---|---|
| Claude Code | `claude mcp add --transport stdio rgpd --scope user\|project -- <cmd> <args>`; projeto: `.mcp.json` | `mcpServers.<nome> = {command,args,env}` | https://code.claude.com/docs/en/mcp |
| Codex (OpenAI) | `~/.codex/config.toml` (projeto: `.codex/config.toml`, só projetos confiáveis) | `[mcp_servers.<nome>]` com `command`, `args` | https://learn.chatgpt.com/docs/extend/mcp?surface=cli |
| Gemini CLI | `~/.gemini/settings.json` ou `.gemini/settings.json` | `mcpServers.<nome> = {command,args,env,cwd,timeout,trust}`; evitar `_` no nome | https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md |
| Antigravity | `~/.gemini/config/mcp_config.json` (partilhado por IDE/CLI) | `mcpServers`; remoto usa `serverUrl`. **A forma stdio `command/args` segue o padrão `mcpServers` e não vem na doc da Google**: confirmar em *MCP Servers › Manage › View raw config* | https://codelabs.developers.google.com/google-workspace-mcp-antigravity |
| OpenCode | `opencode.json` do projeto (a página MCP não indica o caminho global; `--scope user` é recusado) | `mcp.<nome> = {type:"local", command:[…], enabled:true}` | https://opencode.ai/docs/mcp-servers/ |
| VS Code | `.vscode/mcp.json` (projeto) ou `code --add-mcp '{"name":…}'` (perfil) | `servers.<nome> = {type:"stdio",command,args}` | https://code.visualstudio.com/docs/agents/reference/mcp-configuration |
| Outros (Claude Desktop, Cursor, Windsurf…) | `install generic` imprime o JSON | `mcpServers` padrão; **caminhos de ficheiro não verificados** | consultar a doc de cada cliente |

O servidor fala **stdio** (`rgpd-mcp serve`). Com `serve --http` expõe também o modal/API em `127.0.0.1:7433`; vários clientes
em simultâneo partilham o mesmo servidor HTTP (o segundo processo deteta a porta ocupada e reutiliza-a).

Testado de ponta a ponta: cliente MCP real (SDK oficial) ↔ `rgpd-mcp serve` por stdio. Os instaladores foram testados em
diretórios temporários; **`claude mcp add`, `code --add-mcp` e `codex mcp add` não foram executados contra a sua configuração real**.
