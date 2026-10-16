# PRD — Correção automática de cartões-resposta (PDF → planilha de importação)

- **Produto:** SanarFlix Academy (repo `sanarflix-study-guide`)
- **Autor:** João Nader (com Claude)
- **Criado em:** 07/10/2026
- **Revisão 2 (13/10/2026):**
  - Reorganizado em **V0 (local)** e **V1 (automação)**.
  - **LLM removida por completo.**
  - Novo cartão desenhado para leitura 100% por máquina.
  - Fim do suporte ao cartão antigo.
- **Revisão 3 (13/10/2026):**
  - Referência visual aprovada pelo time.
  - Bloco de matrícula presente em todos os cartões, como reserva do QR.
  - Modelo específico para o grupo **UniAtenas**, com matrícula `NN-X-NNNNN`.
  - Pendências registradas na seção 13.
- **Revisão 4 (16/10/2026):**
  - Operação decidida com o time: **todo cartão é pessoal** (QR com o `user_id`), emitido por uma **tela do Academy**. Fim do cartão genérico.
  - **Matrícula em bolhas removida do `sfa`**; fica só no UniAtenas.
  - QR compacto (`SFA2`), com módulo ≥ 0,7 mm.
  - **Correção:** a importação atual lê **Matrícula/RA por posição**, e não email. O João vai estendê-la para aceitar o **ID do aluno** (seção 1.1 e P6).
  - Alternativa E fora do cartão, em definitivo.
- **Revisão 5 (16/10/2026):**
  - Modelos de cartão **aprovados** pelo João (Fase 0 aceita).
  - **Letra `G` removida do UniAtenas** (era erro de cadastro): a matrícula é só de dígitos, `NN-X-NNNNN`. A P4 está encerrada.
  - **Emissão dos cartões em TypeScript**, lendo os templates, **sem serviço externo** (P7 decidida). Nova **Fase E**.
  - **P8** (verificação de endpoints que usam `user_id`) detalhada, com checklist.
  - O João implementa a importação por ID (P6) em paralelo.
- **Revisão 6 (16/10/2026):**
  - **Fase 1 concluída (go):** o pipeline de leitura passa em todos os critérios nas fixtures. Ressalva: as fixtures não discriminam os limiares (ver a Fase 1 na seção 8).
  - **P6 entregue pelo João:** a importação aceita o **ID do aluno** (UUID) ou a Matrícula/RA na 1ª coluna, com cabeçalho `matricula_ra_ou_id`.
  - **P8 auditada** (`handoff/p8-auditoria-user-id.md`): há 2 falhas que precisam de correção antes de imprimir cartões reais (F1 e F2).
  - Texto do quadro CARTÃO PESSOAL: "Confira se o nome acima de ALUNO é o seu."
- **Revisão 7 (16/10/2026):**
  - **Fase E concluída (E1 + E2):** a emissão dos cartões roda no navegador, em TypeScript, a partir dos templates, sem serviço externo. Há uma nova aba **Cartões-resposta** em Admin → Simulados.
  - Os templates agora carregam a **lista de desenho** (`draw`): Python e TypeScript só a interpretam.
  - QR em TypeScript, sem dependência nova, idêntico ao do `segno` módulo a módulo.
- **Status:** aprovado para implementação da **V0**. A V1 está só em direção.
- **Executor previsto:** Claude Code com Sonnet 5.5, **uma fase por sessão**.

---

## 1. Contexto e problema
As respostas dos simulados presenciais entram no Academy pela aba **Importar respostas**, em `/admin/simulados?tab=importar`.

**Como a importação funciona hoje** (verificado em 16/10/2026 em `ImportarRespostasTab.tsx`, `importar-respostas-types.ts` e na Edge Function `admin-import-simulado-responses`):
- Lê **só a primeira aba, por posição**: coluna 1 = **Matrícula/RA**; colunas 2 a N+1 = questões 1 a N, em ordem. Exige **exatamente 1 + N colunas** (N = `total_questoes` do simulado) e pula a linha de cabeçalho.
- A Edge Function resolve a matrícula para `user_id` dentro das IES do simulado (`admin_lookup_users_by_ra_in_ies`).
- Uma resposta válida é só A–E (e `( ) / , ;` como separadores). Marcação múltipla gera aviso no dry-run.
- As versões 1 a 3 deste PRD descreviam outro formato (`email | 1..N | tempo_minutos | saidas_aba | finalizado_em`). Ele não existe mais desde 25/09/2026.

A maioria das IES aplica os cartões, escaneia e já manda a planilha. Algumas mandam só **os cartões escaneados em PDF**. Hoje a equipe transcreve esses cartões à mão, o que é lento, caro e sujeito a erro.

**Objetivo:** a partir do PDF com os cartões, gerar automaticamente a planilha de importação. Os casos em que a leitura não deu certeza saem numa aba de pendências, para revisão humana. A importação continua manual, pela tela que já existe.

**Princípio:** **nenhuma LLM.** Como nós desenhamos o cartão, tudo nele é legível por visão computacional determinística:
- **Bolhas:** lidas por OMR.
- **Identificação do aluno:** por **QR code** com o `user_id` (no UniAtenas, por **matrícula em bolhas**).
- **Dúvidas:** vão para revisão humana.

### 1.1 Operação (decidida com o time em 16/10/2026)
1. **Emissão:** uma tela dedicada do Academy (aba **Cartões-resposta**, em Admin → Simulados). O time interno da Sanar seleciona a **IES**, o **simulado** e os **alunos** que farão a prova. O sistema gera os cartões em PDF, para exportar e imprimir. Cada cartão é pessoal.
2. **Aplicação:** a IES imprime, aplica a prova, escaneia os cartões preenchidos num único PDF e devolve à Sanar.
3. **Extração:** o João roda o script **localmente** (na V1, na nuvem). O script gera a planilha com os alunos identificados pelo **ID do Academy**.
4. **Importação:** o João faz o upload na tela atual. Para isso a importação precisa **aceitar o ID do aluno**; o João implementou isso em 16/10 (P6): a 1ª coluna aceita o ID do aluno ou a Matrícula/RA, sem precisar escolher.
5. Aluno sem cartão (extravio, chegou depois) recebe um cartão pessoal emitido na hora pela mesma tela. **Não há cartão genérico.** "Respondentes que não estavam na lista" não é um problema, confirmado pelo time.

Fora do script e deste PRD (trabalho do Academy): a **tela de emissão** (P7) e a **importação por ID** (P6, já entregue).

## 2. V0 × V1

| | **V0 — agora** | **V1 — depois (só direção)** |
|---|---|---|
| Onde roda | Máquina do João (Windows), por linha de comando | N8N self-hosted da empresa (a confirmar) ou, se não der, outro host |
| Entrada | PDF recebido do Relacionamento por Slack ou Notion | Pasta do Google Drive monitorada pelo N8N |
| Saída | `.xlsx` (Respostas + Pendências) + recortes das dúvidas, numa pasta local | O mesmo `.xlsx` devolvido numa pasta do Drive, com aviso no Slack |
| Importação | Manual, pela tela atual (com ID do aluno, P6) | Manual (automatizar fica para depois) |
| Custo novo | Zero | Zero, se usar o N8N existente |
| Banco | Somente leitura | Somente leitura |

**O núcleo é o mesmo nas duas versões:** um pacote Python com linha de comando (`cartao-omr`). A V1 apenas *chama* esse núcleo de outro lugar. Tudo que for feito na V0 vale para a V1.

## 3. Fora de escopo (V0)
- **LLM**, de qualquer tipo, em qualquer etapa.
- **O cartão genérico** (sem aluno definido), a matrícula em bolhas no `sfa` e o **cartão antigo** (`cartao_de_respostas_simulado_E_ENAMED_2026.pdf`, sem marcadores e com matrícula manuscrita). As IES que ainda o usarem continuam no processo manual atual.
- **Mudanças no Supabase feitas por este PRD.** Não há tabelas novas, Edge Function, bucket ou front. A única exceção possível é o papel de leitura da regra 4.4, sujeito a portão. A tela de emissão e a importação por ID são do Academy e correm à parte (seção 1.1).
- **Escrever respostas no banco.** O script **nunca** grava em produção; quem grava é a importação atual, operada pelo admin.
- **Alternativa E.** O cartão tem A–D, em definitivo. A alternativa E nos simulados do Academy (14/10/2026) foi uma exceção que não se repetirá.
- **Nota ou correção no cartão.**

## 4. Regras de trabalho (todas as fases)
1. **Branch:**
   - Todo trabalho acontece em `feat/cartoes-resposta`. **Nunca commitar, mergear ou dar push na `main`.**
   - No início de toda sessão:
     1. `git branch --show-current`. Se for `main`, parar e perguntar.
     2. `git fetch origin && git merge origin/main`, porque o Lovable empurra commits na `main` várias vezes por dia.
     3. Se houver conflito, parar e perguntar.
   - Antes do push: `git fetch`. Se o remoto da branch andou, `git pull --no-rebase`. **Nunca `push --force`.**
   - O push pode ser barrado pelo modo automático. Nesse caso, entregar o comando para o João rodar.
2. **Uma fase por sessão.** Não adiantar outra fase. O que pertencer a outra fase vai para "Notas para a próxima fase", no handoff.
3. **Sem LLM.** Não adicionar dependência, chamada ou chave de qualquer provedor de LLM.
4. **Supabase de produção** (ref `gvqvrmkizemwsasmupmo`). Confirmar o ref antes de qualquer chamada.
   - O script **só lê** as tabelas `simulados_admin`, `questoes_simulado`, `users` e `ies`.
   - **Credencial:** um papel Postgres de **somente leitura** dedicado, `cartao_omr_reader`, com `SELECT` apenas nas colunas necessárias. Ele é criado na Fase 2, com **aprovação explícita do João** (portão de produção).
   - A string de conexão fica em `services/cartao-omr/.env`, que **nunca** é commitado: incluir no `.gitignore` e criar um `.env.example` sem segredos.
   - **Proibido** usar a service role key no script.
5. **Dados pessoais.** PDFs, PNGs e xlsx reais de alunos **nunca** entram no Git. O `.gitignore` cobre `services/cartao-omr/runs/` e `*.pdf` fora de `templates/` e `tests/fixtures/`. As fixtures são sempre sintéticas, com nomes falsos.
6. **Windows primeiro.** A V0 roda na máquina do João (Windows 11). Toda dependência precisa ter wheel para Windows: `pymupdf`, `opencv-python-headless`, `numpy`, `zxing-cpp`, `segno`, `reportlab`, `openpyxl`, `psycopg[binary]`, `rapidfuzz`, `typer` e `pytest`. **Evitar `pyzbar`**, que depende de DLL externa.
7. **Testes:**
   - O worker tem a própria suíte `pytest`, que precisa estar verde ao fim de cada fase.
   - A suíte do front (`npm run test:run`, baseline 385/385) só é rodada se a fase tocar fora de `services/`.
8. **Fim de sessão (obrigatório):**
   1. Rodar os testes da fase.
   2. Commitar com `feat(cartoes): fase N — <resumo>`.
   3. Criar a tag anotada `cartoes-fase-N`.
   4. Perguntar ao João antes do push.
   5. Escrever `docs/prd/cartoes-resposta-handoff/fase-N.md`, com: o que foi feito, decisões tomadas, desvios do PRD, pendências, portões não executados e "Notas para a próxima fase".
   6. Gerar o prompt de início da fase seguinte no formato da seção 11 e mostrá-lo ao João.
   7. Listar os próximos passos em duas partes: "meus (Claude)" e "do João".

## 5. O cartão SFA (novo modelo)
Nós geramos o cartão **por código**, com `reportlab` + `segno`. O **gerador é a fonte da verdade**:
- ele produz o PDF para impressão;
- ele produz os templates `templates/sfa_v2.json` e `templates/uniatenas_v1.json`, com as coordenadas exatas que o leitor usa.

Imagens feitas por IA ou por designers servem **só de referência visual**. Não se mede posição em imagem.

**Referência visual aprovada pelo time (13/10/2026):** `docs/prd/Modelo Cartão Resposta.png`. O gerador deve reproduzir essa aparência:
- marcadores de canto e marcador de orientação;
- cabeçalho com "ALUNO:" e QR à direita;
- bloco à esquerda (no `sfa`, em vez do MATRÍCULA da referência, o quadro CARTÃO PESSOAL; no UniAtenas, o MATRÍCULA) e INSTRUÇÕES à direita;
- grade de 4 × 25 questões;
- rodapé.

O QR da imagem é ilustrativo e não lê. As medidas valem as da seção 5.2.

### 5.1 Modelos de cartão
Os dois modelos têm o mesmo layout geral. Mudam o bloco esquerdo e o QR.

| Modelo (`layout`) | Quando | Identificação | QR |
|---|---|---|---|
| **Personalizado** (`sfa`) | **Todas as provas**, exceto UniAtenas. Um cartão por aluno, emitido pela tela do Academy. | Nome impresso após "ALUNO:" + QR com o `user_id`. Não há matrícula em bolhas. | `SFA2:S:<SIM8>:<UID32>` |
| **UniAtenas** (`uniatenas`) | Todas as provas do grupo UniAtenas. Sem personalização: o mesmo PDF é impresso para todos. | Matrícula em bolhas `NN-X-NNNNN` (5.2.1) + nome manuscrito | `SFA2:A:<SIM8>` |

**Formato do QR** (texto em maiúsculas, para o QR usar o modo alfanumérico, mais compacto):
- `SIM8`: 8 primeiros caracteres hexadecimais do `simulado_id` (UUID), usado só para detectar cartão de outro simulado.
- `UID32`: `user_id` sem hífens.
- Prefixo `SFA2`. O prefixo `SFA1` das revisões anteriores não existe mais.
- O QR do UniAtenas **não tem número de série**. Se a IES fotocopiar um único cartão, nada quebra.

**Por que `user_id`:** `users.matricula_ra` está vazia ou quase vazia em várias IES (UEA, Claretiano, USCS, FAI e outras) e cada IES segue um formato (o Integrado tem letras). O `user_id` é interno, único e existe para todo aluno cadastrado. Ele só funciona **pré-impresso**: o aluno não consegue preenchê-lo à mão.

**Troca de cartão entre alunos** é o risco novo do cartão pessoal: as respostas iriam para a pessoa errada sem aviso. Mitigações: nome impresso em destaque, o quadro **CARTÃO PESSOAL** pedindo que o aluno confira o nome e a distribuição pela IES em ordem alfabética (o PDF já sai ordenado por nome).

**QR ilegível** (dobra, mancha, rasgo): a página vai para Pendências, com o recorte do nome impresso, e o João atribui o aluno. Não há matrícula de reserva no `sfa`.

### 5.2 Especificação física (A4 retrato, 210 × 297 mm)
As medidas são as do layout de referência. O gerador pode ajustar até ±1 mm, desde que **todas** as coordenadas reais estejam no template.

- **Cor:** só preto e tons de cinza na área de leitura. Cor da marca, se houver, só no texto do título. Nada de fundo colorido, degradê, marca-d'água ou textura em lugar nenhum.
- **Marcadores de canto (fiduciais):**
  - 4 quadrados **pretos sólidos** de 7 × 7 mm, com a borda externa a 8 mm das bordas da página.
  - **Marcador de orientação:** um quadrado preto extra de 4 × 4 mm, 3 mm à direita do marcador superior esquerdo.
  - Área branca livre de 4 mm em volta de cada marcador.
- **Área útil:** x de 20 a 190 mm, y de 20 a 277 mm.
- **Bloco superior (y de 20 a 108 mm):**
  - **Título** (x de 20 a 150, y de 20 a 28): "CARTÃO-RESPOSTA" + nome do simulado + nome da IES + data.
  - **Identificação** (x de 20 a 150, y de 30 a 40): "ALUNO:" seguido de uma linha.
    - No personalizado, o nome vem impresso sobre a linha.
    - No UniAtenas, a linha fica em branco para o aluno escrever.
  - **QR code** (x de 158 a 188, y de 20 a 50):
    - 30 × 30 mm já com a zona de silêncio (4 módulos brancos);
    - correção de erro nível **Q**;
    - com o payload compacto, o QR do `sfa` é versão 4 (módulo de 0,73 mm) e o do UniAtenas é versão 1 (1,03 mm).
    - Abaixo do QR, o código legível em texto de 6 pt: os 8 primeiros caracteres do `user_id`, em maiúsculas (no UniAtenas, `UNIATENAS`).
  - **Bloco esquerdo** (x de 20 a 92, y de 44 a 108):
    - **`sfa`:** quadro **CARTÃO PESSOAL** com avisos: conferir se o nome acima de ALUNO é o seu, avisar o aplicador se não for, não trocar de cartão e não escrever nem colar nada sobre o QR. Sem bolhas.
    - **`uniatenas`:** quadro MATRÍCULA em bolhas, conforme a seção 5.2.1.
  - **Instruções** (x de 98 a 150, y de 44 a 108):
    - "Use caneta esferográfica preta ou azul-escura."
    - "Preencha a bolha por completo."
    - "Não rasure, não dobre, não escreva fora dos campos."
    - Exemplo de marcação **correta** (bolha cheia) e de marcações **incorretas** (X, ✓, ponto, círculo vazado, duas bolhas).
- **Grade de respostas (y de 115 a 277 mm):**
  - 100 questões em **4 colunas de 25** (1–25, 26–50, 51–75, 76–100).
  - Largura de cada coluna: 42,5 mm.
  - Passo vertical entre linhas: **6,4 mm**.
  - Em cada linha:
    - **número da questão** em negrito preto de 9 pt, alinhado à direita, numa faixa de 9 mm;
    - depois, **4 bolhas (A, B, C, D)** com **diâmetro de 4,5 mm** e passo horizontal de **7,5 mm**.
  - Espaço livre de pelo menos 4 mm entre as colunas.
- **Bolha de resposta e de matrícula:**
  - contorno com **0,5 pt em cinza médio (#7F7F7F)**;
  - letra centralizada em **cinza-claro (#A6A6A6), 6 pt**;
  - interior branco.

  Assim, uma bolha vazia "pesa" pouco na binarização, e uma bolha cheia pesa muito.
- **Rodapé** (y de 279 a 287, entre os marcadores inferiores): "Não dobre nem amasse este cartão • Imprima só na frente • SanarFlix Academy", em 6 pt cinza.
- **Proibido na área de leitura:** linhas-guia, zebrado, logos, numeração de página, texto decorativo.
- **Impressão:** só frente, 100% de escala (sem "ajustar à página"), papel A4 75–90 g/m².

### 5.2.1 Modelo UniAtenas (`uniatenas`)
- **Formato de matrícula:** `NN-X-NNNNN`.
  - Em produção (13/10/2026), 1.589 usuários seguem `^\d{2}-\d-\d{5}$`, todos em PARACATU, PASSOS, PORTO SEGURO, SETE LAGOAS, SORRISO e VALENÇA.
  - Outros 5 usuários têm `99-G-99999`. O João confirmou que a letra `G` **é erro de cadastro**: o cartão não tem `G`, e esses 5 cadastros não serão identificados (vão para Pendências até serem corrigidos; P3).
- **Conjunto de campi:** inferido pelo formato da matrícula. **Ainda falta o João confirmar** que esses 6 são exatamente os campi do grupo (seção 13).
- **Bloco MATRÍCULA:** **8 colunas**, agrupadas em 2 | 1 | 5.
  - Entre os grupos há um **hífen impresso** em preto, que não é bolha. A caixa de escrita no topo de cada coluna é mantida.
  - **Todas as 8 colunas têm bolhas de 0 a 9** (80 bolhas), inclusive a 3ª. Não há letras.
- **Leitura:** a matrícula só é válida com as **8 colunas marcadas**. Ela é montada como `NN-X-NNNNN` e comparada com `matricula_ra` (`trim`, maiúsculas).
- **Medidas efetivas** (revisão 4): colunas de 7 mm, vão de 5 mm com o hífen impresso, bolhas de 4 mm e passo vertical de **5,0 mm**. O passo de 5,5 mm do rascunho não cabe: caixa de 6 mm + título + 10 bolhas passariam de y = 108 mm.
- **Cobertura:** cerca de 15% dos alunos desses campi **não têm matrícula cadastrada**: PARACATU 97, PASSOS 57, SETE LAGOAS 29, SORRISO 21, PORTO SEGURO 21, VALENÇA 21. Os cartões deles sempre vão para Pendências. Ver seção 13.

### 5.3 Instruções de digitalização (vão para as IES)
- Resolução de **200 a 300 dpi**, em tons de cinza ou colorido, num **único PDF com várias páginas**.
- Desligar "auto-aprimorar", "remover fundo" e "compressão máxima".
- Cartões na mesma orientação e sem grampos.
- Foto de celular não é suportada na V0. Se vier, a página tende a cair em Pendências.

## 6. Arquitetura da V0
```
Tela do Academy (futura): IES + simulado + alunos  →  PDF dos cartões pessoais  →  impressão na IES
IES escaneia os cartões preenchidos  →  PDF  →  João
        │
        ▼
cartao-omr processar <pdf> --simulado <id> [--saida <pasta>]
        │
        ├─ lê do Supabase (papel somente leitura): simulado, questões, alunos das IES
        ├─ por página: render → marcadores → homografia → QR (user_id) → OMR das respostas
        │             (UniAtenas: + matrícula em bolhas)
        ├─ identificação: QR → user_id │ UniAtenas: matrícula → user_id │ senão pendência
        └─ escreve runs/<data>_<simulado>/
              respostas_<simulado>.xlsx   (aba 1 "Respostas" no formato da importação, com o ID do aluno)
              recortes/pagina_<n>.png      (só páginas com pendência)
              relatorio.json
        ▼
João revisa a aba "Pendências", corrige a aba "Respostas" e importa pela tela atual (dry-run → commit)
```

**Comandos:**
- `cartao-omr gerar-cartoes --simulado <id> --roster <csv>`: um PDF com um cartão pessoal por aluno, ordenado por nome. Na V0 o roster é um CSV `user_id,nome[,ies]`; na emissão pelo Academy ele vem da tela (P7).
- `cartao-omr gerar-cartoes --simulado <id> --modelo uniatenas [--copias 1]`: o PDF do UniAtenas, sem nome.
- `cartao-omr modelo [--layout sfa|uniatenas]`: PDF de exemplo e template do layout (`templates/sfa_v2.json`, `templates/uniatenas_v1.json`).
- `cartao-omr processar`: **detecta o layout e o simulado pelo QR**. Se o QR não for lido, usa `--layout` (obrigatório quando o simulado tiver IES do grupo UniAtenas).

**Estrutura:**
```
services/cartao-omr/
  cartao_omr/      cli.py (typer), layout.py (constantes mm), drawlist.py (lista de desenho), card.py (template + PDF),
                   models.py (CardSpec, formato e leitura do QR), pipeline/{render,align,qr,omr}.py,
                   identity.py, roster.py (CSV na Fase 0; psycopg só SELECT na Fase 2),
                   export_xlsx.py, config.py
  templates/       sfa_v2.json, uniatenas_v1.json, exemplo_*.pdf
  tools/           make_fixtures.py, eval_accuracy.py, gen_qr_golden.py, emitir_ts.mts
  tests/           fixtures/ (sintéticas), test_*.py
  runs/            (gitignored)
  .env.example, pyproject.toml, README.md (instalação no Windows + runbook)
```

## 7. Contratos

### 7.1 Template `templates/sfa_v2.json`
```json
{
  "template_version": "sfa_v2",
  "page_mm": [210, 297],
  "fiducials_mm": {"tl":[x,y,w], "tr":[...], "bl":[...], "br":[...], "orient":[x,y,w]},
  "qr_box_mm": [x0,y0,x1,y1],
  "alternatives": ["A","B","C","D"],
  "questions": {"1": {"A":[cx,cy,d], "B":[...], "C":[...], "D":[...]}, "...": {}, "100": {}},
  "matricula": null,
  "crops_mm": {"nome":[x0,y0,x1,y1]}
}
```
O template tem campos extras (`layout`, `conventions`, `useful_area_mm`, `qr`, `blocks_mm`). Em `fiducials_mm`, `[x, y, w]` é o **canto superior esquerdo** do quadrado e o lado.

No `sfa_v2.json`, `matricula` é `null` (não há matrícula). No `uniatenas_v1.json`, a matrícula fica assim:
- `"format": "uniatenas"`, `"n_columns": 8`;
- 8 colunas, cada uma com os símbolos `0`–`9`;
- `"separators_after": [2, 3]`;
- `crops_mm` ganha `"matricula":[x0,y0,x1,y1]`.

O leitor monta a string inserindo `-` depois das colunas listadas em `separators_after`.
As coordenadas ficam em mm, com origem no topo-esquerdo, e são geradas pelo `card.py` a partir do `layout.py`. Ninguém mede nada à mão.

### 7.2 Leitura de uma página
1. **Render:** a página vira imagem em tons de cinza a 200 dpi. Uma página quase toda branca e sem marcadores vira `pagina_em_branco`, é ignorada e entra no relatório.
2. **Marcadores:**
   - binarizar (Otsu);
   - achar contornos quadrados pretos sólidos perto dos 4 cantos e o marcador de orientação;
   - se a orientação indicar 180° (ou 90°), girar e repetir.
3. **Homografia:** usar os 4 centros dos marcadores e a posição deles no template. `align_score` é o erro de reprojeção em mm. Se passar de 1,5 mm, a página vira `pagina_ilegivel`.
4. **QR:**
   - Ler com `zxing-cpp` no recorte retificado da área do QR, com fallback para a página inteira.
   - Interpretar com `models.parse_qr`: prefixo `SFA2`, tipo (`S` personalizado ou `A` UniAtenas), `SIM8` e, no tipo `S`, o `user_id`. Comparar o `SIM8` com o de `--simulado`; se for outro, a página vira `simulado_divergente` e não é lida.
   - O tipo do QR escolhe o template. O alinhamento pelos marcadores é igual nos dois layouts.
   - Se o QR não for lido mas os marcadores forem: no `sfa`, a página é lida normalmente, vira `qr_ilegivel` e fica **sem aluno** (revisão humana pelo recorte do nome impresso); no UniAtenas, usa `--layout uniatenas` e a identificação segue pela matrícula.
5. **OMR (respostas e matrícula):**
   - Para cada bolha, medir a fração de pixels escuros num círculo de 70% do diâmetro, depois de uma binarização adaptativa.
   - Normalizar pela mediana das bolhas vazias da própria página.
   - Classificar cada questão (ou coluna da matrícula):
     - **marcada:** maior score `≥ T_ALTO`, segundo `< T_BAIXO` e diferença `≥ GAP_MIN`;
     - **branco:** nenhuma bolha `≥ T_BAIXO` (resposta vazia);
     - **multipla:** duas ou mais bolhas `≥ T_ALTO`;
     - **ambigua:** qualquer outro caso.
   - Os limiares iniciais saem da calibração da Fase 1 e ficam no `config.py`.
6. **Matrícula (só `uniatenas`):**
   - As 8 colunas são obrigatórias. A string é montada como `NN-X-NNNNN`.
   - Uma coluna faltando, ou uma coluna `multipla`/`ambigua` (por exemplo, dois dígitos marcados na mesma coluna), torna a matrícula `matricula_invalida`.
   - O `sfa` não tem matrícula: nada a ler.

### 7.3 Identificação (determinística)
1. **QR personalizado (`S`):** o `user_id` do QR precisa estar entre os alunos das IES do simulado. Se não estiver, a página vira `aluno_fora_do_roster`.
2. **QR ilegível no `sfa`:** a página vira `qr_ilegivel` + `aluno_nao_identificado`. Não há matrícula de reserva; o João atribui o aluno pelo recorte do nome impresso.
3. **UniAtenas (`A`):** comparar a string `NN-X-NNNNN` com `upper(trim(matricula_ra))`. Não remover zeros, porque o formato é posicional. O candidato tem que ser único; zero candidatos ou mais de um viram `aluno_nao_identificado`. Não usar aproximação: matrícula em bolha não tem "erro de leitura de letra", e aproximar arriscaria trocar alunos. O resultado é convertido em `user_id`.
4. **Duplicidade:** o mesmo aluno em mais de uma página vira `aluno_duplicado` em **todas** essas páginas.

### 7.4 Saída: `respostas_<simulado>.xlsx`
A ordem das abas importa: a tela de importação lê **só a primeira**, **por posição**.

1. **`Respostas`** (primeira aba, no formato da importação):
   - **Colunas:** exatamente `1 + N`, em que N é o `total_questoes` do simulado. A coluna 1 é o **`matricula_ra_ou_id`** (o `users.id`, UUID); as colunas 2 a N+1 são `Questão 1` … `Questão N`, em ordem. A linha 1 é o cabeçalho; a importação não lê mais colunas nem colunas fora de ordem.
   - **Linhas:** uma por aluno identificado e não duplicado. O valor é `A`–`D` ou vazio.
   - **Questões `multipla`/`ambigua`:** a célula fica vazia, com **fundo amarelo** e um comentário (`múltipla` ou `ambígua`, página N). O João decide e preenche.
   - **Importação por ID (P6, entregue em 16/10):** a coluna 1 aceita o UUID do aluno (comparado sem diferenciar maiúsculas e ignorando espaços) ou a Matrícula/RA; o aluno precisa pertencer a uma IES do simulado e não pode repetir na planilha (nem por ID e RA ao mesmo tempo). O cabeçalho da coluna 1 é o do modelo da tela, `matricula_ra_ou_id`.
2. **`Pendências`**: uma linha por problema, com as colunas `pagina | tipo | questao | detalhe | recorte`.
   - **tipos:** `aluno_nao_identificado`, `aluno_duplicado`, `aluno_fora_do_roster`, `matricula_invalida`, `qr_ilegivel`, `multipla`, `ambigua`, `pagina_ilegivel`, `simulado_divergente`.
   - O `recorte` é o caminho relativo do PNG em `recortes/`.
3. **`Não identificados`**: as páginas sem aluno, com as respostas completas e a coluna `matricula_ra_ou_id` vazia. Depois de identificar o aluno pelo recorte do nome, o João preenche o ID e move a linha para `Respostas`.
4. **`Resumo`**:
   - simulado, IES, data e hora da execução;
   - total de páginas, em branco, ilegíveis, identificadas e não identificadas;
   - total de questões marcadas, em branco, múltiplas e ambíguas;
   - versão do `cartao-omr` e limiares usados.

`relatorio.json` traz os mesmos dados, legíveis por máquina, para a V1.

## 8. Fases da V0

### Fase 0 — Cartão SFA: gerador, template e fixtures
**Status: concluída** (tags `cartoes-fase-0` e `cartoes-fase-0.1`, revisão 16/10/2026). Detalhes no handoff `fase-0.md`.
- **Objetivo:** gerar o cartão e o template por código, e um conjunto de fixtures sintéticas realistas.
- **Entregáveis:**
  - Pacote `services/cartao-omr/` com `pyproject.toml`, README, `.gitignore` e `.env.example`.
  - `layout.py` e `card.py`: PDFs do cartão **personalizado** e do **UniAtenas** (seções 5.2 e 5.2.1, fiéis à referência visual), e os templates `sfa_v2.json` e `uniatenas_v1.json`.
  - CLI: `cartao-omr modelo` e `cartao-omr gerar-cartoes` (roster em CSV falso; o banco entra na Fase 2).
  - `models.py`: formato do QR `SFA2` e `parse_qr`.
  - `tools/make_fixtures.py`: cartões preenchidos e digitalizados sintéticos (caneta preta/azul, marcas fracas, duplas, X, ✓, rasuras, brancos, rotação ±5° e 180°, escala 95–105%, perspectiva, ruído, JPEG, 150/200/300 dpi, páginas em branco, **QR danificado**, marcador coberto), com gabarito em JSON. As do UniAtenas incluem matrículas completas e com defeito (coluna dupla, coluna faltando).
  - **Consulta somente leitura** em produção (13/10/2026), que definiu N (colunas da matrícula do `sfa`) em 12. **Ficou sem efeito** na revisão 4, porque o `sfa` não tem mais matrícula. O resultado está no handoff.
- **Testes:** o template `sfa` tem 400 bolhas de resposta e nenhuma de matrícula; o `uniatenas` tem 400 e 8×10; sem sobreposição; bolhas, QR e blocos dentro da área útil; o QR é lido de volta pelo `zxing-cpp`; o gabarito das fixtures confere com as imagens.
- **Aceite:** testes verdes e o PDF de exemplo aberto e conferido visualmente pelo João.
- **Portões:** nenhum (só leitura).

### Fase 1 — Pipeline de leitura (go/no-go)
**Status: concluída, GO** (tag `cartoes-fase-1`, 16/10/2026). Detalhes no handoff `fase-1.md`.
- **Entregáveis:**
  - `pipeline/render.py`, `align.py`, `qr.py`, `omr.py` e `page.py`, conforme a seção 7.2. São funções puras, sem banco. O `qr.py` usa `models.parse_qr`. A orientação (0°, 90°, 180°, 270°) é resolvida pela homografia, sem girar a imagem.
  - `tools/eval_accuracy.py`: roda o pipeline sobre as fixtures e mede o acerto por bolha, o acerto da matrícula, a leitura do QR, as páginas ilegíveis e a matriz de confusão (marcada/branco/múltipla/ambígua). Com `--calibrar`, varre os limiares.
  - Limiares em `config.py`: `T_ALTO` 0,50, `T_BAIXO` 0,20, `GAP_MIN` 0,30, `T_INK` 0,55 e círculo de medição de 70% do diâmetro.
- **Aceite (nas fixtures):**
  - acerto por bolha ≥ **99,8%**;
  - **0** `multipla` lida como letra;
  - matrícula correta ≥ **99,5%** (só UniAtenas);
  - QR lido ≥ **99%** nas páginas com QR intacto; as páginas com `qr_danificado` das fixtures viram `qr_ilegivel`, nunca um aluno errado;
  - páginas ilegíveis ≤ **0,5%** com rotação de até ±5°.
- **Resultado:** todos os critérios atendidos em 245 páginas (21 mil questões estritas): 100% de acerto por bolha, 0 múltipla lida como letra, 0 letra errada nas marcas não estritas, matrícula 79/79, QR 236/236, 0 ilegíveis legítimas, erro de alinhamento médio de 0,09 mm. O mesmo vale num conjunto de **estresse** (100 e 150 dpi, ruído, JPEG de qualidade 25 a 45, marcas mais leves).
- **Ressalva importante:** as fixtures separam demais as classes (toda marca "marcada" pontua ≥ 0,61; todo branco ≤ 0,08), então **qualquer** `T_ALTO` de 0,20 a 0,60 e `T_BAIXO` de 0,10 a 0,48 acerta 100%. O aceite prova que o pipeline funciona e que degradação de imagem não o derruba, mas **não prova** os limiares. Quem confirma é o piloto com cartões reais (Fase 3), onde a zona cinzenta (marca leve, rasura, caneta falhando) aparece de verdade.
- **No-go:** se o aceite não for atingido depois da calibração, parar e reportar com números e exemplos. Não seguir para a Fase 2.

### Fase 2 — Identificação, roster e planilha de saída
- **Portão de produção:** com aprovação explícita do João, criar o papel `cartao_omr_reader` por migration aditiva em `supabase/migrations/<ts>_cartao_omr_reader.sql`:
  - `LOGIN`, senha forte informada pelo João fora do Git;
  - `GRANT SELECT` só em `simulados_admin(id, nome, ies_ids)`, `questoes_simulado(simulado_id, numero_questao, ordem)`, `users(id, nome, id_ies, matricula_ra)` e `ies(id, nome)`;
  - nenhum outro privilégio.

  Validar os grants pela `information_schema` depois de aplicar. Se a ferramenta for barrada pelo modo automático, avisar o João; **não contornar** com `execute_sql`.
- **Entregáveis:**
  - `roster.py`: conexão `psycopg` pela string do `.env`, só `SELECT`. Carrega uma vez o simulado, as questões e o roster das IES.
  - `identity.py`: implementa a seção 7.3.
  - `export_xlsx.py` (`openpyxl`): implementa a seção 7.4 (abas, cores e comentários), mais os recortes e o `relatorio.json`.
  - CLI `cartao-omr processar` completo.
  - `gerar-cartoes` passa a usar o roster do banco.
  - Pastas de execução em `runs/<AAAA-MM-DD_HHMM>_<simulado>/`.
- **Testes:**
  - identificação: QR válido, QR de outro simulado, `user_id` fora do roster, aluno duplicado, QR personalizado ilegível (vai para Pendências sem aluno);
  - UniAtenas: `12-3-45678` exata, coluna faltando, dois dígitos na mesma coluna (múltipla), matrícula ausente no roster (inclui `99-G-99999`, cadastro errado), matrícula repetida no roster;
  - xlsx: a 1ª aba se chama `Respostas`, tem `matricula_ra_ou_id` + uma coluna por questão do simulado (1 + N) e as células de pendência ficam amarelas;
  - **compatibilidade com a importação:** um teste que lê a aba 1 com as mesmas regras de `parseMatrizRespostas` e `isRespostaValida` (`importar-respostas-types.ts`): 1 + N colunas por posição e células só com A–E. Implementar em Python, espelhando aquele arquivo. A coluna 1 é lida como ID (P6 entregue).
- **Aceite:** testes verdes; uma execução ponta a ponta sobre as fixtures, contra um simulado real em modo leitura, gerando um xlsx que o João abre e confere.

### Fase 3 — Piloto real e runbook
- **Insumos do João:**
  - um simulado de teste;
  - cartões pessoais impressos e preenchidos por voluntários, com **gabarito conhecido**;
  - digitalização num scanner comum, em 200 e 300 dpi.
- **Entregáveis:**
  - execução real e comparação com o gabarito;
  - ajuste fino dos limiares, se necessário;
  - `README.md` com o **runbook da V0**: instalação, `.env`, como gerar os cartões de um simulado, como processar um PDF, como revisar as Pendências e como importar pela tela (dry-run → commit);
  - um **guia de 1 página para as IES** (impressão e digitalização, seções 5.2 e 5.3), em `docs/prd/cartoes-resposta-guia-ies.md`.
- **Validação da importação:**
  - Rodar o dry-run na tela de importação com o xlsx gerado. O esperado é zero linhas em erro (aluno não encontrado ou nº de colunas diferente do simulado). Exige a P6 pronta.
  - **O commit real só com autorização do João**, e num simulado de teste.
- **Aceite:**
  - acerto por bolha ≥ 99,5% no material real;
  - 100% dos cartões com QR intacto identificados;
  - relatório salvo no handoff.

### Fase E — Emissão dos cartões em TypeScript (no Academy)
**Status: concluída** (tag `cartoes-fase-e`, 16/10/2026). Detalhes no handoff `fase-e.md`.
- **Decisão (16/10/2026):** o porte do gerador para TypeScript, lendo os templates, **no próprio Academy e sem chamar serviço externo**. O PDF é gerado no navegador do operador; nenhum nome ou `user_id` sai do Academy.
- **Contrato:** o template traz a **lista de desenho** (`draw`, ver `cartao_omr/drawlist.py`): retângulos, círculos, linhas, textos (com *slots* para título, aluno e rótulo), numeração, bolhas e QR. O Python e o TypeScript **só interpretam** essa lista; nenhum dos dois tem medida própria. Mudar o layout é mudar `layout.py`, rodar `cartao-omr modelo` e commitar os JSON.
- **Fase E1 — gerador (biblioteca):**
  - Python: `card.py` passou a desenhar o PDF **interpretando o `draw`**; o resultado ficou idêntico, pixel a pixel, ao da versão anterior.
  - TypeScript (`src/features/cartoes/`): `qr.ts` (gerador de QR nível Q, versões 1 a 9, **sem dependência nova**), `payload.ts` (formato `SFA2`), `render.ts` (interpretador com `jspdf`, que já era do projeto), `emitir.ts` (monta os cartões e o PDF), `emitir.worker.ts` e `gerar.ts` (geração em Web Worker, com fallback na thread principal).
  - **Paridade:** o QR do TypeScript é idêntico ao do `segno` em 86 vetores (versões 1 a 9); o PDF do TypeScript é gerado pelo Node (`tools/emitir_ts.mts`, o mesmo código do navegador) e conferido no suíte Python: QR lido pelo `zxing-cpp` com o payload esperado, QR idêntico ao do Python pixel a pixel, marcadores e bolhas no lugar do template, só preto e cinza, e o leitor da Fase 1 lê o cartão.
- **Fase E2 — tela de emissão:** aba **Cartões-resposta**. O time escolhe simulado, IES e alunos (turma inteira marcada por padrão, com busca por nome ou matrícula), vê o modelo (pessoal ou UniAtenas, pré-selecionado para as IES do grupo) e baixa o PDF. Só lê (`simulados_admin`, `ies`, `users`, `user_roles`), com a sessão do admin; **nada é gravado**.
- **Desempenho (medido no navegador):** 700 cartões em 13 s, PDF de 22,7 MB, com a tela sem travar (pausa máxima de 9 ms). A aba em segundo plano não atrasa a geração, porque ela roda no Worker.
- **Aceite:** testes de paridade e do front verdes (atendido); o João imprime um cartão gerado pelo TypeScript e o leitor lê o scan (**pendente do João**).
- **Portões:** nenhum de banco. **Antes da primeira impressão real, a P8 precisa estar fechada** (F1 e F2 corrigidas).

## 9. V1 — direção (não detalhar em fases agora)
- **Hospedagem, opção preferida (N8N self-hosted, a confirmar):**
  - empacotar o `cartao-omr` como **container HTTP** (FastAPI, endpoint `POST /processar` que recebe o PDF e o `simulado_id` e devolve um zip com o xlsx e os recortes), rodando **ao lado do N8N** no mesmo servidor;
  - o fluxo do N8N: gatilho do Google Drive em `Cartões/Entrada/<simulado_id>/` → download → HTTP para o container → upload em `Cartões/Saída/<simulado_id>/` → mensagem no Slack;
  - configurar o N8N com dados binários em disco (`filesystem`) e tempo limite adequado para PDFs grandes.
- **Alternativa,** se o N8N não for self-hosted: o mesmo container em outro host. A decisão de custo fica para a V1.
- **Segurança:**
  - credencial `cartao_omr_reader` como secret do servidor;
  - pasta do Drive com acesso restrito;
  - regra de retenção, para apagar PDFs e saídas depois de X dias.
- **Tela de emissão (parte da operação, seção 1.1):** decidido em 16/10 que ela gera o PDF **em TypeScript, lendo os templates, sem serviço externo** (Fase E). O serviço Python (`gerar-cartoes`) continua útil como referência e para testes de paridade. `templates/*.json` e o formato do QR (`SFA2`) são o contrato.
- **Evoluções possíveis:** importação automática via `admin-import-simulado-responses` (exige o N8N autenticado como admin); acompanhamento do processamento na tela.

## 10. Riscos
| Risco | Mitigação |
|---|---|
| A IES imprime fora de escala ou em frente e verso | O guia da Fase 3; os marcadores e a homografia toleram escala; página ilegível vai para Pendências. |
| **Troca de cartão** entre alunos (as respostas vão para a pessoa errada sem aviso) | Nome impresso em destaque, quadro CARTÃO PESSOAL, distribuição em ordem alfabética. Não há detecção automática. |
| QR danificado ou fotocopiado | Módulo ≥ 0,7 mm, correção Q, instrução de não escrever sobre o QR; página vai para Pendências com o recorte do nome. |
| Aluno sem cartão (extravio, chegou depois) | Emitir um cartão pessoal na hora pela tela do Academy. |
| A IES continua usando o cartão antigo | Fora da V0: esses cartões seguem o processo manual. Relacionamento comunica o novo modelo. |
| UniAtenas fotocopia o cartão (perda de nitidez, escala diferente) | QR sem número de série; os marcadores e a homografia toleram escala; o guia pede impressão direta do PDF sempre que possível. |
| Alunos UniAtenas sem matrícula cadastrada (~15%) | Pendência com recorte do nome. Ação preventiva na seção 13. |
| **Importação sem aceitar ID** (P6) | Bloqueia o uso ponta a ponta. É dependência do João, fora das fases do script. |
| `user_id` impresso no QR pode ser lido por quem fotografar o cartão | Verificação dos endpoints e das políticas que aceitam `user_id` (checklist da P8) **antes da primeira impressão**. |
| O PDF gerado em TS divergir do template | `draw` exportado pelo Python, teste de paridade (QR idêntico ao do Python, marcadores e bolhas no lugar) e QR lido pelo `zxing-cpp` (Fase E). Se o `layout.py` mudar, os testes falham até os templates serem regenerados. |
| Dados pessoais vazarem pelo Git | `.gitignore` de `runs/` e de PDFs reais; fixtures só sintéticas. |
| Credencial com poder demais | Papel somente leitura, com colunas mínimas; service role proibida. |

## 11. Modelo do prompt de início de sessão
```
Você vai executar a Fase {N} — {título} do PRD de correção de cartões-resposta do SanarFlix Academy (V0, sem LLM).

Repo: sanarflix-study-guide (pasta "Academy Project"). Branch: feat/cartoes-resposta. Nunca commitar/pushar na main.
Comece com `git branch --show-current` e `git fetch origin && git merge origin/main` (regra 1 da seção 4).
Supabase de produção: gvqvrmkizemwsasmupmo (confirme o ref antes de qualquer chamada).

Leia, nesta ordem, antes de qualquer ação:
1. docs/prd/2026-10-07-cartoes-resposta.md — seções 3, 4, 5, 7 e a Fase {N} na seção 8.
2. docs/prd/cartoes-resposta-handoff/fase-{N-1}.md — entregas, desvios e notas da fase anterior (se existir).

Estado atual: {2–5 linhas: última tag, o que existe, portões executados/pendentes}.
Atenção nesta fase: {riscos, decisões herdadas, insumos que o João precisa fornecer}.

Execute só a Fase {N}. Peça aprovação explícita antes de qualquer ação em produção.
Ao final, siga a regra 8 da seção 4 (testes, commit, tag cartoes-fase-{N}, handoff, prompt da fase seguinte, próximos passos meus/do João).
```

## 12. Referências no código
- Importação atual (front): `src/components/admin/simulados/ImportarRespostasTab.tsx` (`downloadTemplate`, leitura da 1ª aba) e `importar-respostas-types.ts` (`parseMatrizRespostas`, `isRespostaValida`, regex de Matrícula/RA).
- Importação atual (edge): `supabase/functions/admin-import-simulado-responses/index.ts` (`normalizeResposta`, `validateRow`, `admin_lookup_users_by_ra_in_ies`). **O script não altera.** A extensão para ID é feita pelo João (P6).
- Tabelas lidas: `simulados_admin` (`ies_ids`), `questoes_simulado` (`numero_questao`, `ordem`), `users` (`nome`, `id_ies`, `matricula_ra`) e `ies`.
- Default ACL do projeto: um papel novo precisa de `GRANT`s explícitos e mínimos. Conferir pela `information_schema.role_table_grants` / `column_privileges`.

## 13. Pendências registradas (decisões em aberto)
| # | Pendência | Bloqueia | Dono |
|---|---|---|---|
| P1 | **Hospedagem do N8N:** confirmar se é self-hosted (e quem administra o servidor) ou N8N Cloud. Define a hospedagem da V1 (seção 9). | Só a V1 | João |
| P2 | **Campi do grupo UniAtenas:** confirmar que são exatamente PARACATU, PASSOS, PORTO SEGURO, SETE LAGOAS, SORRISO e VALENÇA. A lista foi inferida pelo formato da matrícula em 13/10/2026. | Fase 2 (validação de `--layout uniatenas`) | João |
| P3 | **Matrículas faltantes no UniAtenas:** cerca de 246 alunos desses campi estão sem `matricula_ra`. Pedir a lista às IES via Relacionamento, antes da primeira prova com o cartão novo, e atualizar o cadastro. | Qualidade do piloto UniAtenas | João / Relacionamento |
| P4 | ~~Matrícula com `G`~~ **Encerrada em 16/10:** o `G` era erro de cadastro; o cartão só tem dígitos. | – | – |
| P5 | **Comunicação do cartão novo:** avisar às IES que o cartão é pessoal (um por aluno) e que o cartão antigo deixa de ser processado automaticamente. | Fase 3 | João / Relacionamento |
| P6 | ~~Importação por ID do aluno~~ **Entregue em 16/10** pelo João (RPC `admin_lookup_users_by_id_in_ies`, Edge Function e tela). A 1ª coluna aceita UUID ou Matrícula/RA. | – | – |
| P7 | ~~Como a tela de emissão gera o PDF~~ **Entregue em 16/10:** porte para TypeScript, lendo os templates, sem serviço externo (**Fase E**, seção 8). Falta o João imprimir um cartão gerado ali para o aceite. | – | – |
| P8 | **Verificação dos endpoints que aceitam `user_id`: auditada em 16/10** (`handoff/p8-auditoria-user-id.md`). Resultado: **F1 (ALTA)** `session-security` derruba as sessões de qualquer UUID sem autenticação; **F2 (MÉDIA)** `gestor-ai-insights` devolve o cache de IA sobre um aluno sem checar papel/IES; F3 (BAIXA) `get_user_roles`/`has_role` revelam papéis a qualquer logado; F4 (fora do tema) `send-study-reminder` é um relé de e-mail aberto. RLS e funções do `anon` estão corretos. **Pendente:** corrigir F1 e F2 (e decidir F3), e conferir storage e `cron.job`. | **Antes de imprimir os primeiros cartões reais** (piloto da Fase 3 e Fase E2) | João / equipe do Academy |
