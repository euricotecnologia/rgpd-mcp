# Exemplo React: consentimento RGPD ao iniciar o atendimento

React 18 + TypeScript (Vite) no frontend; um backend Node mínimo (`server.mjs`) que guarda a chave de API do rgpd-mcp e é o único que decide se o atendimento pode começar.

## Correr

```bash
# 1) servidor do consentimento (na raiz do rgpd-mcp, depois de `npm run build`)
RGPD_MCP_API_KEY=minha-chave node dist/cli.js http --port 7433 --frame-ancestors http://127.0.0.1:7600

# 2) este exemplo
cd examples/clinic-react
npm install
npm run build            # tsc --noEmit + vite build
RGPD_MCP_API_KEY=minha-chave PORT=7600 npm start
# abrir http://127.0.0.1:7600
```

## O que copiar para o seu projeto

| Ficheiro | Papel |
|---|---|
| `src/consent/useConsentGate.ts` | Hook: `start(patientRef)` abre o modal; ao receber `decision` pergunta ao **seu backend**; só chama `onProceed` se o backend confirmar |
| `src/consent/ConsentModalFrame.tsx` | Iframe em ecrã inteiro com a página `/modal/<id>` do rgpd-mcp |
| `server.mjs` (`/api/consent/start`, `/api/consent/check`, `/api/attendance/start`) | Cria o documento, lê o ledger e **bloqueia no servidor** a rota que inicia o atendimento |

## Regras que o exemplo cumpre

* A chave de API fica só no backend; o navegador recebe um `captureToken` de curta duração (preso ao paciente e ao documento).
* O evento `postMessage` só dispara a verificação: a mensagem é aceite apenas se vier da origem do rgpd-mcp **e** do próprio iframe.
* `subjectRef` é pseudónimo (`p-001`), nunca nome nem e-mail.
* Cancelar não grava nada no ledger e mostra mensagem + saída alternativa; recusar só a newsletter **não** bloqueia o atendimento.
* Cada visita cria um documento novo, que exige novo aceite.

Em produção: HTTPS, `--frame-ancestors` com o domínio real, `APP_ORIGIN` e `RGPD_BASE` corretos, chave forte, e revisão do DPO/jurista.
