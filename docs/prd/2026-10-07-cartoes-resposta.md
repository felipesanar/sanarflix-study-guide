# PRD — Correção automática de cartões-resposta (PDF → planilha de importação)

- **Produto:** SanarFlix Academy (repo `sanarflix-study-guide`)
- **Autor:** João Nader (com Claude)
- **Criado em:** 07/10/2026
- **Revisão 2 (13/10/2026):**
  - Reorganizado em **V0 (local)** e **V1 (automação)**.
  - **LLM removida por completo.**
  - Novo cartão desenhado para leitura 100% por máquina.
  - Fim do suporte ao cartão antigo.
- **Status:** aprovado para implementação da **V0**. A V1 está só em direção.
- **Executor previsto:** Claude Code com Sonnet 5.5, **uma fase por sessão**.

---

## 1. Contexto e problema
As respostas dos simulados presenciais entram no Academy pela aba **Importar respostas**, em `/admin/simulados?tab=importar`. A aba espera uma planilha no formato `email | 1..N | tempo_minutos | saidas_aba | finalizado_em`.

A maioria das IES aplica os cartões, escaneia e já manda essa planilha. Algumas mandam só **os cartões escaneados em PDF**. Hoje a equipe transcreve esses cartões à mão para o Excel, o que é lento, caro e sujeito a erro.

**Objetivo:** a partir do PDF com os cartões, gerar automaticamente a planilha **no formato exato da importação atual**. Os casos em que a leitura não deu certeza saem numa aba de pendências, para revisão humana. A importação continua manual, pela tela que já existe.

**Princípio:** **nenhuma LLM.** Como nós desenhamos o cartão, tudo nele é legível por visão computacional determinística:
- **Bolhas:** lidas por OMR.
- **Identificação do aluno:** por **QR code** ou por **matrícula em bolhas**.
- **Dúvidas:** vão para revisão humana.

## 2. V0 × V1

| | **V0 — agora** | **V1 — depois (só direção)** |
|---|---|---|
| Onde roda | Máquina do João (Windows), por linha de comando | N8N self-hosted da empresa (a confirmar) ou, se não der, outro host |
| Entrada | PDF recebido do Relacionamento por Slack ou Notion | Pasta do Google Drive monitorada pelo N8N |
| Saída | `.xlsx` (Respostas + Pendências) + recortes das dúvidas, numa pasta local | O mesmo `.xlsx` devolvido numa pasta do Drive, com aviso no Slack |
| Importação | Manual, pela tela atual | Manual (automatizar fica para depois) |
| Custo novo | Zero | Zero, se usar o N8N existente |
| Banco | Somente leitura | Somente leitura |

**O núcleo é o mesmo nas duas versões:** um pacote Python com linha de comando (`cartao-omr`). A V1 apenas *chama* esse núcleo de outro lugar. Tudo que for feito na V0 vale para a V1.

## 3. Fora de escopo (V0)
- **LLM**, de qualquer tipo, em qualquer etapa.
- **O cartão antigo** (`cartao_de_respostas_simulado_E_ENAMED_2026.pdf`, sem marcadores e com matrícula manuscrita). As IES que ainda o usarem continuam no processo manual atual.
- **Mudanças no Supabase.** Não há tabelas novas, Edge Function, bucket ou front. A única exceção possível é o papel de leitura da regra 4.4, sujeito a portão.
- **Escrever respostas no banco.** O script **nunca** grava em produção; quem grava é a importação atual, operada pelo admin.
- **Alternativa E.** O cartão tem A–D.
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
- ele produz o template `templates/sfa_v1.json`, com as coordenadas exatas que o leitor usa.

Imagens feitas por IA ou por designers servem **só de referência visual**. Não se mede posição em imagem.

### 5.1 Dois tipos de cartão
| Tipo | Quando | Identificação | QR |
|---|---|---|---|
| **Personalizado** (principal) | Gerado antes da prova, um por aluno do roster das IES do simulado | Nome impresso + QR com o `user_id` | `SFA1\|<simulado_id>\|U\|<user_id>` |
| **Genérico** (reserva) | Para aluno ausente do roster, cartão extraviado ou aluno novo | Matrícula preenchida em bolhas + nome manuscrito (só para a revisão humana) | `SFA1\|<simulado_id>\|G\|<seq>` |

**Por que o personalizado é o principal:** `users.matricula_ra` está vazia ou quase vazia em várias IES (UEA, Claretiano, USCS, FAI, Fame, Famp, Integrado). O QR com `user_id` identifica qualquer aluno cadastrado, sem depender da matrícula.

**Matrícula no cartão genérico:**
- Ela só identifica o aluno se estiver cadastrada.
- Se não estiver, a página vai para Pendências, com o recorte do nome manuscrito, e o João atribui o aluno.

### 5.2 Especificação física (A4 retrato, 210 × 297 mm)
As medidas são as do layout de referência. O gerador pode ajustar até ±1 mm, desde que **todas** as coordenadas reais estejam no `sfa_v1.json`.

- **Cor:** só preto e tons de cinza na área de leitura. Cor da marca, se houver, só no texto do título. Nada de fundo colorido, degradê, marca-d'água ou textura em lugar nenhum.
- **Marcadores de canto (fiduciais):**
  - 4 quadrados **pretos sólidos** de 7 × 7 mm, com a borda externa a 8 mm das bordas da página.
  - **Marcador de orientação:** um quadrado preto extra de 4 × 4 mm, 3 mm à direita do marcador superior esquerdo.
  - Área branca livre de 4 mm em volta de cada marcador.
- **Área útil:** x de 20 a 190 mm, y de 20 a 277 mm.
- **Bloco superior (y de 20 a 108 mm):**
  - **Título** (x de 20 a 150, y de 20 a 28): "CARTÃO-RESPOSTA" + nome do simulado + nome da IES + data.
  - **Identificação** (x de 20 a 150, y de 30 a 40):
    - no personalizado, "ALUNO: <NOME IMPRESSO>";
    - no genérico, "NOME:" seguido de uma linha para escrever à mão.
  - **QR code** (x de 158 a 188, y de 20 a 50):
    - 30 × 30 mm já com a zona de silêncio (4 módulos brancos);
    - correção de erro nível **Q**.
    - Abaixo do QR, o código legível em texto de 6 pt (ex.: `G-0042` ou os 8 primeiros caracteres do `user_id`).
  - **Matrícula em bolhas** (x de 20 a 92, y de 44 a 106):
    - Título "MATRÍCULA" e **N colunas**. Placeholder: N = 12. O N definitivo sai da consulta da Fase 0.
    - Cada coluna tem 6 mm de largura, com uma caixa de 5 × 6 mm no topo para escrever o dígito à mão (a máquina ignora essa caixa).
    - Abaixo da caixa, **10 bolhas de 0 a 9 na vertical**, com passo de 5,5 mm e diâmetro de 4 mm.
    - No personalizado, o bloco vem preenchido de cinza-claro com a frase "Não preencher — cartão identificado", ou é omitido.
  - **Instruções** (x de 98 a 150, y de 44 a 106):
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
- **Bolha:**
  - contorno com **0,5 pt em cinza médio (#7F7F7F)**;
  - letra centralizada em **cinza-claro (#A6A6A6), 6 pt**;
  - interior branco.

  Assim, uma bolha vazia "pesa" pouco na binarização, e uma bolha cheia pesa muito.
- **Rodapé** (y de 279 a 287, entre os marcadores inferiores): "Não dobre nem amasse este cartão • Imprima só na frente • SanarFlix Academy", em 6 pt cinza.
- **Proibido na área de leitura:** linhas-guia, zebrado, logos, numeração de página, texto decorativo.
- **Impressão:** só frente, 100% de escala (sem "ajustar à página"), papel A4 75–90 g/m².

### 5.3 Instruções de digitalização (vão para as IES)
- Resolução de **200 a 300 dpi**, em tons de cinza ou colorido, num **único PDF com várias páginas**.
- Desligar "auto-aprimorar", "remover fundo" e "compressão máxima".
- Cartões na mesma orientação e sem grampos.
- Foto de celular não é suportada na V0. Se vier, a página tende a cair em Pendências.

## 6. Arquitetura da V0
```
João recebe PDF (Slack/Notion)
        │
        ▼
cartao-omr processar <pdf> --simulado <id> [--saida <pasta>]
        │
        ├─ lê do Supabase (papel somente leitura): simulado, questões, roster das IES
        ├─ por página: render → marcadores → homografia → QR → OMR (respostas + matrícula)
        ├─ identificação: QR(user_id) │ matrícula → roster │ senão pendência
        └─ escreve runs/<data>_<simulado>/
              respostas_<simulado>.xlsx   (aba 1 "Respostas" no formato da importação)
              recortes/pagina_<n>.png      (só páginas com pendência)
              relatorio.json
        ▼
João revisa a aba "Pendências", corrige a aba "Respostas" e importa pela tela atual (dry-run → commit)
```

**Outros comandos:**
- `cartao-omr gerar-cartoes --simulado <id> [--genericos 30]`: gera **um PDF para impressão**, com um cartão personalizado por aluno do roster (ordenado por nome) e N cartões genéricos no fim.
- `cartao-omr modelo`: gera um PDF de exemplo e o `templates/sfa_v1.json`.

**Estrutura:**
```
services/cartao-omr/
  cartao_omr/      cli.py (typer), layout.py (constantes mm), card.py (gerador PDF + template),
                   pipeline/{render,align,qr,omr}.py, identity.py, roster.py (psycopg, só SELECT),
                   export_xlsx.py, config.py, models.py
  templates/       sfa_v1.json
  tools/           make_fixtures.py, eval_accuracy.py
  tests/           fixtures/ (sintéticas), test_*.py
  runs/            (gitignored)
  .env.example, pyproject.toml, README.md (instalação no Windows + runbook)
```

## 7. Contratos

### 7.1 Template `templates/sfa_v1.json`
```json
{
  "template_version": "sfa_v1",
  "page_mm": [210, 297],
  "fiducials_mm": {"tl":[x,y,w], "tr":[...], "bl":[...], "br":[...], "orient":[x,y,w]},
  "qr_box_mm": [x0,y0,x1,y1],
  "alternatives": ["A","B","C","D"],
  "questions": {"1": {"A":[cx,cy,d], "B":[...], "C":[...], "D":[...]}, "...": {}, "100": {}},
  "matricula": {"columns": 12, "bubbles": [[{"digit":0,"c":[cx,cy,d]}, "..."], "..."]},
  "crops_mm": {"nome":[x0,y0,x1,y1], "matricula":[x0,y0,x1,y1]}
}
```
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
   - Validar o prefixo `SFA1` e o `simulado_id` contra `--simulado`. Se o simulado for outro, a página vira `simulado_divergente` e não é lida.
   - Se o QR não for lido mas os marcadores forem, segue como genérico e registra a pendência `qr_ilegivel`.
5. **OMR (respostas e matrícula):**
   - Para cada bolha, medir a fração de pixels escuros num círculo de 70% do diâmetro, depois de uma binarização adaptativa.
   - Normalizar pela mediana das bolhas vazias da própria página.
   - Classificar cada questão (ou coluna da matrícula):
     - **marcada:** maior score `≥ T_ALTO`, segundo `< T_BAIXO` e diferença `≥ GAP_MIN`;
     - **branco:** nenhuma bolha `≥ T_BAIXO` (resposta vazia);
     - **multipla:** duas ou mais bolhas `≥ T_ALTO`;
     - **ambigua:** qualquer outro caso.
   - Os limiares iniciais saem da calibração da Fase 1 e ficam no `config.py`.
6. **Matrícula:**
   - Concatenar as colunas, ignorando as colunas em branco **à direita**.
   - Uma coluna em branco no meio, ou uma coluna `multipla`/`ambigua`, torna a matrícula `matricula_invalida`.

### 7.3 Identificação (determinística)
1. **QR personalizado (`U`):** o `user_id` precisa estar no roster das IES do simulado. Se não estiver, a página vira `aluno_fora_do_roster`.
2. **Genérico (`G`) ou QR ilegível:**
   - Normalizar a matrícula lida (maiúsculas, só `[A-Z0-9]`, sem zeros à esquerda) e fazer **match exato** com `matricula_ra` normalizada.
   - O candidato tem que ser único.
   - Zero candidatos ou mais de um viram `aluno_nao_identificado`.
   - Não usar aproximação: matrícula em bolha não tem "erro de leitura de letra", e aproximar arriscaria trocar alunos.
3. **Duplicidade:** o mesmo aluno em mais de uma página vira `aluno_duplicado` em **todas** essas páginas.

### 7.4 Saída: `respostas_<simulado>.xlsx`
A ordem das abas importa: a tela de importação lê **só a primeira**.

1. **`Respostas`** (primeira aba, no formato da importação atual):
   - **Colunas:** `email`, seguido **apenas** dos números de questão que existem no simulado (`coalesce(numero_questao, ordem)`, em ordem crescente). As colunas opcionais `tempo_minutos`, `saidas_aba` e `finalizado_em` **não** são incluídas; o admin informa a data padrão na importação.
   - **Linhas:** uma por aluno identificado e não duplicado. O valor é `A`–`D` ou vazio.
   - **Questões `multipla`/`ambigua`:** a célula fica vazia, com **fundo amarelo** e um comentário (`múltipla` ou `ambígua`, página N). O João decide e preenche.
2. **`Pendências`**: uma linha por problema, com as colunas `pagina | tipo | questao | detalhe | recorte`.
   - **tipos:** `aluno_nao_identificado`, `aluno_duplicado`, `aluno_fora_do_roster`, `matricula_invalida`, `qr_ilegivel`, `multipla`, `ambigua`, `pagina_ilegivel`, `simulado_divergente`.
   - O `recorte` é o caminho relativo do PNG em `recortes/`.
3. **`Não identificados`**: as páginas sem aluno, com as respostas completas e a coluna `email` vazia. Depois de identificar o aluno pelo recorte do nome, o João preenche o email e move a linha para `Respostas`.
4. **`Resumo`**:
   - simulado, IES, data e hora da execução;
   - total de páginas, em branco, ilegíveis, identificadas (por QR / por matrícula) e não identificadas;
   - total de questões marcadas, em branco, múltiplas e ambíguas;
   - versão do `cartao-omr` e limiares usados.

`relatorio.json` traz os mesmos dados, legíveis por máquina, para a V1.

## 8. Fases da V0

### Fase 0 — Cartão SFA: gerador, template e fixtures
- **Objetivo:** gerar o cartão e o template por código, e um conjunto de fixtures sintéticas realistas.
- **Entregáveis:**
  - Pacote `services/cartao-omr/` com `pyproject.toml`, README (instalação no Windows com `py -m venv`), `.gitignore` e `.env.example`.
  - `layout.py` e `card.py`:
    - gera o PDF do cartão **personalizado** e do **genérico** conforme a seção 5.2;
    - gera o `templates/sfa_v1.json`;
    - comando `cartao-omr modelo`.
  - `gerar-cartoes` **sem banco** nesta fase: aceita um CSV de roster falso (`user_id,nome`) para testes. A ligação com o banco fica na Fase 2.
  - `tools/make_fixtures.py`, que simula cartões preenchidos e digitalizados:
    - bolhas preenchidas por caneta preta/azul com cobertura de 60–100%;
    - marcas fracas, duplas e rasuradas, X e ✓;
    - questões em branco e matrícula preenchida;
    - rotação de ±5° e 180°, escala de 95–105%, translação, leve perspectiva, ruído, JPEG e 150/200/300 dpi;
    - páginas em branco intercaladas;
    - PDFs com várias páginas e gabarito em JSON.
  - **Consulta somente leitura** em produção, que vai para o handoff:

    ```sql
    select i.nome,
           count(*) filter (where nullif(trim(matricula_ra), '') is not null) as com_matricula,
           max(length(trim(matricula_ra))) as max_len,
           bool_and(trim(matricula_ra) ~ '^[0-9]+$')
             filter (where nullif(trim(matricula_ra), '') is not null) as so_digitos
    from users u
    join ies i on i.id = u.id_ies
    group by i.nome
    order by i.nome;
    ```

    - **Usar o resultado para definir N** (o número de colunas da matrícula). Se algum `so_digitos` vier `false`, **parar e reportar** ao João: a grade de matrícula só cobre dígitos.
- **Testes:**
  - o template tem 400 bolhas de resposta e N×10 de matrícula;
  - não há sobreposição entre bolhas;
  - as bolhas, o QR e o bloco de matrícula ficam dentro da área útil;
  - o QR gerado é lido de volta pelo `zxing-cpp`.
- **Aceite:** testes verdes e o PDF de exemplo aberto e conferido visualmente pelo João, com o arquivo anexado ao handoff.
- **Portões:** nenhum (só leitura).

### Fase 1 — Pipeline de leitura (go/no-go)
- **Entregáveis:**
  - `pipeline/render.py`, `align.py`, `qr.py` e `omr.py`, conforme a seção 7.2. São funções puras, sem banco.
  - `tools/eval_accuracy.py`: roda o pipeline sobre as fixtures e mede o acerto por bolha, o acerto da matrícula, a leitura do QR, as páginas ilegíveis e a matriz de confusão das classes (marcada/branco/múltipla/ambígua).
  - Calibração de `T_ALTO`, `T_BAIXO` e `GAP_MIN`, registrada no `config.py` e no handoff.
- **Aceite (nas fixtures):**
  - acerto por bolha ≥ **99,8%**;
  - **0** `multipla` lida como letra;
  - matrícula correta ≥ **99,5%**;
  - QR lido ≥ **99%**;
  - páginas ilegíveis ≤ **0,5%** com rotação de até ±5°.
- **No-go:** se o aceite não for atingido depois da calibração, parar e reportar com números e exemplos. Não seguir para a Fase 2.

### Fase 2 — Identificação, roster e planilha de saída
- **Portão de produção:** com aprovação explícita do João, criar o papel `cartao_omr_reader` por migration aditiva em `supabase/migrations/<ts>_cartao_omr_reader.sql`:
  - `LOGIN`, senha forte informada pelo João fora do Git;
  - `GRANT SELECT` só em `simulados_admin(id, nome, ies_ids)`, `questoes_simulado(simulado_id, numero_questao, ordem)`, `users(id, nome, email, id_ies, matricula_ra)` e `ies(id, nome)`;
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
  - identificação: QR válido, QR de outro simulado, `user_id` fora do roster, matrícula exata, matrícula com zeros à esquerda, matrícula ausente no roster, matrícula repetida no roster, aluno duplicado;
  - xlsx: a 1ª aba se chama `Respostas`, tem só as colunas das questões do simulado e as células de pendência ficam amarelas;
  - **compatibilidade com a importação atual:** um teste que lê a aba 1 com as mesmas regras de `src/components/admin/simulados/ImportarRespostasTab.tsx` (cabeçalho de email, colunas numéricas) e confirma que nada é rejeitado. Implementar em Python, espelhando as regex daquele arquivo.
- **Aceite:** testes verdes; uma execução ponta a ponta sobre as fixtures, contra um simulado real em modo leitura, gerando um xlsx que o João abre e confere.

### Fase 3 — Piloto real e runbook
- **Insumos do João:**
  - um simulado de teste;
  - cartões impressos (personalizados + genéricos) e preenchidos por voluntários, com **gabarito conhecido**;
  - digitalização num scanner comum, em 200 e 300 dpi.
- **Entregáveis:**
  - execução real e comparação com o gabarito;
  - ajuste fino dos limiares, se necessário;
  - `README.md` com o **runbook da V0**: instalação, `.env`, como gerar os cartões de um simulado, como processar um PDF, como revisar as Pendências e como importar pela tela (dry-run → commit);
  - um **guia de 1 página para as IES** (impressão e digitalização, seções 5.2 e 5.3), em `docs/prd/cartoes-resposta-guia-ies.md`.
- **Validação da importação:**
  - Rodar o dry-run na tela de importação com o xlsx gerado. O esperado é zero `user_not_found` e zero `invalid_question_numbers`.
  - **O commit real só com autorização do João**, e num simulado de teste.
- **Aceite:**
  - acerto por bolha ≥ 99,5% no material real;
  - 100% dos cartões personalizados identificados;
  - relatório salvo no handoff.

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
- **Evoluções possíveis:**
  - importação automática via `admin-import-simulado-responses` (exige o N8N autenticado como admin);
  - tela no Academy para gerar os cartões e acompanhar o processamento.

## 10. Riscos
| Risco | Mitigação |
|---|---|
| A IES imprime fora de escala ou em frente e verso | O guia da Fase 3; os marcadores e a homografia toleram escala; página ilegível vai para Pendências. |
| Aluno sem cadastro ou sem matrícula usa o cartão genérico | Pendência com recorte do nome; o João atribui o email na aba `Não identificados`. |
| Matrícula com letras em alguma IES | Consulta da Fase 0. Se aparecer, parar e redesenhar o bloco (ex.: bolhas alfanuméricas) antes de seguir. |
| A IES continua usando o cartão antigo | Fora da V0: esses cartões seguem o processo manual. Relacionamento comunica o novo modelo. |
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
- Importação atual (front): `src/components/admin/simulados/ImportarRespostasTab.tsx` (parser, regex do cabeçalho de email e `downloadTemplate`) e `importar-respostas-types.ts`.
- Importação atual (edge): `supabase/functions/admin-import-simulado-responses/index.ts` (`normalizeResposta`, `validateRow`). **Não alterar.**
- Tabelas lidas: `simulados_admin` (`ies_ids`), `questoes_simulado` (`numero_questao`, `ordem`), `users` (`email`, `nome`, `id_ies`, `matricula_ra`) e `ies`.
- Default ACL do projeto: um papel novo precisa de `GRANT`s explícitos e mínimos. Conferir pela `information_schema.role_table_grants` / `column_privileges`.
