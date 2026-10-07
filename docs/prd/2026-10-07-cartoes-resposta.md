# PRD — Correção automática de cartões-resposta (PDF → importação de respostas)

- **Produto:** SanarFlix Academy (repo `sanarflix-study-guide`)
- **Escopo deste PRD:** back-end. O front fica para um PRD posterior.
- **Autor:** João Nader (com Claude)
- **Data:** 07/10/2026
- **Status:** aprovado para implementação
- **Executor previsto:** Claude Code com Sonnet 5.5, **uma fase por sessão**.

## 1. Contexto e problema
As respostas dos simulados presenciais entram no Academy pela aba **Importar respostas**: `/admin/simulados?tab=importar`. Essa aba espera uma planilha com `email | 1..N | tempo_minutos | saidas_aba | finalizado_em`.

A maioria das IES aplica os cartões, escaneia e já manda a planilha. Algumas mandam só os **cartões escaneados em PDF**, e a equipe transcreve à mão para o Excel. Isso é lento, caro e sujeito a erro.

**Objetivo:** o admin escolhe o simulado e envia o PDF com os cartões. O sistema lê as marcações e identifica os alunos. Depois devolve as linhas **no formato exato da importação atual**. O admin revisa, corrige o que o sistema marcou como dúvida e importa pelo fluxo que já existe (dry-run → commit).

**Princípio de custo:** a LLM entra **só onde é indispensável**, isto é, na leitura de texto manuscrito. Bolhas são lidas por visão computacional determinística (OMR). Bolha duvidosa vai para revisão humana, **não** para a LLM.

## 2. Fora de escopo
- Telas e UX. O back-end só precisa expor a API completa para o front futuro.
- Alterar o fluxo atual de importação. A função `admin-import-simulado-responses` e a RPC `admin_import_responses_batch` **não são tocadas**.
- Alternativa E. O cartão só tem A–D.
- Correção ou nota no cartão. O campo NOTA é ignorado.
- Popular `users.matricula_ra` nas IES que não têm. É ação operacional, listada como pendência.

## 3. Decisões já tomadas (não reabrir)
| Tema | Decisão |
|---|---|
| Onde roda o OMR | **Worker Python** (FastAPI + PyMuPDF + OpenCV) no Cloud Run. A Edge Function só orquestra. |
| Cartão | O modelo atual (**v1**) continua aceito. Haverá um modelo **v2**, com marcadores de canto, QR e matrícula em bolhas. |
| Identificação do aluno | Matrícula escrita no campo **Nº**, cruzada com `users.matricula_ra` dentro das IES do simulado. Fallback: **NOME** manuscrito, por similaridade. Se ficar ambíguo, o admin resolve. |
| LLM | Gemini Flash pelo **gateway Lovable** (`LOVABLE_API_KEY`, endpoint OpenAI-compatível `https://ai.gateway.lovable.dev/v1/chat/completions`). Não criar credencial de outro provedor. |
| Saída | O mesmo `rows[]` aceito por `admin-import-simulado-responses`. Opcionalmente, também um `.xlsx` no template atual. |

## 4. Regras de trabalho (valem para todas as fases)
1. **Branch:**
   - Todo trabalho acontece na branch de feature criada pelo João. **Nunca commitar, mergear ou dar push na `main`.** O Lovable publica a `main` em produção automaticamente.
   - Antes de começar: `git branch --show-current`. Se for `main`, parar e perguntar.
   - Logo depois, no início de toda sessão: `git fetch origin && git merge origin/main` (a `main` recebe commits do Lovable várias vezes por dia). Se o merge trouxer migrations novas, regenerar `src/integrations/supabase/types.ts` com `generate_typescript_types` — nunca resolver esse arquivo à mão. Se houver conflito fora de `types.ts`, parar e perguntar.
   - Antes de dar push: `git fetch` e, se o remoto andou, `git pull --rebase`. **Nunca `push --force`.**
2. **Uma fase por sessão.** Não adiantar trabalho de outra fase. Se descobrir algo que pertence a outra fase, registrar na seção "Notas para a próxima fase" do relatório de handoff.
3. **Ações em produção são portões explícitos.** Só existe um projeto Supabase, o de produção: ref `gvqvrmkizemwsasmupmo`. Confirmar o ref antes de qualquer chamada. Exigem **pedido explícito de aprovação ao João, na hora**:
   - `apply_migration`
   - deploy de Edge Function
   - criação de bucket
   - secrets
   - deploy no Cloud Run

   O código fica pronto e commitado na branch independentemente da aprovação. Se a ferramenta for barrada pelo classificador do modo automático, **não contornar** com `execute_sql`; avisar o João para trocar o modo de permissão.
4. **Somente aditivo.** Nenhuma alteração em tabela, função, policy ou edge function que já exista.
5. **Permissões de tabela nova.** Tabela nova nasce com privilégio total para `anon` e `authenticated` (default ACL do projeto). Toda tabela nova precisa de:

   ```sql
   revoke all on <tabela> from public, anon, authenticated;
   ```

   Revogar só de `public, anon` **não basta**.
6. **Não usar RPC com `has_role(auth.uid(), ...)` a partir de cliente service role.** `auth.uid()` é nulo nesse contexto. A checagem de admin é feita na Edge Function: JWT → `getAuthenticatedUser` → `has_role`. Depois disso, acessar as tabelas direto com service role.
7. **Testes:**
   - A suíte do front deve continuar verde: `npm run test:run`, baseline 385/385.
   - O lint tem cerca de 3.100 erros pré-existentes e **não** serve como critério. Só não introduzir erros novos nos arquivos tocados.
   - O worker tem a própria suíte `pytest`.
8. **Fim de sessão (obrigatório):**
   1. Rodar os testes da fase.
   2. Commitar com mensagem `feat(cartoes): fase N — <resumo>`.
   3. Criar a tag anotada `cartoes-fase-N`.
   4. Dar push da branch e da tag. Antes, perguntar ao João se pode dar push.
   5. Escrever `docs/prd/cartoes-resposta-handoff/fase-N.md` com: o que foi feito, decisões tomadas, desvios do PRD, pendências, portões de produção ainda não executados e "Notas para a próxima fase".
   6. **Gerar o prompt de início da fase N+1** no formato da seção 12 e mostrá-lo ao João no fim da resposta.
   7. Listar os próximos passos separados em "meus (Claude)" e "do João".

## 5. O cartão (fatos que orientam a implementação)
- **Arquivo modelo:** `cartao_de_respostas_simulado_E_ENAMED_2026.pdf`, A4 retrato e **vetorial**. Copiar para `services/cartao-omr/templates/source/enamed_v1.pdf` na Fase 0.
- **Cabeçalho:** retângulo com faixa azul (`CARTÃO DE RESPOSTAS | SIMULADO`). Linha `NOME:`. Linha `Nº: | TURMA: | NOTA:`.
- **Grade:** 100 questões em **4 colunas de 25** (1–25, 26–50, 51–75, 76–100). Cada questão tem 4 bolhas `Ⓐ Ⓑ Ⓒ Ⓓ`.
- **Não há** marcadores de canto, QR nem matrícula estruturada. O alinhamento do v1 depende do retângulo azul e da própria grade.
- **Os glifos são texto no PDF.** O PyMuPDF extrai a posição de cada `Ⓐ–Ⓓ` e de cada número 1–100, o que dá as coordenadas exatas das bolhas sem medição manual.
- **Cobertura de `users.matricula_ra`** em produção (07/10/2026, preenchidos/total):
  - Bem preenchida: UNIFIP 699/749, PARACATU 512/609, SETE LAGOAS 288/317, PASSOS 401/571, VALENÇA 168/189, SORRISO 124/145, PORTO SEGURO 103/124, UVA 26/31.
  - Parcial: Funepe 136/406, UNIVILLE 39/108.
  - Quase vazia: Fame 30/1027, Famp 10/973, Integrado 7/842.
  - Zerada: UEA, Claretiano, USCS (3 campi), FAI.

  Por isso o fallback por nome é obrigatório.

## 6. Arquitetura
```
Admin ──(JWT)──► Edge fn admin-cartoes-resposta ──signed upload URL──► Storage: cartoes-resposta/ (privado)
                        │ start (X-Worker-Secret)                           ▲
                        ▼                                                   │ baixa PDF, grava PNGs
                 Worker cartao-omr (Cloud Run, Python) ─────────────────────┘
                   render → alinhamento → OMR → recorte cabeçalho
                        │ (só v1, ou v2 sem match por matrícula)
                        ▼
                 Gateway Lovable / Gemini Flash — 1 chamada por página, só o recorte do cabeçalho
                        │
                        ▼
                 matching determinístico com o roster das IES → upsert cartao_import_pages
Admin: get_review → update_page (correções) → export → rows[] / xlsx
     → fluxo atual admin-import-simulado-responses (dry-run → commit), SEM alteração
```

**Estrutura de pastas nova** (dentro de `sanarflix-study-guide/`):
```
services/cartao-omr/
  app/            main.py (FastAPI), pipeline/ (render.py, align.py, omr.py, crops.py),
                  identity/ (llm.py, matching.py), storage.py, db.py, config.py, models.py
  templates/      source/enamed_v1.pdf, enamed_v1.json, (fase 6) enamed_v2.json
  tools/          build_template.py, make_fixtures.py, eval_accuracy.py
  tests/          test_template.py, test_omr.py, test_align.py, test_matching.py, test_llm.py, test_api.py, fixtures/
  Dockerfile, pyproject.toml (ou requirements.txt), README.md
supabase/functions/admin-cartoes-resposta/index.ts
supabase/migrations/<timestamp>_cartoes_resposta.sql
src/test/unit/cartoesRespostaMigration.test.ts
docs/prd/2026-10-07-cartoes-resposta.md (este arquivo), docs/prd/cartoes-resposta-handoff/fase-N.md
```

## 7. Contratos

### 7.1 Template (`templates/enamed_v1.json`)
```json
{
  "template_version": "enamed_v1",
  "page_size_pt": [595.28, 841.89],
  "alternatives": ["A","B","C","D"],
  "questions": { "1": {"A":[x,y,r], "B":[...], "C":[...], "D":[...]}, "...": {}, "100": {} },
  "anchors": { "header_box": [x0,y0,x1,y1], "grid_box": [x0,y0,x1,y1], "question_number_centers": {"1":[x,y], "25":[x,y], "76":[x,y], "100":[x,y]} },
  "crops": { "nome": [x0,y0,x1,y1], "numero": [x0,y0,x1,y1], "header": [x0,y0,x1,y1] }
}
```
As coordenadas ficam em pontos PDF, com origem no topo-esquerdo. `r` é o raio interno útil, cerca de 70% do raio do glifo, para não contar o contorno impresso.

### 7.2 Banco: tabelas novas
**`public.cartao_import_jobs`**
| coluna | tipo | regra |
|---|---|---|
| id | uuid pk default gen_random_uuid() | |
| simulado_id | uuid not null → simulados_admin(id) | |
| status | text not null default 'awaiting_upload' | check in (`awaiting_upload`,`uploaded`,`processing`,`review`,`exported`,`failed`) |
| pdf_path | text not null | `jobs/<job_id>/source.pdf` |
| template_version | text null | detectado pelo worker |
| total_pages / processed_pages | int not null default 0 | |
| llm_calls | int not null default 0 | |
| error | text null | |
| created_by | uuid not null → auth.users | |
| created_at / updated_at / started_at / finished_at | timestamptz | |

**`public.cartao_import_pages`**
| coluna | tipo | regra |
|---|---|---|
| id | uuid pk | |
| job_id | uuid not null → cartao_import_jobs on delete cascade | |
| page_number | int not null | começa em 1. `unique(job_id, page_number)` |
| status | text not null | check in (`ok`,`needs_review`,`unmatched`,`error`) |
| image_path / header_crop_path | text | `jobs/<job_id>/pages/<n>.png`, `jobs/<job_id>/crops/<n>_header.png` |
| align_method / align_score | text / numeric | ex.: `v1_header_grid`, 0–1 |
| answers | jsonb not null default '{}' | `{"1":"A","2":null,...}` com as 100 chaves |
| bubble_flags | jsonb not null default '{}' | só as questões com problema: `{"17":"multiple","40":"ambiguous"}` (valores: `blank`,`multiple`,`ambiguous`) |
| bubble_scores | jsonb | `{"17":[0.62,0.58,0.05,0.03],...}` só nas questões com flag, para auditoria |
| matricula_lida / nome_lido | text | |
| llm_used | boolean not null default false | |
| user_id | uuid null → users(id) | |
| match_method | text null | check in (`matricula_exata`,`matricula_aprox`,`nome`,`manual`) |
| match_score | numeric null | |
| match_candidates | jsonb | até 3 candidatos `{user_id,nome,matricula_ra,score}` quando ambíguo |
| answers_override | jsonb not null default '{}' | correções do admin, por questão |
| review_notes | text | |
| reviewed_by / reviewed_at | uuid / timestamptz | |
| created_at / updated_at | timestamptz | |

**Índices, RLS e permissões:**
- Índice em `cartao_import_pages(job_id, status)`.
- RLS habilitada nas duas tabelas, com policies `select/insert/update/delete` só para `has_role(auth.uid(),'admin')`.
- `revoke all ... from public, anon, authenticated`.
- `grant select on ... to authenticated` só se o front for ler direto. **Não conceder agora**: o front vai pela Edge Function.
- Trigger `updated_at` (reaproveitar a função existente, se houver; conferir nas migrations).

**Bucket `cartoes-resposta`:**
- Privado, limite de 100 MB.
- MIME permitidos: `application/pdf`, `image/png`.
- Policies de `storage.objects` só para admin (`has_role`).
- Upload pelo admin via signed upload URL. Worker e Edge usam service role.

### 7.3 Edge Function `admin-cartoes-resposta`
`POST` com JSON `{ action, ... }`. Seguir o padrão de `supabase/functions/admin-import-simulado-responses/index.ts`:
- gatekeep de CORS com `_shared/cors.ts`;
- `OPTIONS`;
- JWT via `_shared/auth.ts`;
- admin via `has_role`;
- respostas via `_shared/response.ts`;
- zod para validar o corpo.

| action | entrada | efeito | saída |
|---|---|---|---|
| `create_job` | `{simulado_id}` | Valida o simulado (ver abaixo), cria o job e gera uma signed upload URL para `jobs/<id>/source.pdf`. | `{job_id, upload_url, token, path, warnings[]}` |
| `start` | `{job_id}` | Exige o status `awaiting_upload`, `uploaded` ou `failed` e confere se o objeto existe. Muda para `processing` e chama `POST {CARTAO_WORKER_URL}/jobs/{job_id}/process` com o header `X-Worker-Secret` e timeout de 10s, esperando 202. Se falhar, volta o status para `failed` com `error`. | `{status}` |
| `status` | `{job_id}` | Lê o job e as contagens por `status` das páginas. | `{job, counts:{ok,needs_review,unmatched,error}}` |
| `get_review` | `{job_id, filter?: status[], page?: int, page_size?: int≤50}` | Lista as páginas. Para as que têm `needs_review` ou `unmatched`, inclui signed URLs (10 min) da imagem e do recorte. | `{pages[], total}` |
| `search_students` | `{job_id, q}` | Busca alunos das IES do simulado por nome, email ou matrícula (limite 20) para o casamento manual. | `{students[]}` |
| `update_page` | `{page_id, user_id?: uuid\|null, answers_override?: {"n": "A"\|"B"\|"C"\|"D"\|null}, review_notes?}` | Valida que o `user_id` pertence às IES do simulado e que as chaves estão entre 1 e 100 com valores válidos. Grava `match_method='manual'` quando o `user_id` muda, além de `reviewed_by` e `reviewed_at`. Recalcula o `status`. | `{page}` |
| `reprocess_page` | `{page_id}` | Chama `POST {worker}/jobs/{job_id}/pages/{n}/process`. | `{status}` |
| `export` | `{job_id, format?: 'json'\|'xlsx', include_unresolved?: false}` | Monta o `rows[]` (regras em 7.5). Com `xlsx`, gera o arquivo no layout de `downloadTemplate` (sheet `Respostas`), salva em `jobs/<id>/export.xlsx` e devolve uma signed URL. Muda o job para `exported`. | `{rows[], excluded[], warnings[], xlsx_url?}` |

**Validações do `create_job`:**
- o simulado existe;
- as questões vêm de `questoes_simulado` (consulta direta, **não** pela RPC `admin_simulado_question_map`);
- `count ≤ 100`;
- aviso se alguma questão tem `alternativa_e` não nula, porque o cartão não representa E;
- aviso se `modalidade <> 'presencial'`.

**Secrets da Edge:** `CARTAO_WORKER_URL`, `CARTAO_WORKER_SECRET`.

**Registro:** gravar em `admin_audit_log` as ações `cartoes_create_job`, `cartoes_start`, `cartoes_update_page` e `cartoes_export`.

### 7.4 Worker `cartao-omr`
- **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_SECRET`, `LOVABLE_API_KEY`, `LLM_MODEL=google/gemini-3.6-flash`, `LLM_CONCURRENCY=5`, `RENDER_DPI=200`, `OMR_T_HIGH`, `OMR_T_LOW`, `OMR_MIN_GAP`.
- **Endpoints:**
  - `GET /health`.
  - `POST /jobs/{job_id}/process`: confere o secret e responde 202. O processamento roda via `BackgroundTasks`, por isso o Cloud Run precisa de "CPU sempre alocada".
  - `POST /jobs/{job_id}/pages/{n}/process`.
  - (Fase 6) `POST /render-card {simulado_id}` → PDF do cartão v2.
- **Pipeline de um job:**
  1. Baixar o PDF.
  2. Gravar `total_pages`.
  3. Carregar uma vez as questões do simulado e o roster: `users` com `id_ies = ANY(simulados_admin.ies_ids)`, colunas `id, nome, email, matricula_ra`.
  4. Para cada página, em sequência:
     - renderizar e alinhar;
     - rodar o OMR;
     - recortar o cabeçalho e fazer o upload dos PNGs;
     - fazer a identificação (LLM com concorrência limitada);
     - aplicar o matching;
     - fazer upsert em `cartao_import_pages`;
     - incrementar `processed_pages`.
  5. Pós-processamento: detectar o mesmo `user_id` em mais de uma página. Todas essas páginas viram `needs_review`, com o motivo em `review_notes`.
  6. Fechar o job em `review` (ou `failed`, com o `error`).
- **Robustez:**
  - Um erro numa página marca só ela como `error` e o job continua.
  - Reprocessar é idempotente (upsert).
  - Limite de 500 páginas por job.
- **Status da página:**
  - `error`: falha de alinhamento ou de leitura.
  - `unmatched`: sem `user_id`.
  - `needs_review`: há `bubble_flags` do tipo `multiple` ou `ambiguous`, ou match por nome com score abaixo de 95, ou match ambíguo/duplicado.
  - `ok`: todo o resto. `blank` sozinho **não** gera revisão, porque questão em branco é legítima.

### 7.5 Regras de export → `rows[]`
O formato é o aceito por `admin-import-simulado-responses`:
```json
{ "email": "aluno@x.com", "answers": { "1": "A", "2": null, "...": "..." } }
```
- **Entram** as páginas com `user_id` e `status` diferente de `error` e de `unmatched`. Páginas `needs_review` **sem** `reviewed_at` ficam em `excluded`, a menos que `include_unresolved=true`.
- **Resposta final** de cada questão: `answers_override[n]` se existir, senão `answers[n]`. Questão com flag `multiple` ou `ambiguous` sem override sai `null` e gera um `warning`.
- Só entram os números de questão **que existem no simulado** (`coalesce(numero_questao, ordem)`). As chaves 1–100 que sobram são descartadas; caso contrário a importação daria `invalid_question_numbers`.
- `email` vem de `users.email` (lower e trim).
- **Não** enviar `tempo_segundos` nem `finalizado_em`. O admin informa `default_finalizado_em` na importação atual.
- Se o mesmo `email` aparecer duas vezes, as duas páginas vão para `excluded` com o motivo `duplicate_user`.
- `excluded[]` tem a forma `{page_id, page_number, reason}`, com `reason` ∈ `unmatched`, `error`, `needs_review`, `duplicate_user`.

### 7.6 Algoritmos
**Alinhamento v1:**
1. Converter para escala de cinza e binarizar.
2. Achar o retângulo azul do cabeçalho por máscara HSV, faixa azul em torno de `#4A6FB5` (calibrar), e pegar o maior contorno retangular.
3. Achar os centros dos números 1, 25, 76 e 100 (blobs escuros na posição esperada depois de uma afim inicial pelo cabeçalho).
4. Estimar uma afim (ou homografia, se houver 4 pontos bons) do template para a imagem.
5. `align_score` é o resíduo médio normalizado. Abaixo do limiar, a página vira `error`.
6. Corrigir a rotação de 90° e 180°: se o cabeçalho não estiver no topo, girar e tentar de novo.

**OMR:**
- Para cada bolha, medir a fração de pixels escuros (binarização adaptativa local) dentro do círculo de raio `r`, descontando o contorno impresso. Usar a média das 400 bolhas da página como linha de base.
- A questão vale a letra quando o maior score é `≥ T_HIGH`, o segundo é `< T_LOW` e a diferença é `≥ MIN_GAP`.
- Nenhuma bolha `≥ T_LOW` → `blank` (resposta `null`).
- Duas ou mais `≥ T_HIGH` → `multiple` (`null`).
- Qualquer outro caso → `ambiguous` (`null`, com os scores salvos).
- Os limiares iniciais saem da calibração da Fase 0 e ficam no `config.py`.

**Identificação v1 (LLM):**
- **Uma** chamada por página, com **só o recorte do cabeçalho** (PNG de cerca de 1200 px de largura).
- Mensagem `user` com a imagem em data URL base64 e `tool_choice` forçado para a ferramenta `registrar_cabecalho`:
  ```json
  {"name":"registrar_cabecalho","parameters":{"type":"object","properties":{
    "matricula":{"type":["string","null"],"description":"conteúdo do campo Nº, só caracteres alfanuméricos, sem espaços"},
    "nome":{"type":["string","null"],"description":"nome completo como escrito no campo NOME"},
    "legivel":{"type":"boolean"}},"required":["matricula","nome","legivel"]}}
  ```
- **Prompt de sistema:** "Você transcreve texto manuscrito de cartões-resposta. Transcreva exatamente o que está escrito nos campos NOME e Nº. Não invente nem complete. Se um campo estiver vazio ou ilegível, devolva null."
- `temperature=0`, sem stream, timeout de 30s, 2 retries com backoff.
- Incrementar `llm_calls` no job.
- **A LLM não é chamada** quando o cabeçalho está em branco (fração de tinta no recorte abaixo do limiar). Nesse caso a página vira `unmatched`.

**Matching** (determinístico, `rapidfuzz`, roster carregado uma vez por job):
1. `norm_mat(s)` = maiúsculas, só `[A-Z0-9]`, sem zeros à esquerda.
2. Match exato de `norm_mat(matricula_lida)` com `norm_mat(matricula_ra)` e candidato único → `matricula_exata`, score 100.
3. Distância de Levenshtein ≤ 1, candidato único e `len ≥ 5` → `matricula_aprox`, score 95.
4. `norm_nome` = sem acento, minúsculas, espaços colapsados. `token_sort_ratio ≥ 90`, com margem ≥ 5 sobre o segundo colocado → `nome`, score = ratio.
5. Qualquer outro caso → sem `user_id`. Os 3 melhores vão em `match_candidates` e a página fica `unmatched`.

## 8. Fases

> Cada fase = uma sessão. Os critérios de aceite são obrigatórios para fechar a fase.

### Fase 0 — Template, fixtures e spike de OMR (go/no-go)
- **Objetivo:** provar que o OMR do cartão v1 funciona antes de construir infraestrutura.
- **Entregáveis:**
  - `services/cartao-omr/` com `pyproject`, as dependências (pymupdf, opencv-python-headless, numpy, rapidfuzz, pytest) e o README.
  - `tools/build_template.py`: lê `templates/source/enamed_v1.pdf` e gera `templates/enamed_v1.json`, com 100×4 bolhas, âncoras e recortes.
  - `tools/make_fixtures.py`:
    - Gera páginas sintéticas preenchidas a partir do PDF modelo:
      - marcas de caneta e de lápis, com intensidade variável;
      - marcas fracas, marcas duplas, rasuras e questões em branco;
      - NOME e Nº escritos com fonte manuscrita.
    - Aplica rotação de ±3°, escala de 95–105%, translação, ruído, compressão JPEG e cópias a 150/200/300 dpi.
    - Monta PDFs multipágina como um scanner faria.
    - Grava o gabarito de cada página em JSON.
  - `app/pipeline/` com render, alinhamento v1, OMR e recortes, como funções puras testáveis (sem Supabase).
  - `tools/eval_accuracy.py`: roda o pipeline sobre as fixtures e imprime o acerto por bolha, a taxa de flags e as páginas com `error`.
  - Testes `pytest`: o template tem 400 bolhas em 4 colunas; o alinhamento recupera transformações conhecidas; o OMR acerta as fixtures.
  - **Consulta somente leitura** em produção, com formato e tamanho de `matricula_ra` por IES:

    ```sql
    select i.nome, max(length(matricula_ra)),
           bool_and(matricula_ra ~ '^[0-9]+$')
    ...
    ```

    O resultado vai para o handoff; ele define o número de colunas de dígitos do v2.
- **Aceite:**
  - Acerto por bolha ≥ 99,5% nas fixtures.
  - **0** casos de `multiple` lidos como letra.
  - Páginas `error` ≤ 1% com rotação até ±3°.
  - Todos os testes verdes.
- **Se houver cartões reais preenchidos** disponíveis (o João vai tentar), rodar também sobre eles e reportar. Se não houver, registrar como pendência da Fase 5.
- **Portões de produção:** nenhum (só leitura).
- **No-go:** se o aceite não for atingido depois de calibrar, parar e reportar ao João com números e exemplos. Não seguir para a Fase 1.

### Fase 1 — Banco e Storage
- **Entregáveis:**
  - Migration `supabase/migrations/<ts>_cartoes_resposta.sql` com as tabelas, constraints, índices, RLS, policies, revokes, trigger `updated_at`, o bucket e as policies de storage (seção 7.2).
  - O timestamp deve ser posterior à última migration do repo.
  - `src/test/unit/cartoesRespostaMigration.test.ts`: teste estático no padrão de `hardeningFuncoesDePapel.test.ts`, lendo o SQL com `readFileSync`. Ele confere:
    - a presença do `revoke ... from public, anon, authenticated`;
    - RLS habilitada;
    - os checks de status;
    - o bucket privado;
    - a ausência de `alter`/`drop` em objetos existentes.
- **Portão:** `apply_migration` em produção **com aprovação explícita do João**. Depois de aplicar:
  - `list_tables` e `get_advisors` (security);
  - consulta a `information_schema.role_table_grants` mostrando que `anon` e `authenticated` não têm privilégios;
  - regenerar `src/integrations/supabase/types.ts` com `generate_typescript_types`, sem editar à mão.
- **Aceite:** testes verdes (suíte completa), advisors sem alerta novo nas tabelas `cartao_*`, grants conferidos.

### Fase 2 — Worker: serviço, Storage e escrita das páginas
- **Entregáveis:**
  - `app/main.py` (FastAPI) com `/health`, `/jobs/{id}/process` e `/jobs/{id}/pages/{n}/process`, autenticados por `X-Worker-Secret` (comparação em tempo constante).
  - `storage.py` e `db.py` (supabase-py com service role).
  - Orquestração do job (seção 7.4), **ainda sem LLM**: a identificação fica como stub e marca a página `unmatched`.
  - Upload dos PNGs, upsert das páginas, contadores, tratamento de erro por página, pós-processamento e fechamento do job.
  - Dockerfile (python slim, usuário não-root) e README com o deploy no Cloud Run: CPU sempre alocada, concorrência 1, timeout de 60 min, máximo de 3 instâncias, secrets via Secret Manager.
- **Testes:**
  - `test_api.py` com `TestClient` e os clientes Supabase mockados: secret inválido → 401; 202 no caminho feliz; idempotência do reprocessamento.
  - Teste de orquestração com o PDF de fixtures, verificando as linhas gravadas no mock.
- **Portão:** nenhum. O deploy acontece na Fase 5.
- **Aceite:** `pytest` verde; `docker build` funcionando localmente (se houver Docker; senão registrar).

### Fase 3 — Identificação: LLM do cabeçalho + matching
- **Entregáveis:**
  - `identity/llm.py`: cliente do gateway Lovable (seção 7.6), com payload e headers no mesmo contrato de `supabase/functions/_shared/ai.ts`, adaptado para imagem e sem stream.
  - `identity/matching.py`: algoritmo da seção 7.6.
  - Integração no pipeline, mais a regra de não chamar a LLM com o cabeçalho em branco.
- **Spike obrigatório no início da sessão:** uma chamada real ao gateway com uma fixture, confirmando que ele aceita imagem e `tool_choice`. Isso **exige `LOVABLE_API_KEY` local**, que o João fornece por variável de ambiente; nunca escrever a chave em arquivo versionado.
  - Se o gateway não aceitar imagem, **parar e reportar**. Não trocar de provedor por conta própria.
- **Testes:**
  - `test_matching.py`: exato, aproximado, nome com acento, empate (ambíguo), roster sem matrícula, matrícula com zeros à esquerda.
  - `test_llm.py` com HTTP mockado: parse da tool call, retry, timeout.
  - Um teste marcado `@pytest.mark.live`, que não roda por padrão, contra o gateway real.
- **Aceite:** testes verdes. No spike, as fixtures com manuscrito sintético têm ≥ 95% de matrícula correta. No máximo 1 chamada de LLM por página.

### Fase 4 — Edge Function `admin-cartoes-resposta`
- **Entregáveis:**
  - `supabase/functions/admin-cartoes-resposta/index.ts` com todas as actions da seção 7.3 e o export conforme 7.5, incluindo o xlsx no layout de `downloadTemplate` de `src/components/admin/simulados/ImportarRespostasTab.tsx`.
  - Extrair a lógica pura (validação, montagem de `rows[]`, regras de exclusão) para um módulo testável, por exemplo `supabase/functions/admin-cartoes-resposta/export.ts`.
  - Escrever um teste Vitest em `src/test/unit/cartoesExport.test.ts` importando esse módulo, se a importação Deno/esm permitir. Se não permitir, duplicar a função pura em `src/lib/cartoes/export.ts` **apenas** se ficar claro que o front também vai usá-la; caso contrário, testar com `deno test`.
- **Testes:**
  - montagem de `rows[]`: override tem prioridade; questões fora do simulado são descartadas; `multiple` vira `null`;
  - `duplicate_user` e `needs_review` não revisada vão para `excluded`;
  - validação das entradas de `update_page`.
- **Portão:** nenhum (o deploy fica para a Fase 5).
- **Aceite:** testes verdes; a suíte do front continua verde.

### Fase 5 — Deploy e validação ponta a ponta com cartões reais
- **Portões, cada um com aprovação explícita:**
  1. Deploy do worker no Cloud Run. O João informa o projeto GCP.
  2. Secrets do worker.
  3. Secrets da Edge (`CARTAO_WORKER_URL`, `CARTAO_WORKER_SECRET`).
  4. Deploy da Edge Function `admin-cartoes-resposta`. É função nova; nenhuma existente é tocada.
- **Validação ponta a ponta:**
  1. Usar um PDF real de cartões de uma IES que **também** tenha a planilha correspondente.
  2. Rodar `create_job` → upload → `start` → `status` até `review` → `get_review` → `update_page` em 1 caso → `export`.
  3. Comparar o `rows[]` com a planilha, questão a questão. Registrar:
     - divergências por bolha;
     - alunos não casados e o motivo;
     - `llm_calls` por página;
     - tempo total.
  4. Rodar o `rows[]` no **dry-run** de `admin-import-simulado-responses` com `dry_run: true`, **sem commit**.
     - Esperado: zero `user_not_found` e zero `invalid_question_numbers` entre as linhas exportadas.
     - O commit real só com autorização do João.
- **Segurança:**
  - chamada sem JWT → 401;
  - JWT de não-admin → 403;
  - worker sem secret → 401;
  - `anon` sem acesso às tabelas e ao bucket.
- **Aceite:** acerto por bolha ≥ 99% nos cartões reais; relatório do teste salvo no handoff.

### Fase 6 — Cartão v2 (marcadores, QR e matrícula em bolhas)
- **Entregáveis:**
  - Gerador do cartão v2 em `tools/render_card_v2.py` (reportlab ou PyMuPDF):
    - 4 marcadores quadrados pretos nos cantos;
    - QR com `simulado_id|enamed_v2`;
    - grade de matrícula com N colunas × 0–9 (N vem da Fase 0);
    - NOME manuscrito mantido;
    - a mesma grade de 100×A–D.
  - `templates/enamed_v2.json`, gerado do PDF v2 com o mesmo `build_template.py` estendido.
  - **Detecção de versão no pipeline:** se o QR for encontrado → v2, com homografia pelos 4 marcadores e matrícula lida por OMR, **sem LLM**. A LLM só é chamada se a matrícula lida não casar com o roster (fallback por nome). Sem QR → v1.
  - Validar o `simulado_id` do QR contra o job. Se divergir, a página vira `error` com o motivo.
  - Endpoint `/render-card` e action `render_card {simulado_id}` na Edge, que devolve uma signed URL do PDF.
  - Fixtures v2 e testes.
- **Portão:** redeploy do worker e da Edge, com aprovação.
- **Aceite:** com as fixtures v2, 0 chamadas de LLM nas páginas cuja matrícula está no roster; acerto da matrícula por OMR ≥ 99,5%.

## 9. Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Scan torto ou foto de celular no v1 | Alinhamento por cabeçalho + grade, `align_score` e página `error` para revisão. O v2 resolve na origem. |
| Matrícula ausente em IES inteiras | Fallback por nome; casamento manual via `search_students`; pendência operacional de popular `matricula_ra`. |
| Gateway Lovable sem suporte a imagem | Spike no início da Fase 3; parar e decidir com o João. |
| Simulado com menos de 100 questões ou com alternativa E | Validação no `create_job` (aviso) e descarte das chaves extras no export. |
| Custo da LLM | 1 chamada por página, só com o recorte do cabeçalho; zero chamadas no v2 com match. `llm_calls` é registrado. |
| Escrever em produção por engano | Somente aditivo; portões explícitos; revoke de `authenticated`; a importação real continua sendo uma ação manual do admin no fluxo atual. |
| Lovable sobrescrevendo a `main` | Nada desta feature vai para a `main` até a entrega. A branch absorve a `main` periodicamente (`git fetch origin && git merge origin/main`, depois regenerar `types.ts`). |

## 10. Métricas de sucesso
- Tempo do PDF recebido até as respostas importadas: menos de 15 minutos para 200 cartões, contra horas hoje.
- Acerto por bolha ≥ 99% em cartões reais.
- ≥ 90% das páginas `ok` sem intervenção nas IES com `matricula_ra` preenchida.
- Média de chamadas de LLM ≤ 1 por página no v1 e ≈ 0 no v2.

## 11. Pendências do João (fora das sessões)
- Arrumar 1 PDF real de cartões preenchidos + a planilha correspondente (necessário até a Fase 5; ideal já na Fase 0).
- Definir o projeto GCP / Cloud Run do worker (até a Fase 5).
- Fornecer `LOVABLE_API_KEY` por variável de ambiente local na Fase 3.
- Alinhar com design e pedagógico o layout do cartão v2 (até a Fase 6).
- Avaliar popular `matricula_ra` em UEA, Claretiano, USCS, FAI, Fame, Famp e Integrado.

## 12. Modelo do prompt de início de sessão
Ao fim da fase N, o modelo gera o prompt da fase N+1 **neste formato** e o mostra ao João:

```
Você vai executar a Fase {N+1} — {título} do PRD de correção de cartões-resposta do SanarFlix Academy.

Repo: sanarflix-study-guide (pasta "Academy Project"). Branch de trabalho: {branch}. Nunca commitar/pushar na main.
Supabase de produção: gvqvrmkizemwsasmupmo (confirme o ref antes de qualquer chamada).

Leia, nesta ordem, antes de qualquer ação:
1. docs/prd/2026-10-07-cartoes-resposta.md — seções 4 (regras), 7 (contratos) e a Fase {N+1} na seção 8.
2. docs/prd/cartoes-resposta-handoff/fase-{N}.md — o que a fase anterior entregou, desvios e notas.

Estado atual: {2–5 linhas: tag da última fase, o que existe, portões de produção já executados e pendentes}.
Atenção específica desta fase: {riscos/decisões herdadas, insumos que o João precisa fornecer}.

Execute só a Fase {N+1}. Peça aprovação explícita antes de qualquer ação em produção.
Ao final, siga a regra 8 da seção 4 (testes, commit, tag cartoes-fase-{N+1}, handoff, prompt da fase seguinte, próximos passos meus/do João).
```

**Prompt da Fase 0** (o primeiro, já pronto):
```
Você vai executar a Fase 0 — Template, fixtures e spike de OMR do PRD de correção de cartões-resposta do SanarFlix Academy.

Repo: sanarflix-study-guide (pasta "Academy Project"). Branch de trabalho: feat/cartoes-resposta — confirme com `git branch --show-current` e pare se for main.
Supabase de produção: gvqvrmkizemwsasmupmo (nesta fase, só consultas de leitura).

Leia antes de qualquer ação: docs/prd/2026-10-07-cartoes-resposta.md — seções 4, 5, 6, 7.1, 7.6 e a Fase 0 na seção 8.
O cartão modelo está em "C:\Users\joao.nader\OneDrive - Editora Sanar S.A\Documentos\cartao_de_respostas_simulado_E_ENAMED_2026.pdf" — copie para services/cartao-omr/templates/source/enamed_v1.pdf.

Estado atual: nada implementado; só o PRD existe na branch. Comece com `git fetch origin && git merge origin/main` (regra 1 da seção 4).
Atenção: esta fase é go/no-go. Se o acerto por bolha não atingir 99,5% nas fixtures após calibração, pare e reporte com números e exemplos.
Cartões reais preenchidos: {o João informa se já tem; senão, registre como pendência da Fase 5}.

Execute só a Fase 0. Ao final, siga a regra 8 da seção 4 (testes, commit, tag cartoes-fase-0, handoff em docs/prd/cartoes-resposta-handoff/fase-0.md, prompt da Fase 1, próximos passos meus/do João).
```

## 13. Referências no código
- Import atual (front): `src/components/admin/simulados/ImportarRespostasTab.tsx` (parser e `downloadTemplate`), `importar-respostas-types.ts`.
- Import atual (edge): `supabase/functions/admin-import-simulado-responses/index.ts` (payload em :16-40, `normalizeResposta` em :519, `validateRow` em :529).
- RPC de commit: `admin_import_responses_batch` em `supabase/migrations/20260429170721_*.sql`.
- Helpers da Edge: `supabase/functions/_shared/{cors,auth,response,ai}.ts`.
- Upload em Storage via edge (padrão): `supabase/functions/admin-upload-simulado-images/index.ts:95-150`.
- Papéis: `public.has_role`, `public.user_roles`, enum `app_role`; hardening em `20260807023000_hardening_funcoes_de_papel.sql`.
- Tabelas: `simulados_admin`, `questoes_simulado`, `users` (`matricula_ra`, `id_ies`), `admin_audit_log`.
- Testes estáticos de migration (padrão): `src/test/unit/hardeningFuncoesDePapel.test.ts`.
