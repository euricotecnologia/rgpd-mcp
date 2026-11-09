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

## País e idioma por IP (opcional)

Recurso **desligado por omissão**. Serve para sugerir o país (e assim a lei nacional) e o idioma do modal quando o seu sistema atende pessoas de vários países. Se a clínica atende num país fixo, passe esse país em `build_consent_document` e ignore esta secção.

### Como funciona
O backend chama `POST /v1/resolve-locale` (chave de API) com o que sabe do pedido e usa `country` e `language` da resposta em `POST /v1/consent-documents`. A ordem de prioridade é fixa:

| # | Sinal | Campo do pedido | Observação |
|---|---|---|---|
| 1 | País onde a clínica está estabelecida | `establishmentCountry` | Atendimento presencial segue o país da clínica, não o IP |
| 2 | Escolha explícita da pessoa | `userChoice.country`, `userChoice.language` | Para corrigir um palpite errado |
| 3 | IP (base GeoIP local) | `ip` | Estimativa: VPN, proxy e redes móveis enganam |
| 4 | Região do `Accept-Language` (ex.: `pt-PT` → PT) | `acceptLanguage` | Só quando o IP não deu resultado |

O **idioma** vem da escolha da pessoa, depois do `Accept-Language` (se for um idioma oficial do país) e por fim do primeiro idioma oficial do país. Países com vários idiomas (por exemplo BE, LU, FI, IE, MT) devolvem `languageOptions` e um aviso: mostre um seletor.

```json
POST /v1/resolve-locale
{ "ip": "<IP validado pelo seu proxy>", "acceptLanguage": "es-ES,es;q=0.9", "establishmentCountry": null }
→ { "country": "ES", "language": "es", "countrySource": "ip", "languageSource": "accept-language",
    "supported": true, "needsUserChoice": false, "languageOptions": ["es"], "warnings": ["…estimativa…"], "geoip": "mmdb" }
```

Se o país detetado **não tem perfil** neste projeto (Reino Unido, Suíça, resto do mundo), a resposta traz `country: null` e `needsUserChoice: true`: o sistema nunca aplica a lei de outro país em silêncio.

### Ativar a deteção por IP
1. Obtenha uma base `.mmdb` de país ou cidade. A forma mais simples: `node dist/cli.js geoip-download` descarrega a **DB-IP Country Lite** (gratuita, atualizada todos os meses, licença Creative Commons Attribution: é preciso creditar a DB-IP; confira as condições em db-ip.com). Também serve a MaxMind GeoLite2 (exige conta e aceitação da licença deles). As bases gratuitas têm cobertura e precisão reduzidas.
2. Inicie com `node dist/cli.js http --geoip-db /caminho/GeoLite2-Country.mmdb` (ou `RGPD_GEOIP_DB`). O pacote opcional `maxmind` é instalado com `npm install`; sem ele ou sem base, o endpoint continua a funcionar com os outros sinais e avisa.
3. A consulta é **local**: o IP não sai da máquina.

### Seletor de país e idioma no modal
Adicione `locale-picker` ao `<rgpd-consent-modal>` (ou `#localePicker=1` na URL do modal). O seletor mostra os 30 países e os idiomas oficiais do país escolhido. Quando a pessoa muda:

1. o modal emite `rgpd:localechange {country, language}` (e o `postMessage`/ponte equivalente);
2. o seu backend chama `POST /v1/resolve-locale` com `userChoice` (ou diretamente `POST /v1/consent-documents` com `country` e `language`) e obtém um documento novo;
3. a aplicação recarrega o modal com o novo documento.

O modal **não** muda sozinho de país: cada documento tem um hash próprio e só o backend o cria. O seletor usa nomes de países no idioma oficial de cada um e rótulos de acessibilidade multilingues fixos (não passam pelos 25 idiomas de rótulos).

### Regras de privacidade
- O IP é **dado pessoal** (considerando 30 do RGPD e jurisprudência do TJUE): informe-o no aviso de privacidade e não o grave. O servidor processa-o em memória, não o regista e não o devolve na resposta.
- Atrás de um proxy ou balanceador, use o IP validado pela sua infraestrutura. **Nunca** confie num `X-Forwarded-For` enviado diretamente pelo cliente: o servidor não lê cabeçalhos de IP, recebe-o só no corpo.
- Endereços privados, de loopback ou inválidos são ignorados com aviso.
- Dê sempre à pessoa uma forma de mudar o país e o idioma.

### Com o agente
Peça: `@agent-rgpd-integrador … com deteção automática do país e idioma por IP`. Sem esse pedido o agente usa o país fixo da clínica.

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
