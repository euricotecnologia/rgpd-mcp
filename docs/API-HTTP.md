# API HTTP, modal e widget

Servidor: `node dist/cli.js http [--port 7433] [--host 127.0.0.1] [--api-key KEY] [--cors o1,o2] [--frame-ancestors o1,o2]`.

## Autenticação
- **Chave de API** (`Authorization: Bearer <chave>`): obrigatória nas rotas marcadas “chave” quando o servidor foi iniciado com chave.
- **Token de captura** (`X-Capture-Token`): token HMAC de curta duração, **preso a um `documentId` e a um `subjectRef`**. Permite que o navegador registe a decisão ou retire consentimentos **sem conhecer a chave de API**. É emitido pelo backend.
- Sem chave configurada, o servidor só aceita escutar em loopback.

## Rotas

| Rota | Auth | Descrição |
|---|---|---|
| `GET /health` | pública | Estado, nº de países e de idiomas |
| `GET /widget/rgpd-consent.js`, `GET /widget/modal-page.js` | pública | Web Component e bootstrap das páginas |
| `GET /modal/:id` | pública | Página do modal (CSP restritiva; `frame-ancestors` configurável) |
| `GET /manage/:id` | pública | Tela “Gerir os meus consentimentos” (retirada com um clique) |
| `GET /v1/consent-documents/:id` | pública (UUID) | Texto do documento (não contém dados de titulares) |
| `POST /v1/resolve-locale` | chave | **Opcional.** Sugere país e idioma: corpo `{ip?, acceptLanguage?, establishmentCountry?, userChoice?{country,language}}` → `{country, language, countrySource, languageSource, ipCountry, supported, needsUserChoice, languageOptions, warnings, geoip}`. O IP é processado em memória e nunca é gravado, registado nem devolvido. Ver [INTEGRACAO.md](INTEGRACAO.md#país-e-idioma-por-ip-opcional) |
| `POST /v1/consent-documents` | chave | Constrói, valida e guarda o documento. Corpo = entrada do construtor + `capture?: {subjectRef, ttlSeconds?}`. Devolve o documento, `modalUrl` e, se houve `capture`, `captureToken` |
| `POST /v1/consent-documents/:id/capture` | chave | Novo token para um documento existente (`{subjectRef, ttlSeconds?}`) → `captureToken`, `manageUrl` |
| `POST /v1/consents` | chave **ou** token | Regista decisões `{documentId, subjectRef, decisions:[{itemId, granted}], guardian?, channel?}` |
| `POST /v1/consents/withdraw` | chave **ou** token | Retira consentimentos `{documentId, subjectRef, itemIds?, channel?}` (sem `itemIds` retira todos) |
| `GET /v1/consents/status?subjectRef=&documentId=` | chave **ou** token | Itens de consentimento do documento e estado atual |
| `GET /v1/consents?subjectRef=` | chave | Estado efetivo e todos os registos do titular |
| `GET /v1/ledger/verify` | chave | Integridade da cadeia de hash |
| `GET /v1/meta` | chave | Idiomas do RGPD, locales, cobertura |
| `GET /v1/countries`, `GET /v1/countries/:cc` | chave | Lista e perfil de país |
| `GET /v1/gdpr/:lang/articles/:n`, `GET /v1/gdpr/:lang/search?q=&limit=` | chave | Texto oficial e pesquisa |

### Códigos de resposta
`201` criado · `400` pedido inválido (JSON mal formado, campos) · `401` não autorizado · `404` documento/país não encontrado · `413` corpo > 256 KB · `422` desenho ilegal (corpo com `issues`) ou regra do ledger violada · `500` erro interno.

### Regras do ledger (`POST /v1/consents`)
- O documento tem de ter sido construído por este servidor.
- `subjectRef`: pseudónimo, ≤ 128 caracteres, **sem `@` nem espaços**.
- Itens obrigatórios têm de vir aceites (`REQUIRED_MISSING`); item desconhecido ou repetido é rejeitado.
- O que **não foi respondido fica gravado como recusado**: ausência de consentimento nunca é consentimento.
- Se o documento exige responsável legal (`guardian.required`) e há consentimento concedido, é preciso `guardian: {name, relationship, confirmed: true}` (`GUARDIAN_REQUIRED`).
- O aviso informativo (`notice_ack`) **não** é retirável (`UNKNOWN_ITEM` em `withdraw`).
- Cada registo: `recordId`, `seq`, `prevHash`, `hash` (SHA-256 de `prevHash` + conteúdo), `createdAt`, `type` (`decision`/`withdrawal`), `documentId`, `documentHash`, `country`, `language`, `subjectRef`, `decisions[]`, `guardian?`, `channel?`.

## Fluxo recomendado
1. **Backend** → `POST /v1/consent-documents` (com `capture.subjectRef`) → `modalUrl` + `captureToken`.
2. **Frontend** mostra `{base}{modalUrl}#subjectRef=…&token=…&parentOrigin=<origem da app>` em iframe/WebView (os parâmetros vão no *fragment* para não chegarem a logs).
3. O modal envia `postMessage` `decision` / `cancel` / `error`.
4. **Backend** → `GET /v1/consents?subjectRef=…` e libera o atendimento **só se `notice_ack` estiver `granted` para o documento desta visita**.
5. Retirada: backend → `POST /v1/consent-documents/:id/capture`; frontend mostra `manageUrl`.

## Widget `<rgpd-consent-modal>`
```html
<script src="http://127.0.0.1:7433/widget/rgpd-consent.js"></script>
<rgpd-consent-modal api-base="http://127.0.0.1:7433" document-id="…" capture-token="…" subject-ref="p-8f3a21" open></rgpd-consent-modal>
```

| Atributo | Função |
|---|---|
| `api-base` | URL da API |
| `document-id` | id devolvido pela construção |
| `subject-ref` | id pseudónimo (nunca nome/e-mail) |
| `capture-token` | token de captura (alternativa a `api-key`) |
| `api-key` | chave de API (só para backends/ambientes de confiança) |
| `channel` | rótulo livre do canal de registo |
| `parent-origin` | origem exata que recebe `window.parent.postMessage` (modo iframe); sem ele não há `postMessage` |
| `mode="manage"` | tela de retirada em vez do consentimento |
| `open` | abre ao carregar |

**Eventos** (propagam-se, `composed`): `rgpd:ready`, `rgpd:decision {record}`, `rgpd:cancel`, `rgpd:error {message}`, `rgpd:withdrawn {itemIds}`, `rgpd:closed`.

**Pontes para hosts sem DOM de página** (JSON em string): `window.rgpdConsentBridge.onDecision/onCancel/onError/onWithdrawn`, WebView2 `window.chrome.webview.postMessage`, WKWebView `window.webkit.messageHandlers.rgpd.postMessage`, ou `postMessage` com `parent-origin`.

**Comportamento da interface:** `<dialog>` modal nativo (foco preso, fundo inerte); secções recolhíveis com o texto oficial de cada artigo e link da fonte; itens **desmarcados por defeito**; “Confirmar” só avança com o item obrigatório marcado; “Cancelar”/ESC fecham **sem gravar nada**; responsável legal pedido quando exigido; etiqueta `inferred`/`unverified` nas fontes não verificadas; avisos quando os dados do país não estão totalmente verificados. Todo o conteúdo entra por `textContent` (sem `innerHTML`).

## Segurança
- Loopback por omissão; recusa outro endereço sem chave de API.
- Corpo ≤ 256 KB; CORS por lista (`--cors`); `frame-ancestors` por lista.
- Páginas `/modal` e `/manage` com CSP: `default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors …; base-uri 'none'; form-action 'none'`.
- Tokens HMAC com expiração, presos a documento + titular; segredo em `capture.secret` (0600).
- Comparação de chaves em tempo constante.
- A chave de API **nunca** deve chegar ao navegador nem ao repositório.
