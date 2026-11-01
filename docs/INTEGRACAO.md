# Integração no seu sistema

## Dois caminhos

| Caminho | Quando usar |
|---|---|
| **Pedir ao Claude Code** (agente `rgpd-integrador`) | Quer que o código seja escrito no seu projeto |
| **Chamar a API HTTP** diretamente | Quer integrar à mão, em qualquer linguagem |

O MCP é a “caixa de ferramentas” do agente; o **seu sistema não chama o MCP**, chama a **API HTTP** (mesmo programa).

## 1. Com o agente (recomendado)
1. `node dist/cli.js install claude-code` e `node dist/cli.js install-agent`.
2. Abra o Claude Code **na pasta do seu sistema**, numa **sessão nova**, e peça:

> `@agent-rgpd-integrador crie o consentimento RGPD ao iniciar o atendimento do paciente. Clínica: <nome>, país: PT.`

Alternativas: frase solta (“Use o MCP rgpd e crie o consentimento no atendimento…”; o Claude Code decide se delega; não testado sem citar o agente), `/mcp__rgpd__integrar_no_sistema`, ou `claude --agent rgpd-integrador`.

### O que o agente faz
1. **Explora** o projeto (linguagem, rota que inicia o atendimento, frontend, configuração, testes).
2. **Obtém a receita** (`get_integration_guide`, `get_reference`, `get_country_law`) e anota factos não verificados.
3. **Valida o desenho** com `build_consent_document`.
4. **Implementa**: endpoint que cria o documento (chave só no backend); endpoint que lê o ledger; **bloqueio no servidor** na rota que inicia o atendimento; modal no frontend; mensagem + **saída alternativa** quando o paciente não confirma; **tela de retirada**; configuração (`RGPD_BASE_URL`, `RGPD_MCP_API_KEY`) e `.env.example`.
5. **Testa** (sobe o servidor, escreve e corre os 5 casos: aceita → inicia; recusa só o opcional → inicia; cancela → mensagem + saída e 403 em chamada direta; segunda visita → novo aceite; token de outro paciente → 401).
6. **Relata**: ficheiros alterados, como subir, o que foi e **não** foi testado, factos não verificados e marcadores `<PREENCHER: …>`.

Limites: não pode fazer perguntas durante a execução (usa marcadores); a qualidade depende da clareza do código; não vê a interface; **não substitui revisão jurídica**.

## 2. Manualmente (HTTP)
Contrato igual em todas as linguagens:
1. `POST /v1/consent-documents` (backend, chave de API) → `documentId`, `modalUrl`, `captureToken`.
2. Mostrar `{base}{modalUrl}#subjectRef=…&token=…&parentOrigin=…` (iframe/WebView) ou `<rgpd-consent-modal>`.
3. `GET /v1/consents?subjectRef=…` (backend) → **fonte de verdade**; libere o atendimento só se `notice_ack` estiver `granted` **para o documento desta visita**.
4. Retirada: `POST /v1/consent-documents/:id/capture` → mostrar `manageUrl`.

### Pedido-modelo da primeira consulta (saúde)
```json
{
  "country": "PT",
  "controller": { "name": "<CLÍNICA>", "address": "<MORADA>", "email": "<E-MAIL PRIVACIDADE>", "dpo": { "name": "<DPO>", "email": "<E-MAIL DPO>" } },
  "dataCategories": ["identification", "contact", "health"],
  "purposes": [
    { "id": "care", "label": "<prestação de cuidados>", "legalBasis": "contract", "art9Condition": "health_care", "required": true, "dataCategories": ["identification","contact","health"] },
    { "id": "newsletter", "label": "<comunicações facultativas>", "legalBasis": "consent", "required": false, "dataCategories": ["contact"] }
  ],
  "capture": { "subjectRef": "<id-pseudónimo-do-paciente>", "ttlSeconds": 900 }
}
```

### Snippets por linguagem
`get_integration_snippet` (ou `src/snippets.ts`) gera código para `html`, `react`, `node`, `go`, `java`, `rust`, `delphi`, `python`, `csharp`, `php`.

| Linguagem | Estado nos testes |
|---|---|
| Python, Node, Go, Java, Rust | compilados/executados contra o servidor real |
| React | exemplo completo em `examples/clinic-react` (build e tipos OK; modal testado em Chrome) |
| HTML/JS | widget exercitado em Chrome real |
| **Delphi, C#, PHP** | **não compilados** (sem as toolchains): tratar como rascunho |

## 3. Exemplos incluídos
- `examples/clinic/` — clínica simulada em Node (zero dependências): fila de pacientes, “Chamar paciente”, modal em iframe, atendimento, saída alternativa e 403 sem consentimento. Coberta por `tests/clinic.test.mjs`.
- `examples/clinic-react/` — React 18 + TypeScript (Vite) + backend mínimo. Copiar `useConsentGate.ts`, `ConsentModalFrame.tsx` e as 3 rotas do `server.mjs`. Ver o README da pasta.

## Regras que qualquer integração deve cumprir
- `subjectRef` é pseudónimo (id interno); **nunca** nome, e-mail, telefone ou NIF.
- A chave de API fica **só no backend**; o navegador recebe apenas o token de captura.
- O evento do navegador só dispara a verificação; **o backend decide**.
- Consentimentos facultativos **nunca** bloqueiam o atendimento. Só o aviso informativo o condiciona, e isso é decisão da clínica, não exigência do RGPD.
- Cada visita cria um documento novo e exige novo aceite.
- Não registar consentimento em nome do paciente; não pré-marcar caixas; não confirmar automaticamente.
- Se o paciente cancela, **nada é gravado no ledger** (escolha de desenho). Se a clínica precisa de prova da recusa, deve registá-la do seu lado.
- Menores: o Art. 8 aplica-se a **serviços da sociedade da informação** oferecidos diretamente a crianças. Em atendimento presencial, a capacidade segue o direito nacional de saúde/civil; o documento avisa mas não decide.
