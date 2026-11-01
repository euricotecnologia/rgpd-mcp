# Método de verificação jurídica

Princípio: **nenhum facto jurídico é apresentado como autoritativo sem evidência guardada.**

## Estados de um facto

| Estado | Significado | Como o sistema o trata |
|---|---|---|
| `verified` | Valor lido em texto oficial/primário descarregado; guardamos URL, data, SHA-256 do ficheiro e o excerto verbatim | Apresentado como autoritativo |
| `inferred` | Resulta da *ausência* de derrogação no texto lido (ex.: DE e NL não baixam os 16 anos do Art. 8) | Mostrado com a etiqueta `inferred`; exige revisão jurídica |
| `unverified` | Pista de fonte secundária ou não investigado | Nunca autoritativo; o documento inclui aviso e usa o teto de 16 anos do RGPD |

Estado do país (`verified` / `partial` / `unverified`) calculado em `src/coverage.ts`. `verified` exige autoridade,
todas as leis listadas e a idade do Art. 8 verificadas.

## Fontes

* **RGPD**: Serviço de Publicações da UE (Cellar), rendição XHTML do ato publicado no JO (CELEX 32016R0679, JO L 119, 4.5.2016),
  uma por língua. `tools/extract_gdpr.py` converte em JSON e falha se não houver 99 artigos, 173 considerandos e 11 capítulos
  com título e corpo. O texto consolidado do EUR-Lex não tem valor jurídico; o publicado no JO é o autêntico.
* **Autoridades de controlo**: lista de membros do EDPB, verificada por script (o nome tem de existir no ficheiro guardado).
* **Leis nacionais**: portais oficiais (BOE, Normattiva, Riksdagen, zakonyprolidi.cz, wetten.overheid.nl, gesetze-im-internet.de,
  irishstatutebook.ie, RIS/OGD da Áustria, lovdata.no, narodne-novine.nn.hr, api.sejm.gov.pl, net.jogtar.hu, cylaw.org, Finlex, Retsinformation) e, para Portugal, a compilação PGDL (não oficial; a publicação oficial é o Diário da República).

## Reproduzir / estender

```bash
# 1. descarregar o texto oficial para tools/source/national/<CC>.html
# 2. acrescentar ao tools/build_countries.py a lei (law(...)), a idade (AGE[...]) e disposições de saúde (HEALTH[...]) com a regex da evidência
python -X utf8 -I tools/build_countries.py     # FALHA se a evidência não for encontrada
python -X utf8 -I tools/extract_gdpr.py
npm test
```

## Decisões de desenho com base no texto do RGPD

* **Cuidados de saúde ≠ consentimento.** O fundamento para prestar cuidados é o Art. 9(2)(h) (+ Art. 9(3), sigilo
  profissional); o consentimento não deve ser condição para o serviço (Art. 7(4), considerando 43). Por isso o primeiro
  atendimento mostra um **aviso informativo** (Art. 13) com um *acknowledge* obrigatório, e só tratamentos adicionais
  (marketing, investigação, partilha) aparecem como consentimentos **separados e facultativos**.
* Caixas desmarcadas por defeito: considerando 32 (texto oficial PT: “O silêncio, as opções pré-validadas ou a omissão não deverão, por conseguinte, constituir um consentimento.”).
* Retirada tão fácil como a concessão: Art. 7(3) (`/v1/consents/withdraw`).
* Dados de categorias especiais sem condição do Art. 9(2) são **rejeitados** pelo construtor.
* O texto jurídico mostrado ao titular é sempre citação oficial na língua do país; as traduções só rotulam a interface.

## Pendências (para atingir cobertura total)

1. Verificar lei e idade do Art. 8 dos 8 países parciais (DE, HU, LI, LU, MT, NL, PL, RO), a idade de MT (legislação subsidiária) e as disposições de saúde de quase todos os países (vários portais oficiais bloqueiam
   robôs ou exigem JavaScript: usar PDF do jornal oficial/ELI ou descarga manual para `tools/source/national/`).
2. Legislação setorial de saúde: feita em 26 países (ver abaixo); faltam 4 (BE, IE, MT, RO), as leis regionais e os códigos deontológicos.
3. Textos EEE em norueguês/islandês; UK GDPR/DPA 2018 e nLPD suíça (regimes próprios).
4. Revisão nativa das traduções de rótulos e extensão às restantes línguas da UE.
5. Revisão por jurista/EPD antes de uso clínico.

## Notas da segunda rodada

* França: o texto lido é a versão integral publicada pela CNIL (o Légifrance bloqueia acesso automático).
* Dinamarca: o ficheiro lido é a versão de 2018-05-23, marcada "Historic" no Retsinformation; confirmar alterações na lovbekendtgørelse em vigor.
* Roménia e Malta: lidos a partir de PDF convertido com `pdftotext`; o hash guardado é o do texto extraído.
* PL, HU, RO, DE, NL: `inferred` = o texto integral lido não contém regra de idade (guarda por regex no build). Pode existir regra noutra lei do país.
* Áustria: número do DSG confirmado na própria API do RIS (a primeira tentativa devolveu o DSG de 1978; foi descartada).
* Bulgária e Liechtenstein: BG lido na página da autoridade (КЗЛД, versão consolidada); LI no PDF oficial do LGBl. (hash do texto extraído).
* Tentados sem sucesso nesta ronda (bloqueio, erro TLS ou apenas casca JavaScript): BE (Moniteur belge), EE (Riigi Teataja), GR (dpa.gr recusa a ligação), IS, LT, LU (Legilux), LV (likumi.lv), SI (pisrs/ip-rs.si 403), SK (Slov-Lex).
* Saúde (Art. 9(4)) verificada só em: ES (DA 17.ª), PT (art. 29.º), DE (§ 22 BDSG), NL (art. 30 UAVG), IE (s. 52 DPA 2018), FR (secção 3 da loi 78-17, arts. 64 e seg.). Procuradas sem resultado útil em BG, CZ, FI, HR, IT, NO, SE e AT (menções só marginais, ex. seguros); DK e CY têm referências a saúde mas não foram qualificadas.

## Quarta ronda: leitura no navegador

* EE, SK, LU, BE e SI foram lidos no navegador embutido (páginas renderizadas dos portais oficiais ou da autoridade). Os ficheiros `EE.txt`, `SK.txt`, `BE.txt`, `SI.txt`, `LU.txt` são **extratos** (cabeçalho + artigo da idade), não o texto integral: o hash cobre o extrato.
* LU: a ausência de regra de idade foi verificada no navegador sobre o texto integral (arts. 1 a 77) e registada no extrato; **o build não a reproduz**.
* Bloqueios restantes: IS (althingi.is) e LT (e-seimas.lrs.lt) usam desafio anti-robô do Cloudflare (não contornado); LV (likumi.lv) e GR (dpa.gr) exigem autorização do utilizador no painel do navegador.
* Um identificador do PISRS (Eslovénia) usado de memória estava errado (apontava para a lei de branqueamento); foi descartado e o texto veio da página da autoridade.

## Quinta ronda: Chrome real

* IS (althingi.is, edição consolidada de 1.10.2026, art. 10: 13 anos) e LT (e-TAR, redação consolidada de 2026-06-30, art. 6: 14 anos) foram lidos no Chrome do utilizador; os ficheiros `IS.txt` e `LT.txt` são extratos.
* GR (dpa.gr) e LV (likumi.lv) recusam a ligação a partir desta máquina, inclusive pelo leitor remoto (`ECONNREFUSED`/`socket hang up`): provavelmente bloqueio do próprio servidor. LV mantém a pista de 13 anos (orientação da autoridade DVI) e GR a de 15, ambas `unverified`.
* O e-Seimas (LT) fica atrás de um desafio anti-robô do Cloudflare que não foi contornado; o texto veio do e-TAR.
* PT passou a ancorar-se no PDF oficial do Diário da República (art. 16.º e corpo do art. 29.º).

## Sexta ronda: Grécia e Letónia

* **GR**: o dpa.gr não responde (nem ao utilizador). O texto integral da Lei 4624/2019 foi lido no ELINYAE (organismo público grego): art. 21 (15 anos) e art. 22 (categorias especiais, incl. medicina preventiva e cuidados). A página não diz se já incorpora a codificação da Lei 5221/2025: confirmar no ΦΕΚ.
* **LV**: o likumi.lv não responde. O texto foi lido na publicação oficial de 2018 no Latvijas Vēstnesis (art. 33: 13 anos). É o texto original: não reflete alterações posteriores.
* Nenhum país está agora sem verificação; ficam 8 parciais.

## Sétima ronda: legislação setorial de saúde

Modelo: `sectorHealth` no perfil do país, com a lei (título, número, fonte) e, por disposição, artigo, tema e excerto verbatim com hash. Aparece no modal ("Enquadramento legal") quando há dados de saúde.

| País | Leis lidas | Disposições |
|---|---|---|
| PT | Lei 12/2005 (informação de saúde); Lei 15/2014 (direitos do utente) | art. 3.º propriedade da informação; art. 3.º consentimento ou recusa; art. 6.º sigilo |
| ES | Ley 41/2002 (autonomia do paciente, historia clínica) | arts. 7.1, 8.1, 14.1, 17.1 |
| FR | Code de la santé publique | L1110-4 (sigilo), L1111-7 (acesso), L1111-8 (HDS) |
| DE | BGB §§ 630d, 630f, 630g; StGB § 203 | consentimento, Behandlungsakte, consulta, sigilo |
| SE | Patientlag (2014:821); Patientdatalag (2008:355) | 4 kap. 2 §; 3 kap. 1 §; Inre sekretess 1 § |
| CZ | Zákon 372/2011 Sb. | § 28 odst. 1; § 51 odst. 1 |
| FI | Laki potilaan asemasta ja oikeuksista 785/1992 | 5 §, 6 §, 13 § |
| NL | BW Boek 7 (WGBO) | 7:448, 7:450, 7:454, 7:457 |
| AT | Ärztegesetz 1998 | § 51, § 54 |

Limites: lidos só os primeiros números dos artigos citados, não as exceções; PT usa o texto original publicado no DR (as leis foram alteradas depois); CZ vem do portal Zákony pro lidi (não oficial); AT § 54 é a última versão listada no RIS (2019). Não verificados: BE, IT (só índice da L. 219/2017), DK, PL (resposta vazia), HU (404), IE e os restantes.

### Oitava ronda (DK, PL, HU, IS)

| País | Leis lidas | Disposições |
|---|---|---|
| DK | Sundhedsloven (LBK 275/2025) | § 15 (informeret samtykke), § 41 (videregivelse kun med samtykke) |
| PL | Ustawa o prawach pacjenta (Dz.U. 2009 nr 52 poz. 417) | art. 9, 13 (sigilo), 16 (consentimento), 24 (documentação médica) |
| HU | Eütv. (1997. évi CLIV.) | §§ 13, 24, 25 (informação, documentação, sigilo médico) |
| IS | Lög um réttindi sjúklinga (74/1997) | arts. 5 e 13 |

Limites: DK está marcada "Historic" no Retsinformation (há versão posterior); PL vem do ELI (pode não ser o texto jednolity de 2024); BE: o PDF do SPF Saúde não conectou e o número de ELI que tentei estava errado; IT: só o índice da Lei 219/2017 carregou.

### Nona ronda (LV, SI, HR, NO)
LV: Pacientu tiesību likums art. 6 e Ārstniecības likums art. 50; SI: ZPacP 26. e 41. člen (texto original de 2008, alterado depois); HR: Zakon o zaštiti prava pacijenata art. 6 e 25 (texto de 2004, alterado depois); NO: pasient- og brukerrettighetsloven §§ 4-1 e 5-1 e helsepersonelloven § 21 (Lovdata, em vigor). Pendentes: BE, BG, CY, EE, GR, IE, IT, LI, LT, LU, MT, RO, SK (Eslováquia e Luxemburgo via Chrome; Lituânia via e-TAR).

### Décima ronda (GR, SK, LU, LT, EE, IT)
GR: Ν. 3418/2005 (Código de Deontologia Médica) arts. 11, 12, 13, via ELINYAE; SK: Lei 576/2004 §§ 6 e 18 (Slov-Lex, em vigor desde 01.08.2026); LU: Lei de 24.7.2014 arts. 15 e 18 (texto do Journal officiel; versão consolidada não lida); LT: Lei I-1562 arts. 7, 8, 14 (e-TAR, suvestinė desde 2025-07-01); EE: VÕS §§ 766 e 769 (redação de 01.09.2026 a 31.12.2026); IT: Lei 219/2017 art. 1 c. 1 (só o consentimento).
Pendentes: BE (PDF do SPF Saúde não conecta e o ELI tentado estava errado), BG, CY, RO (legislatie.just.ro e cdep.ro inacessíveis), IE (sem lei única de direitos do paciente), LI, MT.

### Décima primeira ronda (CY, BG, LI)
CY: Lei 1(I)/2005 arts. 11 (consentimento) e 15 (confidencialidade); BG: Закон за здравето чл. 86, 87, 28б, 28в (PDF do Ministério, 14.10.2024); LI: GesG arts. 10 e 12.
Pendentes: BE (PDF do SPF Saúde não conecta), RO (portais inacessíveis), IE (sem lei única), MT (a Cap. 464 trata de profissões; consentimento e segredo estão em outras normas, não lidas).

### Fecho de PT, ES e FR (12.ª ronda)
* **PT**: leis 12/2005 e 15/2014 passaram a ancorar-se nas **versões consolidadas** do Diário da República (alterações listadas até a Lei 26/2016 e a Lei 57/2026, respetivamente); os arts. 3.º e 6.º coincidem com o original. Lei 12/2005 art. 3.º n.º 2 acrescentado.
* **ES**: acrescentado o art. 18.1 da Ley 41/2002 (acceso a la historia clínica).
* **FR**: **não concluído**. L1111-2, L1111-4 e a secção 3 da Loi 78-17 ficam por ler: o Légifrance passou a pedir verificação anti-robô em todas as páginas (não contornada). A Loi 78-17 continua lida na versão da CNIL.
* Ainda por fazer em PT: Deliberação 2019/494 da CNPD (fonte secundária) e artigos seguintes de cada lei.
