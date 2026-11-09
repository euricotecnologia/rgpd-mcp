# Limitações e avisos

## Aviso legal
Este projeto **não é aconselhamento jurídico**. Antes de uso em produção — sobretudo clínico — o texto, os fluxos e a escolha dos artigos devem ser revistos por **DPO/EPD** e por **jurista do país**.

## Dados jurídicos
- **8 países parciais** (DE, HU, LI, LU, MT, NL, PL, RO): a idade do Art. 8 foi **inferida** (ausência de regra no texto lido; teto de 16 anos) ou não foi lida (MT, onde a idade está em legislação subsidiária).
- **Legislação setorial de saúde** verificada em 26 países; **faltam BE, IE, MT, RO** (portais inacessíveis ou inexistência de lei única de direitos do doente).
- **Só o início dos artigos** foi lido (parágrafo principal), não as exceções nem os números seguintes. A escolha dos artigos “principais” é um julgamento do projeto.
- **Fontes não oficiais ou antigas:** França (Loi 78-17 na versão da CNIL) e Chéquia (portal Zákony pro lidi) não vêm da publicação oficial; Eslovénia, Croácia, Letónia e Luxemburgo usam o texto original sem alterações posteriores; Bulgária vem de PDF ministerial de 2024; Dinamarca está marcada “Historic” (existe versão posterior).
- **França:** L1111-2, L1111-4 e a secção 3 da Loi 78-17 (arts. 64 e seguintes) **não foram lidos** (o Légifrance passou a exigir verificação anti-robô, não contornada). Só L1110-4, L1111-7 e L1111-8 (início) foram lidos.
- **Portugal:** a Deliberação 2019/494 da CNPD (desaplicou normas da Lei 58/2019) só consta de fonte secundária.
- **Não cobertos:** leis regionais (ex.: Alemanha, Espanha), códigos deontológicos, telemedicina, Reino Unido e Suíça, e os demais países europeus fora da UE/EEE.
- **Extratos:** para EE, SK, BE, SI, LU, IS, LT, GR(parte), e vários textos setoriais lidos no navegador, o ficheiro guardado é um **extrato** (cabeçalho + artigo), não o texto integral; o hash cobre o extrato. A ausência de regra de idade em Luxemburgo foi verificada no navegador e **não é reproduzível pelo build**.
- **Idade do Art. 8** aplica-se a serviços da sociedade da informação. Em atendimento presencial, a capacidade do menor segue o direito nacional de saúde/civil e **não é decidida** pelo sistema.

## Idiomas
- Rótulos redigidos pelo projeto em 24 idiomas além do inglês; **nenhum revisto** por falante nativo com formação jurídica (aviso `UI_UNREVIEWED`).
- Sem rótulos em irlandês. Noruega e Islândia: texto do RGPD em inglês.
- A frase de abertura mostra o país no formato “País: X” (sem declinar o nome) nos idiomas novos; nos 6 idiomas iniciais pode haver pequenas imperfeições gramaticais (ex.: “Países Baixos”).

## Técnicas
- **Ledger de ficheiro** para um escritor; várias instâncias → espelhar para uma base de dados.
- Sem instalador de serviço nem início automático.
- Snippets de **Delphi, C# e PHP não compilados**. Python, Node, Go, Java, Rust e React foram testados.
- **Clientes:** só o Claude Code foi instalado de verdade; Codex, Gemini CLI, Antigravity, OpenCode e VS Code foram testados em pastas temporárias; Claude Desktop, Cursor e Windsurf só têm o snippet genérico.
- **Acessibilidade e responsividade** não foram testadas no navegador (ESC, leitor de ecrã, telemóvel).
- **Agente `rgpd-integrador`:** testado numa sessão com `--agent` num projeto pequeno e sem build; a frase solta (sem citar o agente) e o caminho `@agent-` não foram testados. Duas execuções sobrepuseram-se nesse teste.
- **País por IP (opcional):** é uma estimativa; a lei aplicável não depende do IP (RGPD, Art. 3). Os testes automáticos usam um resolvedor simulado; a leitura de um `.mmdb` real só corre quando `RGPD_TEST_MMDB` aponta para uma base (testada com a base de teste da MaxMind). Nenhuma base GeoIP é distribuída com o projeto. O seletor de país/idioma na interface é responsabilidade da sua aplicação: o modal não o inclui.
- Quem **cancela** o modal não deixa registo no ledger (escolha de desenho).
- Os exemplos correm em `127.0.0.1`; produção exige HTTPS, `--frame-ancestors` com o domínio real e chave forte.
