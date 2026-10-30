# Engajamento SanarFlix no Academy (spec)

**Data:** 2026-10-22 · **Autores:** João Vitor (produto/decisões), Claude (redação) · **Status:** aprovada para implementação

**Fontes desta spec, em ordem de precedência:**

1. Esta spec. As decisões da §3 prevalecem sobre o mock quando os dois divergem; cada divergência está anotada.
2. Mock aprovado: artifact `https://claude.ai/artifact/9C14dfcGsWN14D3rtJWxng`. Arquivos:
   - `project/Main.dc.html`: Gestor · Visão geral.
   - `project/Gestor-Questoes.dc.html`
   - `project/Gestor-Conteudos.dc.html`
   - `project/Gestor-Sidebar.dc.html`
   - `project/Admin-Comparativo.dc.html`

   Os números do mock são fictícios. Textos, rótulos, estados e interações valem e estão transcritos na §12. **Não é preciso abrir o mock para implementar.**
3. O código do repositório: padrões do Portal do Gestor v2 e do console admin.

**Documentos irmãos:**
- Plano de tarefas: `docs/superpowers/plans/2026-10-22-engajamento-sanarflix.md`.
- Prompt de início da implementação: `docs/superpowers/notes/2026-10-22-engajamento-sanarflix-prompt-implementacao.md`.

**Documentos que NÃO valem:** os arquivos da pasta `engajamento-no-academy/` no OneDrive (mart, arquitetura, spec antiga) estão deprecados. Não os use.

---

## 0. Como ler esta spec

O leitor é uma sessão de implementação **sem contexto** desta conversa. Tudo o que for preciso para implementar está aqui ou no plano.
- Quando algo não estiver escrito, **pare e pergunte ao João** (lista na §3.3). Não decida sozinho.
- Toda SQL marcada como **"referência"** foi escrita contra o schema real de produção, e as consultas de leitura foram executadas em 22/10/2026.
- Os números "esperados" mudam a cada carga diária. Use-os como ordem de grandeza. O critério de aceite é sempre **"RPC = consulta de validação na fonte"**, nunca "RPC = número desta spec".

### 0.1 Glossário (termos usados com sentido exato)

| Termo | Definição exata |
|---|---|
| **IES** | Linha de `public.ies` (`id uuid`, `nome text`). O aluno se liga à IES por `dim_aluno_b2b.id_ies`. |
| **Base ativa** | Alunos de `public.dim_aluno_b2b` com `lower(btrim(perfil)) = 'aluno'` **e** `status_atual = 'ativo'` **e** `semestre_atual BETWEEN 1 AND 12`. É a única população de toda a tela, volumes inclusive (D17). Função única: `public.eng_base_ativa(uuid)` (§5.6). |
| **Hoje** | `(now() AT TIME ZONE 'America/Sao_Paulo')::date`. Função `public.eng_hoje()`. |
| **Atividade** | Pelo menos 1 resposta de questão (**qualquer** resposta, com ou sem classificação) **ou** pelo menos 1 consumo de conteúdo (vídeo ou documento) do aluno num dia. |
| **Dia ativo** | Dia com atividade (D4 do briefing). Na base, é uma linha de `eng_atividade_aluno_dia`. |
| **Engajado (no período)** | Aluno da base ativa com ≥ 1 dia ativo dentro do período. |
| **Consumo** | Um par **aluno × conteúdo × dia** com ≥ 1 evento em `fato_consumo_conteudo_b2b` (D5). Abrir o mesmo conteúdo 5 vezes no mesmo dia conta **1 consumo** e **5 aberturas**. |
| **Vídeo assistido / documento lido** | Consumo com `content_type = 'video'` / `'document'`. Não há tempo assistido: "assistido" significa "player aberto". |
| **Questão resolvida** | Uma linha (resposta) de `fato_resolucao_questoes_b2b` **cuja questão tem classificação principal** (D3). Re-resposta da mesma questão conta de novo. |
| **Acerto** | `acertos ÷ (acertos + erros)`, com `acertos` = respostas classificadas com `acertou = true` e `erros` = `acertou = false`. `acertou IS NULL` (54 linhas hoje) conta como resolvida e fica fora do denominador. |
| **Classificação principal** | Um único nó-folha da taxonomia por `question_id`, gravado em `eng_questao_classificacao` (§6.2). Cada resposta conta **uma vez**, nesse nó. |
| **Nó-folha** | Ciclo clínico: tema (nível 3). Ciclo básico: assunto (nível 2). |
| **Última atividade** | Maior `dia` de `eng_atividade_aluno_dia` do aluno, em **todo o histórico** até hoje, independente do período (D7). |
| **Dias sem atividade** | `eng_hoje() − última atividade`. `NULL` quando o aluno nunca teve atividade. Na UI aparece como "Dias sem consumo" (rótulo do mock). |
| **Mês parcial** | Mês do calendário cujo último dia é posterior a `p_fim`, ou cujo primeiro dia é anterior a `p_inicio`. |
| **Período anterior** | Os `N` dias imediatamente antes de `p_inicio`, sendo `N = p_fim − p_inicio + 1`. |

---

## 1. Contexto e fatos verificados

### 1.1 Problema

O SanarFlix (plataforma de vídeos, documentos e questões) é vendido às IES junto com o Academy. Hoje o gestor da IES não vê se os alunos usam o SanarFlix, e o time interno não compara IES. As três tabelas B2B abaixo já chegam ao Supabase do Academy por uma carga externa. Esta entrega:
- cria a camada derivada (classificação de questões + agregados por aluno × dia);
- cria as RPCs;
- cria quatro telas:
  - Portal do Gestor › Engajamento, com as abas Visão geral, Questões e Conteúdos;
  - Admin › Engajamento SanarFlix.

### 1.2 Ambiente

| Item | Valor |
|---|---|
| Repositório / pasta | `C:\Users\joao.nader\work\sanarflix-engajamento` (worktree de `sanarflix-study-guide`) |
| Branch | `feat/engajamento-sanarflix`. Nunca commitar na `main`: o Lovable empurra para ela várias vezes ao dia. |
| Supabase de produção | project ref `gvqvrmkizemwsasmupmo` ("SanarFlix Academy", Postgres 17, `sa-east-1`) |
| Extensões instaladas | `pg_cron 1.6`, `pg_net`, `pgcrypto`, `uuid-ossp`. **Não há `unaccent`**: a busca sem acento usa `translate` (§5.6). |
| Timeout do `execute_sql` (MCP) | `statement_timeout = 2min`. Consultas pesadas sobre `fato_resolucao_questoes_b2b` estouram esse limite; veja §6.5. |

### 1.3 As três tabelas de origem (carga externa; nenhuma migration do repo as cria)

**`public.dim_aluno_b2b`**: 1 linha por aluno SanarFlix B2B. É **substituída por inteiro a cada carga**: `snapshot_date` = dia da carga. O histórico diário fica em `public.dim_aluno_b2b_snapshot`, que existe desde 01/10/2026.

| Coluna | Tipo | Observação |
|---|---|---|
| `sanarflix_user_id` | text, PK | chave de junção com as duas fatos |
| `email_normalizado` | text not null | `lower(btrim())`, verificado por CHECK |
| `nome` | text | 0 nulos na base ativa |
| `perfil` | text | **sujo**: `Aluno` 11.169, `aluno` 53, `Professor` 1.082, `non_student` 10, `Médico`, `medica `… Normalize com `lower(btrim(perfil))` |
| `semestre_atual` | smallint | CHECK 0–14. Na base ativa, 100% entre 1 e 12 |
| `id_ies` | uuid not null | FK → `ies.id` |
| `status_atual` | text | `ativo` / `inativo` |
| `academy_user_id` | uuid | FK → `users.id`. Nulo em 4.343 (35%) no total, mas em **só 4 dos 7.120 alunos da base ativa** |
| `match_metodo`, `grupos_no_lake`, `vigencia_*`, `expiration_date`, `final_date`, `nome_universidade_origem`, `snapshot_date`, `sincronizado_em` | — | não usados aqui |

Contagens em 22/10/2026:
- total: 12.330 linhas, 21 IES;
- base ativa: **7.120**.

| Semestre (base ativa) | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Alunos | 282 | 544 | 357 | 526 | 331 | 422 | 615 | 1.216 | 357 | 812 | 523 | 1.135 |

**`public.fato_consumo_conteudo_b2b`**: 1 linha por evento de abertura de vídeo ou documento.
- Colunas: `event_key` (sha256 hex), `event_timestamp` (timestamp, UTC), `event_date` (date em America/Sao_Paulo, garantido por CHECK), `sanarflix_user_id`, `content_type` (`video` | `document`), `content_id`, `content_name`, `course_id`, `course_name`, `module_id`, `module_name`, `source` (`web` | `app`), `carregado_em`.
- PK `(event_date, event_key)`; índice `(sanarflix_user_id, event_date)`.
- 22/10/2026: ~251 mil eventos (162 mil vídeo, 89 mil documento), 4.073 usuários; todos existem na dim.
- **Só há dados de 2026-01-01 em diante e só `source = 'web'`** (o app não chega).
- 151 mil combinações aluno × conteúdo × dia: em ~49% delas o aluno abriu o mesmo conteúdo mais de uma vez no dia (máximo 40 vezes).
- `course_name` tem 269 valores (= "especialidade do conteúdo") e variantes com sufixo: `Obstetrícia`, `Obstetrícia (Residência Médica)`, `Obstetrícia (Internato e Prática Médica)`, `Anatomia dos Órgãos e Sistemas (Biblioteca SanarFlix)`…
- 4.029 dos 6.569 `content_id` aparecem em mais de um `course_name`.
- `module_name` nulo em 5.689 eventos (2,3%) e às vezes com espaço sobrando (`'Sistema Reprodutor '`). `course_name` nulo: 5 eventos. `content_name` nulo: 3.
- O mesmo `content_id` tem sempre o mesmo nome e o mesmo tipo.

**`public.fato_resolucao_questoes_b2b`**: 1 linha por resposta.
- Colunas:
  - `response_id` (PK, sem duplicidade), `response_timestamp`, `response_date` (America/Sao_Paulo, ≥ 2025-01-01 por CHECK);
  - `sanarflix_user_id`, `question_id`, `answer_id`, `acertou` (boolean; 54 nulos);
  - `taxonomias` (jsonb array), `taxonomia_status` (`completa` | `parcial` | `ausente`);
  - `contextos_candidatos` (jsonb array), `contexto_status` (`ausente` | `candidato_unico` | `candidatos_multiplos`);
  - `origem_publicacao` (`lake` até 18/10/2026; `replica` de 18/10 em diante), `carregado_em`.
- Índices: `(sanarflix_user_id, response_date)`, `(question_id)`, `(response_date)`, GIN em `taxonomias`.
- 22/10/2026: **1.325.247** respostas, **84.745** questões distintas. Todos os usuários existem na dim.
- Por status:
  - `completa` 977.254 (74%);
  - `parcial` 214.839 (16%);
  - `ausente` **133.154 (10%)**, de **16.953 questões**.
- Por população:
  - base ativa de hoje: 1.174.439 respostas;
  - alunos com status `inativo`: 141.970;
  - professores e outros: ~9 mil.

**Conteúdo de `taxonomias`** (verificado sobre as 84.745 questões distintas):
- Cada elemento traz `ciclo`, `ciclo_id`, `especialidade`, `especialidade_id`, `subespecialidade`, `subespecialidade_id`, `tema`, `tema_id`, `subtema`, `subtema_id`, `grupo_id`.
- `subtema` é 100% nulo e é descartado.
- `ciclo` tem só 2 valores:
  - `'Questões Ciclo Clínico e Residência Médica'`;
  - `'Ciclo Básico'`.
- **Ciclo clínico:** `especialidade` = GRANDE ÁREA, com 5 valores: Clínica Médica, Ginecologia e Obstetrícia, Cirurgia, Pediatria, Preventiva. `subespecialidade` = ESPECIALIDADE (43); `tema` = TEMA (390).
  - `tema` nulo **só** em Preventiva › Medicina da Família e Comunidade (1.505 questões).
- **Ciclo básico:** `especialidade` = DISCIPLINA (33); `subespecialidade` = ASSUNTO. Não existe tema.
- **Hierarquia de ids limpa:** cada `*_id` tem um único nome e um único pai (0 exceções).
- **A taxonomia é estável por questão:** em 47 mil questões amostradas, 0 têm arrays diferentes entre respostas.
- Nº de taxonomias por questão: 0 em 16.953; 1 em 56.491; 2–4 em 11.301. Dessas 11.301:
  - 8.875 cruzam grande área ou disciplina;
  - 2 cruzam ciclo;
  - 1.507 misturam entrada completa (com tema) e parcial.
- A curadoria **não tem** "taxonomia principal" na origem: não há esse campo. Vale a regra da §6.2 (D2).

**Conteúdo de `contextos_candidatos`:**
- Cada elemento traz `asset_type` (sempre `QUIZ`), `asset_id`, `asset_titulo`, `tree_node_id`, `quiz_especialidade`, `quiz_especialidade_id`, `conteudo_caminho` (ex.: `"Cardiologia > Arritmias"`).
- O vocabulário de `quiz_especialidade` é o mesmo de `course_name`, com sufixos.
- **O contexto varia por resposta da mesma questão**: é o quiz de onde aquele aluno respondeu.
- Das 133.154 respostas sem taxonomia:
  - 125.510 têm contexto, de 16.330 questões;
  - **7.651 não têm contexto nenhum**, de 3.273 questões. Essas o de-para nunca vai alcançar.

**Cadência das cargas externas** (vista por `carregado_em`):
- dim e consumo: 1× ao dia, entre 02h e 03h UTC (23h–00h BRT), às vezes com uma carga extra durante o dia;
- questões: de hora em hora.
- Não há `pg_cron` envolvido. O estado da carga de questões fica em `public.b2b_questions_sync_state`.

### 1.4 Divergências em relação ao briefing de design

| Briefing dizia | Verificado | Consequência |
|---|---|---|
| "`academy_user_id` nulo em ~37%" | É verdade no total, mas na base ativa só 4 alunos (0,06%) | A pendência do card do aluno (trabalho futuro) é quase inexistente para quem é ativo. |
| Consumo "eventos de vídeo/documento" | Só desde 2026-01-01, só web | Comparativos de conteúdo com período anterior a 2026 são omitidos (D10). O rodapé de Conteúdos cita a origem web. |
| "1 classificação principal por regra" com dados por IES × semestre × mês × nó | Coluna Alunos (distinta), períodos de 30 dias/personalizado, pop-ups e drawer exigem grão de aluno | O grão virou **aluno × dia** (D1), com aval do João. |
| `taxonomia_status = parcial` = "sem tema" | No ciclo básico **toda** classificação é "parcial" por desenho (não existe tema) | Na regra, "completa" é avaliada **por entrada**: clínico com tema, ou básico (§6.2). |
| Proficiência "nas tabelas de simulado/TRI" | Regra canônica do Portal do Gestor; cobre **15 das 21 IES**. Sem simulado: Integrado, Famp, Fame, UNIFIP, Integrado Macapá, Fatec | Coluna "—" com nota (§8.10). |
| Baseline de testes 385/385 verde | `src/test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts` **já falha em 5 casos** na branch, antes de qualquer mudança | A tarefa A0 mede o baseline real. O critério passa a ser "nenhuma falha nova" (§15). |

### 1.5 Limitações registradas (não resolver agora)

1. **Semestre reclassifica o histórico** (D6 do briefing): o semestre exibido é sempre `semestre_atual` de hoje. Um aluno hoje no 8º aparece como "8º" também nas respostas de 2025. O histórico de semestre existe só desde 01/10/2026 (`dim_aluno_b2b_snapshot`). Trabalho futuro, §16.
2. **População = base ativa de hoje** (D17): a atividade de quem hoje está `inativo` (formado, trancado) não aparece em nenhum número, nem em períodos passados.
3. **Consumo só desde 2026-01-01 e só web.**
4. **3.273 questões (7.651 respostas) nunca terão classificação** (sem taxonomia e sem contexto). Ficam fora de toda contagem de questões (D3). Continuam contando como dia ativo.
5. **Questões sem taxonomia e com contexto** (≈ 125 mil respostas) ficam fora das contagens **até** o de-para da §6.3 ser preenchido, em outra sessão.

---

## 2. Escopo

### 2.1 Entra

- **Back-end (Bloco A):**
  - 7 tabelas novas `eng_*` (§5);
  - 4 funções auxiliares SQL e 4 de pipeline (§5.6, §6);
  - 1 job `pg_cron`;
  - 9 RPCs do gestor e 1 do admin (§8);
  - testes estáticos de SQL;
  - regeneração de `types.ts`.
- **Front-end do Portal do Gestor (Bloco B):**
  - item "Engajamento" (badge "NOVO") num grupo novo "Uso da plataforma" da sidebar;
  - rotas `/gestor/engajamento`, `/gestor/engajamento/questoes`, `/gestor/engajamento/conteudos`, com as 3 abas completas (§9–§12).
- **Front-end do admin (Bloco B):** item "Engajamento SanarFlix" no grupo "Operação" e a rota `/admin/engajamento`.

### 2.2 Não entra (decisões travadas)

- **Telas do aluno**: card de ranking na home e tela de ranking (`Aluno-Home-Ranking.dc.html`, `Aluno-Ranking.dc.html`). São trabalho futuro (§16), com pendências de opt-in com a IES.
- Botão "Recomendar" (não existe no mock final).
- Tempo assistido (a fonte não registra).
- **Conteúdo do de-para** `quiz_especialidade → nó`: aqui só se cria a tabela vazia e o ponto de encaixe. Quem preenche é outra sessão.
- Histórico de semestre e histórico de base ativa.
- Consumo do app.
- Qualquer alteração em RPC, tabela ou tela existente fora do que a §10 lista. Exceções: os testes que enumeram RPCs e itens de nav, que **precisam** ser atualizados (§15.3).

---

## 3. Decisões e não-decisões

### 3.1 Decisões fechadas com o João (22/10/2026)

As decisões técnicas do briefing continuam valendo. **D1 substitui o grão da decisão técnica nº 1 do briefing**, com aval explícito.

| # | Decisão | Por quê |
|---|---|---|
| D1 | **Grão:** a camada derivada guarda **aluno × dia** (`eng_atividade_aluno_dia`), **aluno × dia × nó-folha** (`eng_questoes_aluno_dia_no`) e **aluno × dia × conteúdo** (`eng_consumo_aluno_dia_conteudo`). IES e semestre vêm da dim **na hora da consulta**. As RPCs **nunca** leem as fatos nem o JSON. | Coluna "Alunos" é contagem distinta (não soma entre meses); o período pode ser "Últimos 30 dias" ou personalizado; os pop-ups listam alunos; o drawer é por aluno. Tudo isso exige o aluno no grão. Volume: ~55 mil aluno-dias em 6 meses, ~1 mi de linhas aluno × dia × nó no total. |
| D2 | **Classificação principal** por regra determinística, com o motivo gravado: (1) entrada completa > parcial; (2) entre empatadas, a que casa com a especialidade de algum quiz em que a questão apareceu; (3) empate → primeira do array. A curadoria **não** tem campo de principal. | Totais têm que fechar em todo lugar. A regra é reprodutível e auditável (`motivo`). |
| D3 | **Questão sem classificação fica fora de toda contagem de questões e de acerto** (KPIs, gráficos, gavetas, especialidades, drawer, tabelas). Continua contando para **dia ativo** e **engajamento**. Quando o de-para for preenchido, essas questões entram sozinhas no recálculo seguinte. | "Sem classificação" é proibido na tela, e os totais precisam fechar com as gavetas. |
| D4 | **Proficiência no admin** = regra canônica do Portal do Gestor (`get_gestor_visao_geral`): `resultados_alunos_tri`, `score_proprio ≥ 60`, melhor tentativa por (aluno, simulado-pai), `simulado_enamed` sem `prova_oficial`, simulado visível pela regra de liberação, população `users.id_ies` sem papel. Usa o simulado-pai **mais recente** (`data_ref` máxima) da IES. Sem simulado: "—". | O admin mostra o mesmo número que o gestor da IES vê. |
| D5 | **1 consumo = aluno × conteúdo × dia.** O pop-up de conteúdo mostra também "Aberturas" (eventos brutos). | Corta o ruído de recarregar o player (49% dos dias têm reabertura). |
| D6 | **Especialidade do conteúdo** = `course_name` sem o sufixo final entre parênteses e com espaços normalizados (`eng_rotulo_curso`, §5.6). Ex.: as três variantes de Obstetrícia viram `Obstetrícia`. | O gestor não distingue "Residência Médica" de "Internato" como especialidades diferentes. |
| D7 | **Recência é sempre contada até hoje**, independente do período. Afeta: "Sem retorno há 30+ dias", "Quem não voltou", "Dias sem consumo", "Última atividade", o "acessou nos últimos 30 dias" de Nível de engajamento e o filtro "Sem atividade há 14 dias". "Nunca acessaram" = **sem nenhuma atividade registrada**. | Recência é estado atual do aluno. O período só afeta volumes, faixas de hábito e "melhor mês". |
| D8 | **Cores:** só tokens existentes de `src/features/gestor/gestor-theme.css` (`--gp-brand`, `--gp-brand-strong`, `--gp-brand-surface`, `--gp-brand-border`, semânticos `--gp-success*`, `--gp-warning*`, `--gp-danger*`, neutros). **Nenhum hex novo.** Os hex do mock (`#C8102E`, `#E5A3A6`, `#FDEEF0`…) mapeiam para tokens pela §13. | Coerência com o resto do portal. O guard `tema.test.tsx` exige par escuro para todo literal. |
| D9 | **Rollout:** a tela aparece para **todas** as IES do portal v2, sem feature flag nova. IES sem alunos na dim vê o estado vazio. **IES piloto do portão A→B: PARACATU**, `id_ies = d86c32ba-2d09-4c7e-a426-1d981ec7b595`, 521 alunos na base ativa, com simulado ENAMED. | Simplicidade. O histórico de migration que apagou chaves de `ies_features` ao vivo desaconselha flag nova. |
| D10 | **Comparativos com o período anterior são mantidos.** Período anterior = mesmo nº de dias imediatamente antes. Se o período anterior começa antes da 1ª data da fonte (questões: 2025-01-01; conteúdo: 2026-01-01; engajamento usa as duas, então 2026-01-01), o comparativo **não aparece**: a linha de nota cai no texto alternativo da §12, sem número. | Evita número enviesado por falta de dado. |
| D11 | **Exportação na Visão geral:** 2 botões. "Exportar" (cabeçalho) gera CSV com os números agregados da aba atual. "Exportar base de alunos (CSV)" (tabela Por aluno) gera a lista com e-mail e só aparece se `contexto.podeExportar`. O botão **"Exportar planilha" do mock sai**. | Era redundante. |
| D12 | **Gavetas listam todos os temas/assuntos/conteúdos com dado no recorte**, sem linha "Outros temas de X". | A linha "Outros" do mock não dá para clicar com sentido. |
| D13 | **Tema nulo** (Preventiva › MFC) recebe um **tema sintético com o nome da especialidade** ("Medicina da Família e Comunidade"), clicável como qualquer tema. | Nada de "Sem tema" na tela. |
| D14 | **Conteúdo sem módulo** vai para o módulo sintético **"Materiais gerais"**, sempre por último na ordem da gaveta. Sem curso: especialidade sintética **"Outros conteúdos"**. Sem nome: **"Conteúdo sem título"**. | Nada de rótulo vazio. |
| D15 | **Ciclo do semestre do aluno:** 1º–4º "básico", 5º–8º "clínico", 9º–12º "internato". | Igual ao mock. |
| D16 | **Recálculo 1× ao dia às 06:00 BRT** (`pg_cron` às `09:00 UTC`). "Atualizado em" = `terminado_em` do último refresh com sucesso (`eng_refresh_log`). | As cargas externas de dim e consumo terminam por volta de 00h BRT. |
| D17 | **População única = base ativa de hoje**, em tudo (volumes, engajamento, listas, admin). | Todo número da tela se refere à mesma população, então tudo fecha. |
| D18 | **"/ aluno"** no Comparativo entre semestres (gestor) e no Ranking de IES (admin) = **÷ alunos engajados no período** daquela linha. Nas abas Questões e Conteúdos, "por aluno" = **÷ alunos que resolveram/consumiram**, como os rodapés dessas abas dizem. | Mesma base em todas as colunas de uma linha. |

### 3.2 Padrões adotados (decididos nesta spec; o João pode vetar, a implementação não)

| # | Padrão |
|---|---|
| P1 | **Períodos do gestor** (seletor "Período"):<br>- `6m` "Últimos 6 meses" (padrão) = 1º dia de (mês de hoje − 5) até hoje;<br>- `30d` "Últimos 30 dias" = hoje − 29 até hoje;<br>- `letivo` "Semestre letivo AAAA.S" = 1º/jan–30/jun (S=1) ou 1º/jul–31/dez (S=2) do semestre corrente, cortado em hoje;<br>- `custom` "Personalizado…" = duas datas escolhidas, mínimo 2025-01-01, máximo hoje, no máximo 731 dias. |
| P2 | **Períodos do admin:** `6m` "Últimos 6 meses" (padrão), `30d` "Últimos 30 dias", `ano` "‹ano corrente›" = 1º/jan do ano corrente até hoje. |
| P3 | **Gráficos mensais** mostram os meses do calendário que cruzam o período, cada um cortado ao período. Mês parcial (§0.1) leva `*` no rótulo ("Out*"). O rodapé ou a descrição usa "‹mês por extenso› parcial, até dd/mm". Em "Últimos 6 meses" só o mês corrente é parcial. |
| P4 | **"Do acesso ao hábito"**: mês de referência = **último mês fechado ≤ `p_fim`** (se `p_fim` é o último dia do mês, é o próprio mês; senão, o mês anterior). Conta os dias ativos do mês **inteiro**, sem cortar ao período. |
| P5 | **"Era frequente e parou"** olha os meses do calendário que cruzam o período, com os dias **cortados ao período**. "Melhor mês" = o mês com mais dias ativos nesse recorte; empate → o mais recente. |
| P6 | **Drawer › Últimas atividades:** 4 itens mais recentes, de 3 tipos (questões por dia × especialidade; vídeo; documento). A linha "Concluiu o quiz…" do mock **sai** (não há evento de conclusão). |
| P7 | **"Especialidade"** no drawer e em "Especialidades mais praticadas" = nível 2 no ciclo clínico (Cardiologia, Neonatologia…) e nível 1 no básico (Fisiologia…). Top 6 no bloco da Visão geral, top 5 no drawer, ordenados por questões. |
| P8 | **Comparativo entre semestres** e gráficos "por semestre": sempre as 12 linhas, 1º a 12º, com 0 quando vazias. Ignoram o filtro de semestre e de aluno; o selecionado fica realçado. |
| P9 | **IES sem alunos na base ativa:** página inteira em estado vazio "Ainda não há dados do SanarFlix para esta instituição." |
| P10 | **Admin:** item "Engajamento SanarFlix" em "Operação", logo depois de "Monitoramento", com `capability: 'simulados.manage'` (o mesmo de Monitoramento). A RPC exige `has_role(admin)`. "Abrir portal →" leva a `/gestor/engajamento?ies=<id>`. Nenhuma resposta do admin contém dado individual de aluno. |
| P11 | **Nomes:** tabelas `public.eng_*`; RPCs `public.get_gestor_engajamento_*` e `public.get_admin_engajamento`; envelope `{ data, meta }` igual às demais RPCs do gestor. |
| P12 | **Cor de alerta em acerto** = `nivelDesempenho()` de `src/features/gestor/lib/regras.ts`: `< NIVEL_CRITICO_MAX` (50) em `--gp-danger-on`. Substitui os cortes soltos do mock (56, 60). |
| P13 | **Estado na URL do gestor:** `periodo`, `de`, `ate`, `eng_sem`, `aluno`, `tipo`. Usa-se `eng_sem` em vez de `semestre` porque `semestre` já pertence às outras telas do portal (valores `6ano`/`geral`, padrão `6ano`). As chaves sobrevivem à troca de tela pela sidebar, que preserva a query string. |
| P14 | **Ordem de desempate** em toda lista ordenada por número: número desc, depois `nome` asc (collation padrão). Assim duas chamadas iguais devolvem a mesma ordem. |
| P15 | **Paginação** das listas: `p_page` (1-based) e `p_page_size` (padrão 20, máximo 50; o modo CSV aceita até 5.000), devolvendo `Paginado<T>` (`api/types.ts`). |
| P16 | **"Exportar"** (CSV agregado do cabeçalho) não depende de `podeExportar`, porque não tem dado pessoal. "Exportar base de alunos (CSV)" e "Exportar CSV" das listas de alunos dependem. |

### 3.3 O que a implementação NÃO pode decidir sozinha (pare e pergunte ao João)

1. Aplicar **qualquer** migration em produção: cada uma precisa de "ok" explícito do João **para aquela migration**.
2. Alterar a regra da classificação principal, a definição de base ativa, de consumo, de dia ativo ou de engajado.
3. Preencher `eng_depara_quiz_no` (outra sessão).
4. Mudar texto literal da §12 ou cor fora do mapa da §13.
5. Tocar em RPC, tabela, rota ou componente existente que não esteja listado na §10/§15.3.
6. Criar feature flag, chave em `feature_catalog`/`ies_features` ou guard de feature em RPC.
7. Qualquer divergência entre os números da RPC e a consulta de validação (§14). Não "ajuste" a validação para bater.
8. Se `fato_*`/`dim_*` mudarem de schema, ou se aparecer um terceiro valor de `ciclo`.
9. Se o refresh passar de 15 minutos ou falhar no cron.
10. Push, PR ou merge.

---

## 4. Regras de cálculo

Notação:
- `B` = população do recorte: a base ativa da IES, filtrada pelo semestre se houver; ou `{aluno}` quando há aluno filtrado.
- `[ini, fim]` = período.
- `A(a, d)` = linha de `eng_atividade_aluno_dia` do aluno `a` no dia `d`. Existe se e só se houve atividade.

Todos os exemplos usam a PARACATU, `[2026-05-01, 2026-10-22]` (P1, "Últimos 6 meses" em 22/10/2026), sem semestre. Números de 22/10/2026.

### 4.1 Base, engajamento e recência

| Métrica | Fórmula | Exemplo PARACATU |
|---|---|---|
| Base ativa | `|B|` | 521 |
| Alunos engajados | `|{a ∈ B : ∃ d ∈ [ini,fim] com A(a,d)}|` | 330 |
| % engajados | `engajados ÷ base × 100`, 1 casa no dado; a tela arredonda para inteiro | 63,3% → "63%" |
| Última atividade | `max(d)` de `A(a,·)` com `d ≤ hoje` (todo o histórico) | — |
| Dias sem atividade | `hoje − última atividade`; `NULL` se não houver | — |
| Ativos nos últimos 30 dias | `dias sem atividade ≤ 29` | 197 |
| Sumidos há 30–59 dias | `30 ≤ dias sem atividade ≤ 59` | 69 |
| Sumidos há 60+ dias | `dias sem atividade ≥ 60` | 64 |
| Nunca acessaram | `dias sem atividade IS NULL` | 191 |
| **Fecha:** | ativos30 + 30–59 + 60+ + nunca = base | 197+69+64+191 = **521** ✓ |
| Sem retorno há 30+ dias (KPI) | sumidos 30–59 + sumidos 60+ | 133 (25,5% da base) |

### 4.2 Engajamento mês a mês

- Para cada mês `m` que cruza o período: `pct(m) = |{a ∈ B : ∃ d ∈ m ∩ [ini,fim] com A(a,d)}| ÷ |B| × 100`.
- O valor exibido é o inteiro arredondado + "%"; a linha de baixo é "N alunos".
- Com aluno filtrado, o gráfico vira "Dias ativos mês a mês": `|{d ∈ m ∩ [ini,fim] : A(a,d)}|`, exibido como "N d".

### 4.3 Do acesso ao hábito (P4)

- Mês de referência `M` = último mês fechado ≤ `fim`.
- `ativosNoMes = |{a ∈ B : ∃ d ∈ M com A(a,d)}|`.
- Para cada `a`, `k(a) = |{d ∈ M : A(a,d)}|`.

| Faixa | Regra |
|---|---|
| Base ativa | `|B|`; barra de 100%, texto "· 100%" |
| Baixo engajamento | `1 ≤ k ≤ 3` |
| Médio engajamento | `4 ≤ k ≤ 7` |
| Alto engajamento | `8 ≤ k ≤ 14` |
| Altíssimo engajamento | `k ≥ 15` |

- Percentual de cada faixa = `n ÷ ativosNoMes × 100`, com **1 casa decimal e vírgula** ("56,7% dos ativos no mês"). As quatro faixas somam `ativosNoMes`.
- Exemplo PARACATU, M = set/2026: ativos no mês 223 = 133 + 50 + 35 + 5 ✓.
- Com aluno filtrado: cada faixa mostra "Sim" ou "Não". A barra fica 100% na faixa do aluno (e na Base ativa) e 0% nas demais. Se `k = 0`, todas as faixas mostram "Não" (exceto Base ativa).

### 4.4 Nível de engajamento (4 cartões que somam a base)

Para cada `a ∈ B`:
- `rec(a)` = dias sem atividade (D7);
- `d30(a) = |{d ∈ [hoje−29, hoje] : A(a,d)}|`;
- `melhor(a) = max` sobre os meses `m` que cruzam o período de `|{d ∈ m ∩ [ini,fim] : A(a,d)}|` (P5).

| Cartão (ordem fixa) | Regra (primeira que casar) |
|---|---|
| Ativo e frequente | `rec ≤ 29` **e** `d30 ≥ 15` |
| Ativo, mas esporádico | `rec ≤ 29` (e `d30 < 15`) |
| Era frequente e parou | `rec ≥ 30` (ou nulo) **e** `melhor ≥ 15` |
| Nunca engajou | o resto, inclusive quem nunca acessou |

Exemplo PARACATU: 4 + 193 + 15 + 309 = **521** ✓. Note que frequente + esporádico = 197 = ativos nos últimos 30 dias ✓.

### 4.5 Questões (D3: só respostas com classificação)

| Métrica | Fórmula | Exemplo PARACATU |
|---|---|---|
| Questões resolvidas | `Σ questoes` de `A(a,d)`, `a ∈ B`, `d ∈ [ini,fim]` | 145.873 (de 149.945 respostas; 4.072 sem classificação ficam fora) |
| Acertos / erros | `Σ acertos` / `Σ erros` | 96.825 / 49.048 |
| Acerto | `acertos ÷ (acertos + erros) × 100`, 1 casa no dado | 66,4% → "66%" |
| Alunos que resolveram | `|{a : Σ questoes > 0}|` | 296 |
| Questões por aluno (aba Questões) | `questões ÷ alunos que resolveram`, arredondado | 493 |
| Questões por aluno engajado (KPI da Visão geral e D18) | `questões ÷ engajados`, arredondado | 442 |

> Sobre os exemplos: "sem classificação" aqui foi medido como `taxonomia_status = 'ausente'`, já que o de-para está vazio. Depois do refresh, `eng_atividade_aluno_dia.questoes` precisa bater **exatamente** com isso: é a validação V5 da §14.

### 4.6 Conteúdos

| Métrica | Fórmula | Exemplo PARACATU |
|---|---|---|
| Vídeos assistidos | nº de linhas de `eng_consumo_aluno_dia_conteudo` com `content_type='video'`, `a ∈ B`, `d ∈ [ini,fim]` (= `Σ videos` de `A`) | 8.810 |
| Documentos lidos | idem com `'document'` | 5.027 |
| Conteúdos consumidos | vídeos + documentos | 13.837 |
| Alunos que assistiram / leram | distintos com ≥ 1 linha do tipo | 209 / 282 |
| Média por aluno que assistiu (Visão geral › Vídeos) | `vídeos ÷ alunos que assistiram`, 1 casa | 42,2 |
| Conteúdos por aluno (aba Conteúdos) | `conteúdos ÷ alunos que consumiram (qualquer tipo, filtrado pelo Tipo)`, arredondado | — |
| Participação no nível (gaveta) | `consumos do nó ÷ consumos do nó pai × 100`, inteiro. No 1º nível: `÷ total` | — |

### 4.7 "/ aluno" (D18) e médias de semestre

- Comparativo entre semestres e Ranking de IES:
  - `videosPorEngajado = vídeos ÷ engajados`;
  - `documentosPorEngajado = documentos ÷ engajados`;
  - `questoesPorEngajado = questões ÷ engajados`.
  - Todos da linha (semestre ou IES) e no período. Com 0 engajados → `null` ("—").
- **Média do semestre** (notas com aluno filtrado e drawer) = o mesmo cálculo para os alunos do **mesmo semestre** da mesma IES, no mesmo período:
  - "média do semestre: 420" = `questões ÷ engajados` do semestre;
  - "média do semestre: 66%" = acerto do semestre.

### 4.8 Comparativo com o período anterior (D10)

- `N = fim − ini + 1`, `[ini', fim'] = [ini − N, ini − 1]`.
- `B` é o mesmo do período atual: base de hoje.
- Disponibilidade:
  - `comparavelQuestoes = ini' ≥ 2025-01-01`;
  - `comparavelConteudos = ini' ≥ 2026-01-01`;
  - `comparavelEngajamento = comparavelConteudos`.
- Quando não é comparável, a RPC devolve `null` no campo `*Anterior` e a nota usa o texto alternativo (§12).
- Formatos:
  - totais: variação % = `(atual − anterior) ÷ anterior × 100`, inteiro, com sinal ("+14%"); se `anterior = 0`, `null`;
  - taxas (engajamento, acerto): diferença em pontos percentuais com 0 casas e "▲"/"▼" ("▲ 6 p.p.").
- Exemplo: em 22/10/2026, "Últimos 6 meses" tem `N = 175` e `ini' = 2025-11-07`:
  - questões comparáveis;
  - conteúdos e engajamento **não**: a nota mostra o texto alternativo.

### 4.9 Períodos e ciclo

- Front e RPC usam **datas** (`p_inicio`, `p_fim`, tipo `date`). O front converte o seletor em datas com `src/features/gestor/lib/engajamento.ts` (§10.3).
- O fuso é sempre `America/Sao_Paulo`.
- Ciclo (D15):
  - `n ≤ 4` → "básico";
  - `5 ≤ n ≤ 8` → "clínico";
  - `9 ≤ n ≤ 12` → "internato".
- Rótulo do seletor: "8º semestre · clínico".

---

## 5. Modelo de dados

Todas as tabelas novas ficam em `public` e levam o prefixo `eng_`. Três regras valem para **toda** tabela desta seção:

1. **Revogar acesso.** Pelo default ACL do Supabase, toda tabela nova nasce com privilégio total para `anon` e `authenticated`. Revogar só de `public, anon` **não** restringe nada. Cada migration de tabela termina assim:
   ```sql
   ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;   -- sem policy: ninguém lê por PostgREST
   REVOKE ALL ON TABLE public.<tabela> FROM PUBLIC, anon, authenticated;
   ```
   O dado chega ao front **só** pelas RPCs `SECURITY DEFINER` da §8.
2. **Revogar a sequência.** Tabela com `GENERATED ALWAYS AS IDENTITY` também revoga a sequência:
   ```sql
   REVOKE ALL ON SEQUENCE public.<tabela>_id_seq FROM PUBLIC, anon, authenticated;
   ```
3. **Não editar à mão.** As tabelas são **derivadas**: o pipeline (§6) as reconstrói. A exceção é `eng_depara_quiz_no`, que é curada.

### 5.1 `eng_no_taxonomia` — nós da árvore de questões

| Coluna | Tipo | Regra |
|---|---|---|
| `no_id` | `text` PK | UUID da origem: `especialidade_id` (nível 1), `subespecialidade_id` (nível 2) ou `tema_id` (nível 3). Tema sintético (D13): `'herdado:' || subespecialidade_id`. |
| `nivel` | `smallint not null` | 1, 2 ou 3 |
| `ciclo` | `text not null` | `'clinico'` \| `'basico'` |
| `nome` | `text not null` | `btrim()` do nome da origem. No sintético, recebe o nome da especialidade (nível 2). |
| `pai_id` | `text null` FK → `eng_no_taxonomia(no_id)` | nulo só no nível 1 |
| `sintetico` | `boolean not null default false` | `true` só nos temas herdados |
| `atualizado_em` | `timestamptz not null default now()` | |

| Ciclo | Nível 1 | Nível 2 | Nível 3 | Folha |
|---|---|---|---|---|
| clínico | grande área | especialidade | tema | nível 3 |
| básico | disciplina | assunto | — | nível 2 |

```sql
CREATE TABLE public.eng_no_taxonomia (
  no_id         text PRIMARY KEY,
  nivel         smallint NOT NULL CHECK (nivel IN (1, 2, 3)),
  ciclo         text NOT NULL CHECK (ciclo IN ('clinico', 'basico')),
  nome          text NOT NULL CHECK (btrim(nome) <> ''),
  pai_id        text REFERENCES public.eng_no_taxonomia (no_id),
  sintetico     boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eng_no_taxonomia_pai_ck CHECK ((nivel = 1) = (pai_id IS NULL)),
  CONSTRAINT eng_no_taxonomia_nivel_ciclo_ck CHECK (ciclo = 'clinico' OR nivel IN (1, 2))
);
CREATE INDEX eng_no_taxonomia_pai_idx ON public.eng_no_taxonomia (pai_id);
```

O pipeline **nunca apaga** nós: ele faz upsert. Assim as FKs de `eng_questao_classificacao` e `eng_depara_quiz_no` ficam estáveis entre um refresh e outro.

Volume esperado:
- clínico: 5 + 43 + 390 temas + até 43 sintéticos (hoje, 1);
- básico: 33 + ~1.300 assuntos.

### 5.2 `eng_questao_classificacao` — classificação principal (1 linha por questão classificada)

```sql
CREATE TABLE public.eng_questao_classificacao (
  question_id        text PRIMARY KEY,
  ciclo              text NOT NULL CHECK (ciclo IN ('clinico', 'basico')),
  n1_id              text NOT NULL REFERENCES public.eng_no_taxonomia (no_id),
  n2_id              text NOT NULL REFERENCES public.eng_no_taxonomia (no_id),
  n3_id              text REFERENCES public.eng_no_taxonomia (no_id),
  folha_id           text NOT NULL REFERENCES public.eng_no_taxonomia (no_id),
  esp_id             text NOT NULL REFERENCES public.eng_no_taxonomia (no_id),
  origem             text NOT NULL CHECK (origem IN ('taxonomia', 'depara')),
  motivo             text NOT NULL CHECK (motivo IN ('unica', 'completa', 'quiz', 'primeira', 'depara')),
  n_candidatas       smallint NOT NULL,
  posicao_escolhida  smallint,
  classificado_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eng_qc_n3_ck     CHECK ((ciclo = 'clinico') = (n3_id IS NOT NULL)),
  CONSTRAINT eng_qc_folha_ck  CHECK (folha_id = COALESCE(n3_id, n2_id)),
  CONSTRAINT eng_qc_esp_ck    CHECK (esp_id = CASE WHEN ciclo = 'clinico' THEN n2_id ELSE n1_id END),
  CONSTRAINT eng_qc_origem_ck CHECK ((origem = 'depara') = (motivo = 'depara')),
  CONSTRAINT eng_qc_pos_ck    CHECK ((origem = 'taxonomia') = (posicao_escolhida IS NOT NULL))
);
CREATE INDEX eng_questao_classificacao_folha_idx ON public.eng_questao_classificacao (folha_id);
```

Colunas:
- `esp_id`: o nó "especialidade" de P7 — nível 2 no clínico, nível 1 no básico. Fica gravado para que cada RPC não precise repetir o `CASE`.
- `motivo`:
  - `unica`: a questão só tem uma entrada válida;
  - `completa`: venceu por ser a única completa;
  - `quiz`: venceu por ser a única, no seu nível de completude, que casa com o quiz;
  - `primeira`: empate resolvido pela posição no array;
  - `depara`: veio do de-para (§6.3).
- `n_candidatas`: nº de entradas válidas (0 quando `origem='depara'`).
- `posicao_escolhida`: posição 1-based no array `taxonomias`.

**Questão sem linha aqui = questão sem classificação** (D3) e fica fora das contagens de questões.

### 5.3 `eng_depara_quiz_no` — de-para curado (nasce vazio)

```sql
CREATE TABLE public.eng_depara_quiz_no (
  id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quiz_especialidade_norm  text NOT NULL CHECK (quiz_especialidade_norm = public.eng_norm_rotulo(quiz_especialidade_norm)),
  conteudo_caminho_norm    text CHECK (conteudo_caminho_norm IS NULL OR conteudo_caminho_norm = public.eng_norm_texto(conteudo_caminho_norm)),
  folha_id                 text NOT NULL REFERENCES public.eng_no_taxonomia (no_id),
  observacao               text,
  criado_em                timestamptz NOT NULL DEFAULT now(),
  criado_por               text NOT NULL,
  CONSTRAINT eng_depara_chave_uk UNIQUE NULLS NOT DISTINCT (quiz_especialidade_norm, conteudo_caminho_norm)
);
```

- **Chave:**
  - `quiz_especialidade_norm` = `eng_norm_rotulo(contextos_candidatos[].quiz_especialidade)`, ex.: `'cardiologia'`;
  - `conteudo_caminho_norm` = `eng_norm_texto(contextos_candidatos[].conteudo_caminho)`, ex.: `'cardiologia > arritmias'`. `NULL` vale para qualquer caminho dessa especialidade.
- **Destino:** `folha_id` precisa ser um **nó-folha** (clínico nível 3 ou básico nível 2). Linhas que apontam para nó não-folha são ignoradas pelo pipeline e contadas em `contagens.depara_invalidos`. Não há trigger.
- **Quem preenche:** outra sessão, fora deste escopo. **Esta implementação cria a tabela vazia e não insere nada.**
- **Ordem na migration:** `eng_norm_rotulo` e `eng_norm_texto` (§5.6) precisam existir **antes** desta tabela, por causa dos CHECKs. A migration A2 cria as funções primeiro.

### 5.4 Agregados por aluno × dia

```sql
-- 1 linha por aluno × dia com QUALQUER atividade
CREATE TABLE public.eng_atividade_aluno_dia (
  sanarflix_user_id  text    NOT NULL,
  dia                date    NOT NULL,
  respostas_todas    integer NOT NULL DEFAULT 0,  -- todas as respostas do dia, com ou sem classificação (só para "dia ativo")
  questoes           integer NOT NULL DEFAULT 0,  -- respostas de questões COM classificação principal (D3)
  acertos            integer NOT NULL DEFAULT 0,
  erros              integer NOT NULL DEFAULT 0,
  videos             integer NOT NULL DEFAULT 0,  -- consumos de vídeo no dia (= linhas de eng_consumo_aluno_dia_conteudo)
  documentos         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (sanarflix_user_id, dia),
  CONSTRAINT eng_aad_coerencia_ck CHECK (respostas_todas >= questoes AND questoes >= acertos + erros),
  CONSTRAINT eng_aad_atividade_ck CHECK (respostas_todas + videos + documentos > 0)
);
CREATE INDEX eng_atividade_aluno_dia_dia_idx ON public.eng_atividade_aluno_dia (dia);

-- 1 linha por aluno × dia × nó-folha (só questões classificadas)
CREATE TABLE public.eng_questoes_aluno_dia_no (
  sanarflix_user_id  text     NOT NULL,
  dia                date     NOT NULL,
  folha_id           text     NOT NULL,
  ciclo              text     NOT NULL,
  n1_id              text     NOT NULL,
  n2_id              text     NOT NULL,
  n3_id              text,
  esp_id             text     NOT NULL,
  questoes           integer  NOT NULL CHECK (questoes > 0),
  acertos            integer  NOT NULL,
  erros              integer  NOT NULL,
  PRIMARY KEY (sanarflix_user_id, dia, folha_id)
);
CREATE INDEX eng_questoes_aluno_dia_no_folha_idx ON public.eng_questoes_aluno_dia_no (folha_id, dia);

-- 1 linha por aluno × dia × conteúdo (D5); curso e módulo do 1º evento do dia
CREATE TABLE public.eng_consumo_aluno_dia_conteudo (
  sanarflix_user_id  text      NOT NULL,
  dia                date      NOT NULL,
  content_id         text      NOT NULL,
  content_type       text      NOT NULL CHECK (content_type IN ('video', 'document')),
  content_name       text      NOT NULL,
  especialidade      text      NOT NULL,   -- eng_rotulo_curso(course_name) | 'Outros conteúdos'
  modulo             text      NOT NULL,   -- módulo normalizado | 'Materiais gerais'
  aberturas          integer   NOT NULL CHECK (aberturas >= 1),
  ultima_abertura    timestamp NOT NULL,   -- UTC, como event_timestamp
  PRIMARY KEY (sanarflix_user_id, dia, content_id)
);
CREATE INDEX eng_consumo_aluno_dia_conteudo_arvore_idx ON public.eng_consumo_aluno_dia_conteudo (especialidade, modulo, content_id);
```

Por que o conteúdo recebe um único curso por dia: 4.029 conteúdos aparecem em mais de um curso. Com uma linha por curso, o mesmo consumo (aluno × conteúdo × dia) contaria duas vezes e a gaveta não fecharia com o KPI. Por isso **curso e módulo vêm do primeiro evento do dia** (`ORDER BY event_timestamp, event_key`).

### 5.5 `eng_refresh_log` — controle do pipeline

```sql
CREATE TABLE public.eng_refresh_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  iniciado_em   timestamptz NOT NULL DEFAULT clock_timestamp(),
  terminado_em  timestamptz,
  status        text NOT NULL CHECK (status IN ('rodando', 'ok', 'erro')),
  disparo       text NOT NULL CHECK (disparo IN ('cron', 'manual')),
  contagens     jsonb,
  erro          text
);
CREATE INDEX eng_refresh_log_ok_idx ON public.eng_refresh_log (terminado_em DESC) WHERE status = 'ok';
```

### 5.6 Funções auxiliares (internas; nunca expostas ao front)

Todas recebem `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated;`. As RPCs `SECURITY DEFINER` chamam essas funções com o privilégio do dono.

```sql
CREATE OR REPLACE FUNCTION public.eng_hoje() RETURNS date
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

-- rótulo de especialidade para COMPARAÇÃO: sem sufixo final "(…)", espaços normalizados, minúsculo
CREATE OR REPLACE FUNCTION public.eng_norm_rotulo(p text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp
AS $$ SELECT NULLIF(lower(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '\s*\([^)]*\)\s*$', ''), '\s+', ' ', 'g'))), '') $$;

-- texto genérico para COMPARAÇÃO: espaços normalizados, minúsculo
CREATE OR REPLACE FUNCTION public.eng_norm_texto(p text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp
AS $$ SELECT NULLIF(lower(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'))), '') $$;

-- rótulo de curso para EXIBIÇÃO (D6): sem sufixo final "(…)", espaços normalizados, caixa original
CREATE OR REPLACE FUNCTION public.eng_rotulo_curso(p text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp
AS $$ SELECT NULLIF(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '\s*\([^)]*\)\s*$', ''), '\s+', ' ', 'g')), '') $$;

-- busca sem acento e sem caixa (não há a extensão unaccent no projeto)
CREATE OR REPLACE FUNCTION public.eng_norm_busca(p text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp
AS $$ SELECT lower(translate(coalesce(p, ''),
  'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñÝýÿ',
  'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy')) $$;

-- percentual com 1 casa; NULL quando o denominador é 0
CREATE OR REPLACE FUNCTION public.eng_pct(n numeric, d numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp
AS $$ SELECT CASE WHEN d > 0 THEN round(100.0 * n / d, 1) END $$;

-- razão com 1 casa; NULL quando o denominador é 0
CREATE OR REPLACE FUNCTION public.eng_razao(n numeric, d numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp
AS $$ SELECT CASE WHEN d > 0 THEN round(n / d, 1) END $$;

CREATE OR REPLACE FUNCTION public.eng_validar_periodo(p_inicio date, p_fim date) RETURNS void
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_inicio IS NULL OR p_fim IS NULL OR p_inicio > p_fim
     OR p_inicio < DATE '2025-01-01' OR p_fim > public.eng_hoje() OR p_fim - p_inicio > 730 THEN
    RAISE EXCEPTION 'periodo_invalido' USING ERRCODE = '22023';
  END IF;
END $$;

-- última atualização com sucesso (D16); NULL se o pipeline nunca rodou
CREATE OR REPLACE FUNCTION public.eng_atualizado_em() RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$ SELECT max(terminado_em) FROM public.eng_refresh_log WHERE status = 'ok' $$;

-- a base ativa (§0.1). p_ies NULL = rede inteira (só o admin usa)
CREATE OR REPLACE FUNCTION public.eng_base_ativa(p_ies uuid)
RETURNS TABLE (sanarflix_user_id text, id_ies uuid, nome text, email text, semestre smallint)
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  SELECT d.sanarflix_user_id, d.id_ies, btrim(d.nome), d.email_normalizado, d.semestre_atual
  FROM public.dim_aluno_b2b d
  WHERE (p_ies IS NULL OR d.id_ies = p_ies)
    AND lower(btrim(d.perfil)) = 'aluno'
    AND d.status_atual = 'ativo'
    AND d.semestre_atual BETWEEN 1 AND 12
$$;
```

**`eng_alunos_recorte` — a única definição das métricas por aluno.** Toda RPC que precisa de número por aluno parte desta função; nenhuma recalcula essas regras por conta própria. É isso que faz KPI, cartões, listas e exportação concordarem.

```sql
CREATE OR REPLACE FUNCTION public.eng_alunos_recorte(
  p_ies uuid, p_inicio date, p_fim date)
RETURNS TABLE (
  sanarflix_user_id   text,
  id_ies              uuid,
  nome                text,
  email               text,
  semestre            smallint,
  ultima_atividade    date,      -- todo o histórico, até hoje (D7)
  dias_sem_atividade  integer,   -- hoje − ultima_atividade; NULL = nunca
  dias_ativos_periodo integer,
  dias_ativos_30      integer,   -- [hoje−29, hoje]
  dias_ativos_mes_ref integer,   -- mês de referência do hábito (P4)
  questoes integer, acertos integer, erros integer, videos integer, documentos integer,
  dias_ativos_ant integer, questoes_ant integer, acertos_ant integer, erros_ant integer,
  videos_ant integer, documentos_ant integer,
  melhor_mes          date,      -- 1º dia do melhor mês no período (P5); NULL se não houve dia ativo no período
  melhor_mes_dias     integer,
  nivel               text,      -- frequente | esporadico | parou | nunca (§4.4)
  faixa_recencia      text       -- ativos30 | sumidos30a59 | sumidos60 | nunca_acessou (§4.1)
)
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  WITH par AS (
    SELECT public.eng_hoje() AS hoje,
           (p_fim - p_inicio + 1) AS n,
           CASE WHEN p_fim = (date_trunc('month', p_fim) + interval '1 month - 1 day')::date
                THEN date_trunc('month', p_fim)::date
                ELSE (date_trunc('month', p_fim) - interval '1 month')::date END AS mes_ref
  ),
  b AS (SELECT * FROM public.eng_base_ativa(p_ies)),
  ag AS (
    SELECT b.sanarflix_user_id,
      max(a.dia) FILTER (WHERE a.dia <= par.hoje)                                    AS ultima,
      count(a.dia) FILTER (WHERE a.dia BETWEEN p_inicio AND p_fim)                  AS dias_per,
      count(a.dia) FILTER (WHERE a.dia BETWEEN par.hoje - 29 AND par.hoje)          AS d30,
      count(a.dia) FILTER (WHERE a.dia >= par.mes_ref
                             AND a.dia < (par.mes_ref + interval '1 month')::date)   AS d_mes_ref,
      coalesce(sum(a.questoes)   FILTER (WHERE a.dia BETWEEN p_inicio AND p_fim), 0) AS q,
      coalesce(sum(a.acertos)    FILTER (WHERE a.dia BETWEEN p_inicio AND p_fim), 0) AS ac,
      coalesce(sum(a.erros)      FILTER (WHERE a.dia BETWEEN p_inicio AND p_fim), 0) AS er,
      coalesce(sum(a.videos)     FILTER (WHERE a.dia BETWEEN p_inicio AND p_fim), 0) AS vi,
      coalesce(sum(a.documentos) FILTER (WHERE a.dia BETWEEN p_inicio AND p_fim), 0) AS dc,
      count(a.dia) FILTER (WHERE a.dia BETWEEN p_inicio - par.n AND p_inicio - 1)                     AS dias_ant,
      coalesce(sum(a.questoes)   FILTER (WHERE a.dia BETWEEN p_inicio - par.n AND p_inicio - 1), 0) AS q_ant,
      coalesce(sum(a.acertos)    FILTER (WHERE a.dia BETWEEN p_inicio - par.n AND p_inicio - 1), 0) AS ac_ant,
      coalesce(sum(a.erros)      FILTER (WHERE a.dia BETWEEN p_inicio - par.n AND p_inicio - 1), 0) AS er_ant,
      coalesce(sum(a.videos)     FILTER (WHERE a.dia BETWEEN p_inicio - par.n AND p_inicio - 1), 0) AS vi_ant,
      coalesce(sum(a.documentos) FILTER (WHERE a.dia BETWEEN p_inicio - par.n AND p_inicio - 1), 0) AS dc_ant
    FROM b
    CROSS JOIN par
    LEFT JOIN public.eng_atividade_aluno_dia a ON a.sanarflix_user_id = b.sanarflix_user_id
    GROUP BY b.sanarflix_user_id
  ),
  mm AS (
    SELECT DISTINCT ON (x.sanarflix_user_id) x.sanarflix_user_id, x.mes, x.dias
    FROM (
      SELECT a.sanarflix_user_id, date_trunc('month', a.dia)::date AS mes, count(*)::int AS dias
      FROM b JOIN public.eng_atividade_aluno_dia a ON a.sanarflix_user_id = b.sanarflix_user_id
      WHERE a.dia BETWEEN p_inicio AND p_fim
      GROUP BY 1, 2
    ) x
    ORDER BY x.sanarflix_user_id, x.dias DESC, x.mes DESC
  )
  SELECT b.sanarflix_user_id, b.id_ies, b.nome, b.email, b.semestre,
    ag.ultima,
    (par.hoje - ag.ultima)::int,
    ag.dias_per::int, ag.d30::int, ag.d_mes_ref::int,
    ag.q::int, ag.ac::int, ag.er::int, ag.vi::int, ag.dc::int,
    ag.dias_ant::int, ag.q_ant::int, ag.ac_ant::int, ag.er_ant::int, ag.vi_ant::int, ag.dc_ant::int,
    mm.mes, coalesce(mm.dias, 0),
    CASE
      WHEN ag.ultima IS NOT NULL AND par.hoje - ag.ultima <= 29 AND ag.d30 >= 15 THEN 'frequente'
      WHEN ag.ultima IS NOT NULL AND par.hoje - ag.ultima <= 29                  THEN 'esporadico'
      WHEN coalesce(mm.dias, 0) >= 15                                            THEN 'parou'
      ELSE 'nunca'
    END,
    CASE
      WHEN ag.ultima IS NULL                THEN 'nunca_acessou'
      WHEN par.hoje - ag.ultima <= 29       THEN 'ativos30'
      WHEN par.hoje - ag.ultima <= 59       THEN 'sumidos30a59'
      ELSE 'sumidos60'
    END
  FROM b
  CROSS JOIN par
  JOIN ag ON ag.sanarflix_user_id = b.sanarflix_user_id
  LEFT JOIN mm ON mm.sanarflix_user_id = b.sanarflix_user_id
$$;
```

> A função não recebe semestre nem aluno, porque o valor de cada aluno não depende da população. Cada RPC filtra o resultado (`WHERE semestre = …`). Com isso, a mesma chamada atende o recorte, a comparação com a IES inteira e a comparação com o semestre.

**`eng_detalhe_atividade` — o que o aluno fez num dia.** Alimenta a coluna "Última atividade" das listas da Visão geral.

```sql
CREATE OR REPLACE FUNCTION public.eng_detalhe_atividade(p_user text, p_dia date)
RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_dia IS NULL                THEN NULL
    WHEN q.nome IS NOT NULL           THEN jsonb_build_object('dia', p_dia, 'tipo', 'questoes',  'especialidade', q.nome)
    WHEN a.respostas_todas > 0        THEN jsonb_build_object('dia', p_dia, 'tipo', 'questoes',  'especialidade', NULL)
    WHEN c.content_type = 'video'     THEN jsonb_build_object('dia', p_dia, 'tipo', 'video',     'especialidade', c.especialidade)
    WHEN c.content_type = 'document'  THEN jsonb_build_object('dia', p_dia, 'tipo', 'documento', 'especialidade', c.especialidade)
  END
  FROM (SELECT 1) AS um
  LEFT JOIN public.eng_atividade_aluno_dia a ON a.sanarflix_user_id = p_user AND a.dia = p_dia
  LEFT JOIN LATERAL (
    SELECT n.nome
    FROM public.eng_questoes_aluno_dia_no x
    JOIN public.eng_no_taxonomia n ON n.no_id = x.esp_id
    WHERE x.sanarflix_user_id = p_user AND x.dia = p_dia
    GROUP BY n.nome
    ORDER BY sum(x.questoes) DESC, n.nome
    LIMIT 1
  ) q ON true
  LEFT JOIN LATERAL (
    SELECT k.content_type, k.especialidade
    FROM public.eng_consumo_aluno_dia_conteudo k
    WHERE k.sanarflix_user_id = p_user AND k.dia = p_dia
    ORDER BY k.ultima_abertura DESC, k.content_id
    LIMIT 1
  ) c ON true
$$;
```

Ordem de prioridade: questões classificadas, depois questões sem classificação, depois o conteúdo mais recente do dia.

| Retorno | Texto na tela |
|---|---|
| `{"tipo":"questoes","especialidade":"Cardiologia"}` | `"02/08 · Questões de Cardiologia"` |
| `{"tipo":"questoes","especialidade":null}` | `"02/08 · Questões"` |
| `{"tipo":"video",…}` | `"19/08 · Vídeo de Farmacologia"` |
| `{"tipo":"documento",…}` | `"27/08 · Documento de Obstetrícia"` |

---

## 6. Pipeline de carga e recálculo

### 6.1 Visão geral

```
fato_resolucao_questoes_b2b ─┐
                             ├─► eng_refresh_classificacao() ─► eng_no_taxonomia (upsert)
eng_depara_quiz_no ──────────┘                                  eng_questao_classificacao (rebuild)
                                                                        │
fato_consumo_conteudo_b2b ──┐                                           ▼
fato_resolucao_questoes_b2b ┴─► eng_refresh_agregados() ─► eng_consumo_aluno_dia_conteudo
                                                           eng_questoes_aluno_dia_no
                                                           eng_atividade_aluno_dia
eng_refresh(disparo) = log + [classificação → agregados] numa transação ─► eng_refresh_log
pg_cron 'eng-refresh-diario' 09:00 UTC (06:00 BRT) ─► eng_refresh('cron')
```

Garantias do pipeline:
- **Idempotência:** cada execução reconstrói tudo (`DELETE` + `INSERT`) a partir das fontes. Rodar duas vezes dá o mesmo resultado.
- **Leitura sem bloqueio:** usa `DELETE`, não `TRUNCATE`. O `TRUNCATE` pega `ACCESS EXCLUSIVE` e travaria as RPCs durante o refresh. Com `DELETE`, as RPCs continuam lendo a versão anterior (MVCC) até o `COMMIT`.
- **Atomicidade:** `eng_refresh` roda classificação e agregados dentro de um bloco `BEGIN … EXCEPTION`. Se qualquer passo falhar, as tabelas voltam ao estado anterior e o log fica com `status='erro'`.
- **Exclusão mútua:** `pg_try_advisory_xact_lock(hashtext('eng_refresh'))`.
- **Tabelas temporárias com índice:** em 22/10, consultas com CTE sem índice sobre os contextos estouraram o timeout de 2 min. A forma abaixo foi validada numa janela de 22 dias (32.677 questões) e roda em segundos. Para o histórico inteiro, a estimativa é de 1 a 5 min.

### 6.2 `eng_refresh_classificacao()`

A regra (D2) roda **por questão**, sobre as entradas válidas do array `taxonomias`:
- **Entrada válida:** `ciclo` ∈ {clínico, básico} e `especialidade_id`/`subespecialidade_id` não nulos.
- **Entrada completa:** ciclo básico, ou ciclo clínico com `tema_id` não nulo. Como o básico não tem tema, toda entrada válida do básico conta como "completa" para a regra.
- **Casa com quiz:** em **alguma** resposta da questão (de qualquer aluno ou IES), algum `contextos_candidatos[].quiz_especialidade` normalizado (`eng_norm_rotulo`) é igual ao nome normalizado do nível 1 **ou** do nível 2 da entrada.
- **Ordem de escolha:** `completa DESC, casa_quiz DESC, posição ASC`. Fica a 1ª.

```sql
CREATE OR REPLACE FUNCTION public.eng_refresh_classificacao() RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE
  v_invalidas  integer;
  v_depara_inv integer;
  v_result     jsonb;
BEGIN
  -- 1. uma linha por questão (taxonomia é estável por questão; pega a resposta mais recente)
  DROP TABLE IF EXISTS tmp_eng_q;
  CREATE TEMP TABLE tmp_eng_q ON COMMIT DROP AS
    SELECT DISTINCT ON (f.question_id) f.question_id, f.taxonomias
    FROM public.fato_resolucao_questoes_b2b f
    ORDER BY f.question_id, f.response_timestamp DESC, f.response_id DESC;
  CREATE UNIQUE INDEX ON tmp_eng_q (question_id);

  -- 2. entradas explodidas
  DROP TABLE IF EXISTS tmp_eng_ent;
  CREATE TEMP TABLE tmp_eng_ent ON COMMIT DROP AS
    SELECT q.question_id,
           t.ord::smallint                                   AS ord,
           CASE t.v->>'ciclo'
             WHEN 'Questões Ciclo Clínico e Residência Médica' THEN 'clinico'
             WHEN 'Ciclo Básico'                              THEN 'basico'
           END                                               AS ciclo,
           t.v->>'especialidade_id'                          AS n1_id,
           btrim(t.v->>'especialidade')                      AS n1_nome,
           t.v->>'subespecialidade_id'                       AS n2_id,
           btrim(t.v->>'subespecialidade')                   AS n2_nome,
           t.v->>'tema_id'                                   AS tema_id,
           btrim(t.v->>'tema')                               AS tema_nome
    FROM tmp_eng_q q
    CROSS JOIN LATERAL jsonb_array_elements(q.taxonomias) WITH ORDINALITY AS t(v, ord);

  DELETE FROM tmp_eng_ent
  WHERE ciclo IS NULL OR n1_id IS NULL OR n2_id IS NULL
     OR coalesce(n1_nome, '') = '' OR coalesce(n2_nome, '') = '';
  GET DIAGNOSTICS v_invalidas = ROW_COUNT;
  CREATE INDEX ON tmp_eng_ent (question_id);
  ANALYZE tmp_eng_ent;

  -- 3. nós (upsert; nunca apaga). Ordem: nível 1, 2, 3 (FK de pai_id)
  INSERT INTO public.eng_no_taxonomia (no_id, nivel, ciclo, nome, pai_id, sintetico)
  SELECT DISTINCT ON (n1_id) n1_id, 1, ciclo, n1_nome, NULL, false
  FROM tmp_eng_ent ORDER BY n1_id
  ON CONFLICT (no_id) DO UPDATE SET nome = EXCLUDED.nome, atualizado_em = now();

  INSERT INTO public.eng_no_taxonomia (no_id, nivel, ciclo, nome, pai_id, sintetico)
  SELECT DISTINCT ON (n2_id) n2_id, 2, ciclo, n2_nome, n1_id, false
  FROM tmp_eng_ent ORDER BY n2_id
  ON CONFLICT (no_id) DO UPDATE SET nome = EXCLUDED.nome, pai_id = EXCLUDED.pai_id, atualizado_em = now();

  INSERT INTO public.eng_no_taxonomia (no_id, nivel, ciclo, nome, pai_id, sintetico)
  SELECT DISTINCT ON (tema_id) tema_id, 3, 'clinico', tema_nome, n2_id, false
  FROM tmp_eng_ent WHERE ciclo = 'clinico' AND tema_id IS NOT NULL AND coalesce(tema_nome, '') <> ''
  ORDER BY tema_id
  ON CONFLICT (no_id) DO UPDATE SET nome = EXCLUDED.nome, pai_id = EXCLUDED.pai_id, atualizado_em = now();

  -- tema sintético (D13): mesmo nome da especialidade
  INSERT INTO public.eng_no_taxonomia (no_id, nivel, ciclo, nome, pai_id, sintetico)
  SELECT DISTINCT ON (n2_id) 'herdado:' || n2_id, 3, 'clinico', n2_nome, n2_id, true
  FROM tmp_eng_ent WHERE ciclo = 'clinico' AND (tema_id IS NULL OR coalesce(tema_nome, '') = '')
  ORDER BY n2_id
  ON CONFLICT (no_id) DO UPDATE SET nome = EXCLUDED.nome, atualizado_em = now();

  -- 4. contextos por questão (lê o JSON uma vez; agrupa o jsonb antes de explodir)
  DROP TABLE IF EXISTS tmp_eng_ctx;
  CREATE TEMP TABLE tmp_eng_ctx ON COMMIT DROP AS
    SELECT b.question_id,
           public.eng_norm_rotulo(c.v->>'quiz_especialidade') AS quiz_norm,
           public.eng_norm_texto(c.v->>'conteudo_caminho')    AS caminho_norm,
           sum(b.respostas)::int                              AS respostas
    FROM (
      SELECT f.question_id, f.contextos_candidatos, count(*) AS respostas
      FROM public.fato_resolucao_questoes_b2b f
      WHERE f.contexto_status <> 'ausente'
      GROUP BY 1, 2
    ) b
    CROSS JOIN LATERAL jsonb_array_elements(b.contextos_candidatos) AS c(v)
    GROUP BY 1, 2, 3;
  DELETE FROM tmp_eng_ctx WHERE quiz_norm IS NULL;
  CREATE INDEX ON tmp_eng_ctx (question_id, quiz_norm);
  ANALYZE tmp_eng_ctx;

  -- 5. escolha pela regra
  DROP TABLE IF EXISTS tmp_eng_escolha;
  CREATE TEMP TABLE tmp_eng_escolha ON COMMIT DROP AS
  WITH cand AS (
    SELECT e.question_id, e.ord, e.ciclo, e.n1_id, e.n2_id,
           CASE WHEN e.ciclo = 'clinico'
                THEN CASE WHEN e.tema_id IS NOT NULL AND coalesce(e.tema_nome, '') <> '' THEN e.tema_id
                          ELSE 'herdado:' || e.n2_id END
           END                                                         AS n3_id,
           (e.ciclo = 'basico' OR (e.tema_id IS NOT NULL AND coalesce(e.tema_nome, '') <> '')) AS completa,
           bool_or(c.quiz_norm IS NOT NULL)                            AS casa_quiz
    FROM tmp_eng_ent e
    LEFT JOIN tmp_eng_ctx c
      ON c.question_id = e.question_id
     AND c.quiz_norm IN (public.eng_norm_rotulo(e.n1_nome), public.eng_norm_rotulo(e.n2_nome))
    GROUP BY e.question_id, e.ord, e.ciclo, e.n1_id, e.n2_id, e.tema_id, e.tema_nome
  ),
  rk AS (
    SELECT c.*,
      count(*) OVER (PARTITION BY c.question_id)                                       AS n_cand,
      count(*) FILTER (WHERE c.completa) OVER (PARTITION BY c.question_id)             AS n_comp,
      count(*) FILTER (WHERE c.casa_quiz) OVER (PARTITION BY c.question_id, c.completa) AS n_quiz_mesmo_nivel,
      row_number() OVER (PARTITION BY c.question_id ORDER BY c.completa DESC, c.casa_quiz DESC, c.ord) AS rn
    FROM cand c
  )
  SELECT question_id, ciclo, n1_id, n2_id, n3_id, ord AS posicao, n_cand,
         CASE WHEN n_cand = 1                           THEN 'unica'
              WHEN n_comp = 1                           THEN 'completa'
              WHEN casa_quiz AND n_quiz_mesmo_nivel = 1 THEN 'quiz'
              ELSE 'primeira' END AS motivo
  FROM rk WHERE rn = 1;
  CREATE UNIQUE INDEX ON tmp_eng_escolha (question_id);

  -- 6. de-para (§6.3) para quem ficou sem escolha
  SELECT count(*) INTO v_depara_inv
  FROM public.eng_depara_quiz_no dp
  JOIN public.eng_no_taxonomia n ON n.no_id = dp.folha_id
  WHERE NOT ((n.ciclo = 'clinico' AND n.nivel = 3) OR (n.ciclo = 'basico' AND n.nivel = 2));

  DROP TABLE IF EXISTS tmp_eng_depara;
  CREATE TEMP TABLE tmp_eng_depara ON COMMIT DROP AS
  WITH sem AS (
    SELECT q.question_id FROM tmp_eng_q q
    WHERE NOT EXISTS (SELECT 1 FROM tmp_eng_escolha e WHERE e.question_id = q.question_id)
  ),
  hit AS (
    SELECT c.question_id, c.quiz_norm, c.caminho_norm, c.respostas, d.folha_id
    FROM tmp_eng_ctx c
    JOIN sem ON sem.question_id = c.question_id
    JOIN LATERAL (
      SELECT dp.folha_id
      FROM public.eng_depara_quiz_no dp
      JOIN public.eng_no_taxonomia n ON n.no_id = dp.folha_id
       AND ((n.ciclo = 'clinico' AND n.nivel = 3) OR (n.ciclo = 'basico' AND n.nivel = 2))
      WHERE dp.quiz_especialidade_norm = c.quiz_norm
        AND (dp.conteudo_caminho_norm = c.caminho_norm OR dp.conteudo_caminho_norm IS NULL)
      ORDER BY (dp.conteudo_caminho_norm IS NULL)       -- caminho exato antes do genérico
      LIMIT 1
    ) d ON true
  )
  SELECT DISTINCT ON (question_id) question_id, folha_id
  FROM hit
  ORDER BY question_id, respostas DESC, quiz_norm, caminho_norm NULLS LAST;

  -- 7. grava (rebuild)
  DELETE FROM public.eng_questao_classificacao;

  INSERT INTO public.eng_questao_classificacao
    (question_id, ciclo, n1_id, n2_id, n3_id, folha_id, esp_id, origem, motivo, n_candidatas, posicao_escolhida)
  SELECT e.question_id, e.ciclo, e.n1_id, e.n2_id, e.n3_id,
         coalesce(e.n3_id, e.n2_id),
         CASE WHEN e.ciclo = 'clinico' THEN e.n2_id ELSE e.n1_id END,
         'taxonomia', e.motivo, e.n_cand, e.posicao
  FROM tmp_eng_escolha e;

  INSERT INTO public.eng_questao_classificacao
    (question_id, ciclo, n1_id, n2_id, n3_id, folha_id, esp_id, origem, motivo, n_candidatas, posicao_escolhida)
  SELECT d.question_id, f.ciclo,
         CASE WHEN f.ciclo = 'clinico' THEN p.pai_id ELSE f.pai_id END,   -- n1
         CASE WHEN f.ciclo = 'clinico' THEN f.pai_id ELSE f.no_id  END,   -- n2
         CASE WHEN f.ciclo = 'clinico' THEN f.no_id  END,                 -- n3
         f.no_id,                                                         -- folha
         f.pai_id,                                                        -- esp: o pai da folha nos dois ciclos (clínico: especialidade; básico: disciplina)
         'depara', 'depara', 0, NULL
  FROM tmp_eng_depara d
  JOIN public.eng_no_taxonomia f ON f.no_id = d.folha_id
  LEFT JOIN public.eng_no_taxonomia p ON p.no_id = f.pai_id;

  SELECT jsonb_build_object(
    'questoes_total',          (SELECT count(*) FROM tmp_eng_q),
    'entradas_invalidas',      v_invalidas,
    'classificadas_unica',     (SELECT count(*) FROM tmp_eng_escolha WHERE motivo = 'unica'),
    'classificadas_completa',  (SELECT count(*) FROM tmp_eng_escolha WHERE motivo = 'completa'),
    'classificadas_quiz',      (SELECT count(*) FROM tmp_eng_escolha WHERE motivo = 'quiz'),
    'classificadas_primeira',  (SELECT count(*) FROM tmp_eng_escolha WHERE motivo = 'primeira'),
    'classificadas_depara',    (SELECT count(*) FROM tmp_eng_depara),
    'sem_classificacao',       (SELECT count(*) FROM tmp_eng_q) - (SELECT count(*) FROM public.eng_questao_classificacao),
    'depara_linhas',           (SELECT count(*) FROM public.eng_depara_quiz_no),
    'depara_invalidos',        v_depara_inv,
    'nos_total',               (SELECT count(*) FROM public.eng_no_taxonomia)
  ) INTO v_result;
  RETURN v_result;
END $$;
```

Ordem de grandeza esperada no 1º refresh (22/10/2026, com o de-para vazio):

| Contagem | Valor esperado |
|---|---|
| `questoes_total` | ≈ 84.745 |
| `entradas_invalidas` | 0 |
| `unica` | ≈ 56.491 |
| `completa` + `quiz` + `primeira` | ≈ 11.301 |
| `sem_classificacao` | ≈ 16.953 |
| `classificadas_depara` | 0 |

Numa janela de outubro/2026, a regra deu `quiz` = 1.779 questões. Em 1.014 delas, a escolha difere da 1ª do array.

### 6.3 Ponto de encaixe do de-para (sem conteúdo)

- **Quem entra:** só questões **sem nenhuma entrada válida** em `taxonomias`. Uma questão com taxonomia nunca é reclassificada pelo de-para.
- **Qual contexto vence:**
  - considere todos os contextos da questão (em todas as respostas) que têm linha no de-para;
  - a linha pode ser exata (`quiz_especialidade_norm` + `conteudo_caminho_norm`) ou genérica (`conteudo_caminho_norm IS NULL`); a exata vence a genérica;
  - entre os contextos, vence o de mais respostas;
  - empate: `quiz_norm` asc, depois `caminho_norm` asc.
- **Efeito de inserir linhas:** nada muda até o próximo refresh (cron das 06:00 ou manual). A partir dele, as questões entram nas contagens de questões e aparecem nas gavetas. Os totais continuam fechando porque tudo sai das mesmas tabelas.
- **As 3.273 questões sem taxonomia e sem contexto nunca entram.** Consulta de acompanhamento: V3 (§14).

### 6.4 `eng_refresh_agregados()` e `eng_refresh()`

```sql
CREATE OR REPLACE FUNCTION public.eng_refresh_agregados() RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE v_result jsonb;
BEGIN
  -- a) consumo: 1 linha por aluno × dia × conteúdo (D5); curso/módulo do 1º evento do dia
  DELETE FROM public.eng_consumo_aluno_dia_conteudo;
  INSERT INTO public.eng_consumo_aluno_dia_conteudo
    (sanarflix_user_id, dia, content_id, content_type, content_name, especialidade, modulo, aberturas, ultima_abertura)
  SELECT p.sanarflix_user_id, p.event_date, p.content_id, p.content_type,
         coalesce(nullif(btrim(p.content_name), ''), 'Conteúdo sem título'),
         coalesce(public.eng_rotulo_curso(p.course_name), 'Outros conteúdos'),
         coalesce(nullif(btrim(regexp_replace(coalesce(p.module_name, ''), '\s+', ' ', 'g')), ''), 'Materiais gerais'),
         g.aberturas, g.ultima
  FROM (
    SELECT DISTINCT ON (f.sanarflix_user_id, f.event_date, f.content_id)
           f.sanarflix_user_id, f.event_date, f.content_id, f.content_type, f.content_name, f.course_name, f.module_name
    FROM public.fato_consumo_conteudo_b2b f
    ORDER BY f.sanarflix_user_id, f.event_date, f.content_id, f.event_timestamp, f.event_key
  ) p
  JOIN (
    SELECT f.sanarflix_user_id, f.event_date, f.content_id, count(*)::int AS aberturas, max(f.event_timestamp) AS ultima
    FROM public.fato_consumo_conteudo_b2b f
    GROUP BY 1, 2, 3
  ) g USING (sanarflix_user_id, event_date, content_id);

  -- b) questões classificadas por aluno × dia × folha
  DELETE FROM public.eng_questoes_aluno_dia_no;
  INSERT INTO public.eng_questoes_aluno_dia_no
    (sanarflix_user_id, dia, folha_id, ciclo, n1_id, n2_id, n3_id, esp_id, questoes, acertos, erros)
  SELECT f.sanarflix_user_id, f.response_date, c.folha_id, c.ciclo, c.n1_id, c.n2_id, c.n3_id, c.esp_id,
         count(*)::int,
         count(*) FILTER (WHERE f.acertou IS TRUE)::int,
         count(*) FILTER (WHERE f.acertou IS FALSE)::int
  FROM public.fato_resolucao_questoes_b2b f
  JOIN public.eng_questao_classificacao c ON c.question_id = f.question_id
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;

  -- c) atividade por aluno × dia (união das duas fontes, D4)
  DELETE FROM public.eng_atividade_aluno_dia;
  INSERT INTO public.eng_atividade_aluno_dia
    (sanarflix_user_id, dia, respostas_todas, questoes, acertos, erros, videos, documentos)
  SELECT u.sanarflix_user_id, u.dia,
         sum(u.rt)::int, sum(u.q)::int, sum(u.ac)::int, sum(u.er)::int, sum(u.vi)::int, sum(u.dc)::int
  FROM (
    SELECT f.sanarflix_user_id, f.response_date AS dia, count(*) AS rt, 0 AS q, 0 AS ac, 0 AS er, 0 AS vi, 0 AS dc
    FROM public.fato_resolucao_questoes_b2b f
    GROUP BY 1, 2
    UNION ALL
    SELECT x.sanarflix_user_id, x.dia, 0, sum(x.questoes), sum(x.acertos), sum(x.erros), 0, 0
    FROM public.eng_questoes_aluno_dia_no x
    GROUP BY 1, 2
    UNION ALL
    SELECT k.sanarflix_user_id, k.dia, 0, 0, 0, 0,
           count(*) FILTER (WHERE k.content_type = 'video'),
           count(*) FILTER (WHERE k.content_type = 'document')
    FROM public.eng_consumo_aluno_dia_conteudo k
    GROUP BY 1, 2
  ) u
  GROUP BY 1, 2;

  SELECT jsonb_build_object(
    'consumo_linhas',      (SELECT count(*) FROM public.eng_consumo_aluno_dia_conteudo),
    'questoes_no_linhas',  (SELECT count(*) FROM public.eng_questoes_aluno_dia_no),
    'atividade_linhas',    (SELECT count(*) FROM public.eng_atividade_aluno_dia),
    'fonte_max_resposta',  (SELECT max(response_date) FROM public.fato_resolucao_questoes_b2b),
    'fonte_max_consumo',   (SELECT max(event_date) FROM public.fato_consumo_conteudo_b2b),
    'dim_snapshot',        (SELECT max(snapshot_date) FROM public.dim_aluno_b2b)
  ) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.eng_refresh(p_disparo text DEFAULT 'manual') RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE
  v_log bigint;
  v_c   jsonb;
  v_a   jsonb;
BEGIN
  IF p_disparo NOT IN ('cron', 'manual') THEN
    RAISE EXCEPTION 'disparo_invalido' USING ERRCODE = '22023';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('eng_refresh')) THEN
    RAISE EXCEPTION 'eng_refresh_ja_em_execucao';
  END IF;

  INSERT INTO public.eng_refresh_log (status, disparo) VALUES ('rodando', p_disparo) RETURNING id INTO v_log;

  BEGIN
    v_c := public.eng_refresh_classificacao();
    v_a := public.eng_refresh_agregados();
    UPDATE public.eng_refresh_log
       SET status = 'ok', terminado_em = clock_timestamp(), contagens = v_c || v_a
     WHERE id = v_log;
  EXCEPTION WHEN OTHERS THEN
    -- desfaz só o bloco (as tabelas eng_* voltam ao estado anterior); o log registra o erro
    UPDATE public.eng_refresh_log
       SET status = 'erro', terminado_em = clock_timestamp(), erro = SQLSTATE || ': ' || SQLERRM
     WHERE id = v_log;
  END;

  RETURN (SELECT to_jsonb(l) FROM public.eng_refresh_log l WHERE l.id = v_log);
END $$;
```

Grants das 3 funções de pipeline: `REVOKE ALL ON FUNCTION public.eng_refresh_classificacao(), public.eng_refresh_agregados(), public.eng_refresh(text) FROM PUBLIC, anon, authenticated;`. Só `postgres` executa — o dono, o cron e o SQL Editor/MCP.

### 6.5 Execução, timeout e cron

- **`statement_timeout`.** O `WHEN OTHERS` **não** captura cancelamento por timeout (`query_canceled`). Se o refresh estourar o tempo, a transação inteira volta e **nem a linha de log fica**. Por isso toda execução fixa o timeout no **mesmo comando**, antes da chamada:
  ```sql
  SET statement_timeout TO '30min';
  SELECT public.eng_refresh('manual');
  ```
  No MCP `execute_sql`, mande as duas instruções na mesma chamada. Se o MCP ainda cortar em 2 min, rode por um job avulso do cron e acompanhe pelo `eng_refresh_log`:
  ```sql
  SELECT cron.schedule('eng-refresh-avulso', '* * * * *',
    $$SET statement_timeout TO '30min'; SELECT public.eng_refresh('manual'); SELECT cron.unschedule('eng-refresh-avulso');$$);
  ```
- **Job diário (D16)**, criado na migration A6:
  ```sql
  SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'eng-refresh-diario';   -- idempotência
  SELECT cron.schedule(
    'eng-refresh-diario',
    '0 9 * * *',                                   -- 09:00 UTC = 06:00 America/Sao_Paulo
    $$SET statement_timeout TO '30min'; SELECT public.eng_refresh('cron');$$
  );
  ```
- **Carga externa atrasada.** O refresh lê o que estiver nas fontes às 06:00. Se a dim ou o consumo não tiverem chegado, os números refletem a carga anterior. `contagens` registra `dim_snapshot`, `fonte_max_consumo` e `fonte_max_resposta` para diagnóstico. A tela mostra "atualizado em" com o horário real do refresh. **Não** há retentativa automática.
- **Monitoramento.**
  ```sql
  SELECT id, iniciado_em, terminado_em, status, disparo, erro, contagens
  FROM public.eng_refresh_log ORDER BY id DESC LIMIT 5;
  ```
  Duração = `terminado_em − iniciado_em`. Se passar de 15 min, pare e avise o João (§3.3).

---

## 7. Autorização e convenções das RPCs

### 7.1 RPCs do gestor (`get_gestor_engajamento_*`)

Todas seguem **exatamente** o cabeçalho e a ordem de guardas de `get_gestor_prova_oficial` (`supabase/migrations/20260929133142_prova_oficial_rpc_gestor.sql`), porque os testes estáticos do repo verificam essa forma:

```sql
CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_<nome>(p_ies_id uuid, …)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ies uuid;
  …
BEGIN
  -- (1) papel
  IF NOT ( has_role(v_uid,'admin'::app_role) OR has_role(v_uid,'gestor'::app_role) OR has_role(v_uid,'gestor_grupo'::app_role) ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  -- (2) resolução de v_ies
  IF p_ies_id IS NOT NULL THEN
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN v_ies := (public.get_accessible_ies(v_uid))[1]; END IF;
  END IF;
  IF v_ies IS NULL THEN RAISE EXCEPTION 'IES not resolved'; END IF;
  -- (3) autorização da IES resolvida
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;
  -- (4) validação de parâmetros (§7.3)
  …
END;
$function$;

REVOKE ALL ON FUNCTION public.get_gestor_engajamento_<nome>(<tipos>) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_<nome>(<tipos>) TO authenticated;
```

Proibições:
- **Nenhuma** RPC nova referencia `ies_features`, `feature_catalog`, `gestao.portal_v2`, `gestao.enabled` ou `user_has_feature*`. O teste `gestorMigrationsAvisosAlunoContatoContexto.test.ts` varre toda `get_gestor_*` procurando isso.
- **Nenhuma** RPC lê `fato_*` ou `taxonomias`/`contextos_candidatos`: só `eng_*`, `dim_aluno_b2b` (via `eng_base_ativa`), `ies` e, no admin, as tabelas de simulado/TRI da proficiência.

### 7.2 RPC do admin (`get_admin_engajamento`)

Segue o padrão de `admin_monitor_summary` (`supabase/migrations/20260707172740_*.sql`):

```sql
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
…
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
…
REVOKE ALL ON FUNCTION public.get_admin_engajamento(date, date, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_engajamento(date, date, smallint) TO authenticated;
```

**Não devolve dado individual de aluno** (nome, e-mail, id): só agregados por IES, mês e semestre.

### 7.3 Validação de parâmetros (todas as RPCs)

| Condição | Erro (`RAISE EXCEPTION '<código>' USING ERRCODE = '22023'`) |
|---|---|
| período inválido (§5.6 `eng_validar_periodo`) | `periodo_invalido` |
| `p_semestre` fora de 1–12 | `semestre_invalido` |
| `p_semestre` e `p_aluno` juntos | `filtro_conflitante` |
| `p_aluno` não pertence à base ativa da IES | `aluno_fora_do_recorte` |
| `p_ordem` fora da lista | `ordem_invalida` |
| `p_categoria` fora da lista | `categoria_invalida` |
| `p_tipo` fora de `todos`/`video`/`document` | `tipo_invalido` |
| `p_page < 1` ou `p_page_size` fora do limite | `paginacao_invalida` |
| `p_folha_id` não é folha | `no_invalido` |
| conteúdo inexistente no recorte | não é erro: devolve `resumo` zerado e `alunos: []` |

### 7.4 Envelope e `meta`

Toda RPC devolve `{ "data": …, "meta": … }`.

- O **literal** `'data', jsonb_build_object(` precisa aparecer no corpo. O teste `contratoEnvelopeRpc.test.ts` extrai as chaves de primeiro nível a partir dele.
- `meta` vem de uma função auxiliar (interna, com `REVOKE` de `PUBLIC, anon, authenticated`):

```sql
CREATE OR REPLACE FUNCTION public.eng_meta(p_inicio date, p_fim date, p_low boolean, p_criterio text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'periodo',      to_char(p_inicio, 'DD/MM/YYYY') || ' a ' || to_char(p_fim, 'DD/MM/YYYY'),
    'fonte',        'SanarFlix: dim_aluno_b2b · fato_consumo_conteudo_b2b · fato_resolucao_questoes_b2b (camada eng_*)',
    'atualizadoEm', public.eng_atualizado_em(),        -- ISO 8601 ou null
    'criterio',     p_criterio,
    'partial',      p_fim = public.eng_hoje(),
    'lowSample',    p_low
  )
$$;
```

`p_criterio` é escrito em linguagem de negócio, **sem nome de tabela ou coluna**: chega cru no tooltip de rastreabilidade (`TooltipRastreabilidade.tsx`). Textos fixos:

| Onde | `criterio` |
|---|---|
| Todas as RPCs do gestor | `Base ativa: alunos com perfil de aluno e acesso ativo hoje, do 1º ao 12º semestre. Engajado: ao menos um dia com questão respondida ou conteúdo aberto no período. Questões contam só quando a questão tem classificação principal; acerto = corretas ÷ (corretas + erradas). Conteúdo consumido = aluno × conteúdo × dia. Tempo sem atividade é contado até hoje.` |
| `get_admin_engajamento` | o mesmo texto + ` Proficiência: % de alunos com 60 pontos ou mais no simulado ENAMED mais recente da IES (melhor tentativa por aluno).` |

`p_low` = base do recorte < 10.

### 7.5 Tipos JSON

| Conteúdo | Formato no JSON |
|---|---|
| Datas `date` | string `"AAAA-MM-DD"` |
| Meses | string `"AAAA-MM"` |
| Percentuais | `numeric` com 1 casa ou `null`. A tela arredonda conforme a §12. |
| Contagens | inteiros |
| Ausência de valor | `null`, nunca `0` |

---

## 8. Contratos das RPCs

Notação dos parâmetros comuns:
- `p_ies_id uuid`: IES; nulo = IES do usuário (padrão do portal).
- `p_inicio date`, `p_fim date`: período.
- `p_semestre smallint`: `NULL` = todos.

O SQL de referência abaixo **é o corpo a implementar**. Ajustes só de sintaxe são permitidos; mudança de regra exige o João (§3.3).

**Como ler o SQL das §8.2–§8.10:** os trechos mostram só o corpo depois das guardas. O cabeçalho, o `DECLARE` e as guardas 1–3 são idênticos aos da §8.1 (no admin, a guarda é a da §7.2). A validação de período e de semestre também se repete. Cada função declara, além de `v_uid`, `v_ies`, `v_criterio` (texto da §7.4) e `v_r jsonb`, só as variáveis que usa:
- `v_busca text`;
- `v_desc boolean`;
- `v_sem smallint`;
- `v_n integer`;
- `v_ini_ant date`;
- `v_criterio_admin text`.

Toda função termina com `RETURN v_r;`. Os grants seguem a §7.1/§7.2.

### 8.1 `get_gestor_engajamento_visao_geral(p_ies_id uuid, p_inicio date, p_fim date, p_semestre smallint DEFAULT NULL, p_aluno text DEFAULT NULL)`

Alimenta a aba Visão geral **inteira**, exceto a tabela "Por aluno" (§8.2), as listas completas (§8.3) e o drawer (§8.4). `p_aluno` é o `sanarflix_user_id` do aluno filtrado.

```sql
CREATE OR REPLACE FUNCTION public.get_gestor_engajamento_visao_geral(
  p_ies_id   uuid,
  p_inicio   date,
  p_fim      date,
  p_semestre smallint DEFAULT NULL,
  p_aluno    text     DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_ies       uuid;
  v_hoje      date := public.eng_hoje();
  v_n         integer;
  v_ini_ant   date;
  v_mes_ref   date;
  v_sem_aluno smallint;
  v_ies_json  jsonb;
  v_criterio  text := 'Base ativa: alunos com perfil de aluno e acesso ativo hoje, do 1º ao 12º semestre. Engajado: ao menos um dia com questão respondida ou conteúdo aberto no período. Questões contam só quando a questão tem classificação principal; acerto = corretas ÷ (corretas + erradas). Conteúdo consumido = aluno × conteúdo × dia. Tempo sem atividade é contado até hoje.';
  v_r         jsonb;
BEGIN
  IF NOT ( has_role(v_uid,'admin'::app_role) OR has_role(v_uid,'gestor'::app_role) OR has_role(v_uid,'gestor_grupo'::app_role) ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_ies_id IS NOT NULL THEN
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN v_ies := (public.get_accessible_ies(v_uid))[1]; END IF;
  END IF;
  IF v_ies IS NULL THEN RAISE EXCEPTION 'IES not resolved'; END IF;
  IF NOT public.gestor_pode_acessar_ies(v_ies) THEN
    RAISE EXCEPTION 'Permission denied: cannot access this IES';
  END IF;

  PERFORM public.eng_validar_periodo(p_inicio, p_fim);
  IF p_semestre IS NOT NULL AND p_semestre NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;
  IF p_semestre IS NOT NULL AND p_aluno IS NOT NULL THEN
    RAISE EXCEPTION 'filtro_conflitante' USING ERRCODE = '22023';
  END IF;
  IF p_aluno IS NOT NULL THEN
    SELECT b.semestre INTO v_sem_aluno FROM public.eng_base_ativa(v_ies) b WHERE b.sanarflix_user_id = p_aluno;
    IF NOT FOUND THEN RAISE EXCEPTION 'aluno_fora_do_recorte' USING ERRCODE = '22023'; END IF;
  END IF;

  v_n       := p_fim - p_inicio + 1;
  v_ini_ant := p_inicio - v_n;
  v_mes_ref := CASE WHEN p_fim = (date_trunc('month', p_fim) + interval '1 month - 1 day')::date
                    THEN date_trunc('month', p_fim)::date
                    ELSE (date_trunc('month', p_fim) - interval '1 month')::date END;
  SELECT jsonb_build_object('id', i.id, 'nome', i.nome) INTO v_ies_json FROM public.ies i WHERE i.id = v_ies;

  WITH
  ies_r AS MATERIALIZED (SELECT * FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim)),
  r AS MATERIALIZED (
    SELECT * FROM ies_r x
    WHERE (p_semestre IS NULL OR x.semestre = p_semestre)
      AND (p_aluno IS NULL OR x.sanarflix_user_id = p_aluno)
  ),
  k AS (
    SELECT count(*)                                                  AS base,
      count(*) FILTER (WHERE dias_ativos_periodo > 0)                AS eng,
      count(*) FILTER (WHERE dias_ativos_ant > 0)                    AS eng_ant,
      count(*) FILTER (WHERE faixa_recencia = 'ativos30')            AS ativos30,
      count(*) FILTER (WHERE faixa_recencia = 'sumidos30a59')        AS s3059,
      count(*) FILTER (WHERE faixa_recencia = 'sumidos60')           AS s60,
      count(*) FILTER (WHERE faixa_recencia = 'nunca_acessou')       AS nunca,
      coalesce(sum(questoes), 0) AS q,  coalesce(sum(acertos), 0) AS ac, coalesce(sum(erros), 0) AS er,
      coalesce(sum(videos), 0)   AS vi, coalesce(sum(documentos), 0) AS dc,
      coalesce(sum(questoes_ant), 0) AS q_ant, coalesce(sum(acertos_ant), 0) AS ac_ant, coalesce(sum(erros_ant), 0) AS er_ant,
      coalesce(sum(videos_ant), 0)   AS vi_ant, coalesce(sum(documentos_ant), 0) AS dc_ant,
      count(*) FILTER (WHERE questoes > 0)   AS al_q,
      count(*) FILTER (WHERE videos > 0)     AS al_v,
      count(*) FILTER (WHERE documentos > 0) AS al_d,
      count(*) FILTER (WHERE dias_ativos_mes_ref > 0)              AS h_ativos,
      count(*) FILTER (WHERE dias_ativos_mes_ref BETWEEN 1 AND 3)  AS h1,
      count(*) FILTER (WHERE dias_ativos_mes_ref BETWEEN 4 AND 7)  AS h2,
      count(*) FILTER (WHERE dias_ativos_mes_ref BETWEEN 8 AND 14) AS h3,
      count(*) FILTER (WHERE dias_ativos_mes_ref >= 15)            AS h4
    FROM r
  ),
  ki AS (   -- IES inteira: notas "média da IES" / "IES inteira"
    SELECT count(*) AS base, count(*) FILTER (WHERE dias_ativos_periodo > 0) AS eng,
      coalesce(sum(questoes), 0) AS q, coalesce(sum(acertos), 0) AS ac, coalesce(sum(erros), 0) AS er,
      coalesce(sum(videos), 0) AS vi, coalesce(sum(documentos), 0) AS dc
    FROM ies_r
  ),
  ks AS (   -- semestre do aluno filtrado: notas "média do semestre"
    SELECT count(*) AS base, count(*) FILTER (WHERE dias_ativos_periodo > 0) AS eng,
      coalesce(sum(questoes), 0) AS q, coalesce(sum(acertos), 0) AS ac, coalesce(sum(erros), 0) AS er,
      coalesce(sum(videos), 0) AS vi, coalesce(sum(documentos), 0) AS dc
    FROM ies_r WHERE semestre = v_sem_aluno
  ),
  meses AS (
    SELECT m.mes::date AS mes,
      (m.mes::date < p_inicio OR (m.mes + interval '1 month - 1 day')::date > p_fim) AS parcial,
      coalesce(x.alunos, 0) AS alunos, coalesce(x.dias, 0) AS dias,
      coalesce(x.q, 0) AS q, coalesce(x.ac, 0) AS ac, coalesce(x.er, 0) AS er,
      coalesce(x.vi, 0) AS vi, coalesce(x.dc, 0) AS dc
    FROM generate_series(date_trunc('month', p_inicio), date_trunc('month', p_fim), interval '1 month') AS m(mes)
    LEFT JOIN (
      SELECT date_trunc('month', a.dia)::date AS mes,
             count(DISTINCT a.sanarflix_user_id) AS alunos, count(*) AS dias,
             sum(a.questoes) AS q, sum(a.acertos) AS ac, sum(a.erros) AS er,
             sum(a.videos) AS vi, sum(a.documentos) AS dc
      FROM public.eng_atividade_aluno_dia a
      JOIN r ON r.sanarflix_user_id = a.sanarflix_user_id
      WHERE a.dia BETWEEN p_inicio AND p_fim
      GROUP BY 1
    ) x ON x.mes = m.mes::date
  ),
  esp AS (
    SELECT n.no_id, n.nome, n.ciclo, sum(x.questoes) AS q, sum(x.acertos) AS ac, sum(x.erros) AS er
    FROM public.eng_questoes_aluno_dia_no x
    JOIN r ON r.sanarflix_user_id = x.sanarflix_user_id
    JOIN public.eng_no_taxonomia n ON n.no_id = x.esp_id
    WHERE x.dia BETWEEN p_inicio AND p_fim
    GROUP BY n.no_id, n.nome, n.ciclo
    ORDER BY sum(x.questoes) DESC, n.nome
    LIMIT 6
  ),
  niv AS (
    SELECT nv.nivel, nv.ordem,
      (SELECT count(*) FROM r WHERE r.nivel = nv.nivel) AS total,
      coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', s.sanarflix_user_id, 'nome', s.nome) ORDER BY s.o, s.nome)
        FROM (
          SELECT r.sanarflix_user_id, r.nome, coalesce(r.dias_sem_atividade, 2147483647) AS o
          FROM r WHERE r.nivel = nv.nivel
          ORDER BY coalesce(r.dias_sem_atividade, 2147483647), r.nome
          LIMIT 3
        ) s
      ), '[]'::jsonb) AS amostra
    FROM (VALUES ('frequente', 1), ('esporadico', 2), ('parou', 3), ('nunca', 4)) AS nv(nivel, ordem)
  ),
  prev AS (
    SELECT r.sanarflix_user_id, r.nome, r.semestre, r.ultima_atividade, r.dias_sem_atividade
    FROM r WHERE r.faixa_recencia IN ('sumidos30a59', 'sumidos60')
    ORDER BY r.dias_sem_atividade DESC, r.nome
    LIMIT 5
  ),
  sem AS (  -- comparativo: ignora p_semestre/p_aluno (P8)
    SELECT s.n AS semestre,
      count(x.sanarflix_user_id) AS base,
      count(x.sanarflix_user_id) FILTER (WHERE x.dias_ativos_periodo > 0) AS eng,
      coalesce(sum(x.questoes), 0) AS q, coalesce(sum(x.acertos), 0) AS ac, coalesce(sum(x.erros), 0) AS er,
      coalesce(sum(x.videos), 0) AS vi, coalesce(sum(x.documentos), 0) AS dc
    FROM generate_series(1, 12) AS s(n)
    LEFT JOIN ies_r x ON x.semestre = s.n
    GROUP BY s.n
  ),
  top_cont AS (   -- só com aluno filtrado
    SELECT c.content_type, c.especialidade, count(*) AS n,
           row_number() OVER (PARTITION BY c.content_type ORDER BY count(*) DESC, c.especialidade) AS rn
    FROM public.eng_consumo_aluno_dia_conteudo c
    WHERE p_aluno IS NOT NULL AND c.sanarflix_user_id = p_aluno AND c.dia BETWEEN p_inicio AND p_fim
    GROUP BY c.content_type, c.especialidade
  ),
  dq AS (
    SELECT count(*) AS n FROM public.eng_atividade_aluno_dia a
    WHERE p_aluno IS NOT NULL AND a.sanarflix_user_id = p_aluno
      AND a.dia BETWEEN p_inicio AND p_fim AND a.respostas_todas > 0
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'ies', v_ies_json,
      'temDados', ki.base > 0,
      'periodo', jsonb_build_object(
        'inicio', p_inicio, 'fim', p_fim, 'dias', v_n, 'hoje', v_hoje,
        'mesReferenciaHabito', to_char(v_mes_ref, 'YYYY-MM'),
        'anterior', jsonb_build_object(
          'inicio', v_ini_ant, 'fim', p_inicio - 1,
          'comparavelQuestoes',  v_ini_ant >= DATE '2025-01-01',
          'comparavelConteudos', v_ini_ant >= DATE '2026-01-01')),
      'recorte', jsonb_build_object(
        'semestre', p_semestre,
        'aluno', (SELECT jsonb_build_object('id', x.sanarflix_user_id, 'nome', x.nome, 'semestre', x.semestre)
                  FROM r x WHERE p_aluno IS NOT NULL)),
      'kpis', jsonb_build_object(
        'baseAtiva', k.base,
        'engajados', k.eng,
        'engajadosPct', public.eng_pct(k.eng, k.base),
        'engajadosPctAnterior', CASE WHEN v_ini_ant >= DATE '2026-01-01' THEN public.eng_pct(k.eng_ant, k.base) END,
        'engajadosPctIes', CASE WHEN p_semestre IS NOT NULL THEN public.eng_pct(ki.eng, ki.base) END,
        'semRetorno30', k.s3059 + k.s60,
        'semRetorno30Pct', public.eng_pct(k.s3059 + k.s60, k.base),
        'questoes', k.q,
        'questoesPorEngajado', CASE WHEN k.eng > 0 THEN round(k.q::numeric / k.eng) END,
        'acertoPct', public.eng_pct(k.ac, k.ac + k.er),
        'acertoPctAnterior', CASE WHEN v_ini_ant >= DATE '2025-01-01' THEN public.eng_pct(k.ac_ant, k.ac_ant + k.er_ant) END,
        'acertoPctIes', CASE WHEN p_semestre IS NOT NULL THEN public.eng_pct(ki.ac, ki.ac + ki.er) END),
      'aluno', CASE WHEN p_aluno IS NULL THEN NULL ELSE (
        SELECT jsonb_build_object(
          'situacao', CASE x.faixa_recencia WHEN 'ativos30' THEN 'ativo' WHEN 'nunca_acessou' THEN 'sem_atividade' ELSE 'sumido' END,
          'ultimaAtividade', x.ultima_atividade,
          'diasSemAtividade', x.dias_sem_atividade,
          'diasAtivos', x.dias_ativos_periodo,
          'diasNoPeriodo', v_n,
          'diasComQuestoes', (SELECT n FROM dq),
          'baseSemestre', ks.base,
          'mediaSemestreQuestoes', CASE WHEN ks.eng > 0 THEN round(ks.q::numeric / ks.eng) END,
          'mediaSemestreAcertoPct', public.eng_pct(ks.ac, ks.ac + ks.er),
          'mediaSemestreVideos', public.eng_razao(ks.vi, ks.eng),
          'mediaSemestreDocumentos', public.eng_razao(ks.dc, ks.eng),
          'especialidadeMaisAssistida', (SELECT jsonb_build_object('nome', t.especialidade, 'total', t.n) FROM top_cont t WHERE t.content_type = 'video' AND t.rn = 1),
          'especialidadeMaisLida',      (SELECT jsonb_build_object('nome', t.especialidade, 'total', t.n) FROM top_cont t WHERE t.content_type = 'document' AND t.rn = 1))
        FROM r x CROSS JOIN ks) END,
      'meses', (SELECT jsonb_agg(jsonb_build_object(
          'mes', to_char(m.mes, 'YYYY-MM'), 'parcial', m.parcial,
          'alunosAtivos', m.alunos, 'pctBase', public.eng_pct(m.alunos, k.base),
          'diasAtivos', CASE WHEN p_aluno IS NOT NULL THEN m.dias END,
          'questoes', m.q, 'acertoPct', public.eng_pct(m.ac, m.ac + m.er),
          'videos', m.vi, 'documentos', m.dc) ORDER BY m.mes) FROM meses m),
      'habito', jsonb_build_object(
        'mes', to_char(v_mes_ref, 'YYYY-MM'),
        'ativosNoMes', k.h_ativos, 'baixo', k.h1, 'medio', k.h2, 'alto', k.h3, 'altissimo', k.h4,
        'diasAtivosAluno', CASE WHEN p_aluno IS NOT NULL THEN (SELECT x.dias_ativos_mes_ref FROM r x) END),
      'niveis', (SELECT jsonb_agg(jsonb_build_object('nivel', nv.nivel, 'total', nv.total, 'amostra', nv.amostra) ORDER BY nv.ordem) FROM niv nv),
      'recencia', jsonb_build_object(
        'ativos30', k.ativos30, 'sumidos30a59', k.s3059, 'sumidos60', k.s60, 'nuncaAcessou', k.nunca,
        'previaSumidos30mais', coalesce((SELECT jsonb_agg(jsonb_build_object(
            'id', p.sanarflix_user_id, 'nome', p.nome, 'semestre', p.semestre,
            'ultimaAtividade', p.ultima_atividade, 'diasSemAtividade', p.dias_sem_atividade,
            'detalhe', public.eng_detalhe_atividade(p.sanarflix_user_id, p.ultima_atividade))
          ORDER BY p.dias_sem_atividade DESC, p.nome) FROM prev p), '[]'::jsonb)),
      'consumo', jsonb_build_object(
        'questoes', jsonb_build_object(
          'total', k.q,
          'totalAnterior', CASE WHEN v_ini_ant >= DATE '2025-01-01' THEN k.q_ant END,
          'totalIes', CASE WHEN p_semestre IS NOT NULL THEN ki.q END,
          'acertoPct', public.eng_pct(k.ac, k.ac + k.er),
          'acertoPctAnterior', CASE WHEN v_ini_ant >= DATE '2025-01-01' THEN public.eng_pct(k.ac_ant, k.ac_ant + k.er_ant) END,
          'acertoPctIes', CASE WHEN p_semestre IS NOT NULL THEN public.eng_pct(ki.ac, ki.ac + ki.er) END,
          'alunos', k.al_q),
        'videos', jsonb_build_object(
          'total', k.vi,
          'totalAnterior', CASE WHEN v_ini_ant >= DATE '2026-01-01' THEN k.vi_ant END,
          'totalIes', CASE WHEN p_semestre IS NOT NULL THEN ki.vi END,
          'alunos', k.al_v),
        'documentos', jsonb_build_object(
          'total', k.dc,
          'totalAnterior', CASE WHEN v_ini_ant >= DATE '2026-01-01' THEN k.dc_ant END,
          'totalIes', CASE WHEN p_semestre IS NOT NULL THEN ki.dc END,
          'alunos', k.al_d)),
      'especialidades', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', e.no_id, 'nome', e.nome, 'ciclo', e.ciclo, 'questoes', e.q,
          'acertoPct', public.eng_pct(e.ac, e.ac + e.er)) ORDER BY e.q DESC, e.nome) FROM esp e), '[]'::jsonb),
      'semestres', (SELECT jsonb_agg(jsonb_build_object(
          'semestre', s.semestre,
          'ciclo', CASE WHEN s.semestre <= 4 THEN 'basico' WHEN s.semestre <= 8 THEN 'clinico' ELSE 'internato' END,
          'base', s.base, 'engajados', s.eng, 'engajadosPct', public.eng_pct(s.eng, s.base),
          'videosPorEngajado', public.eng_razao(s.vi, s.eng),
          'documentosPorEngajado', public.eng_razao(s.dc, s.eng),
          'questoesPorEngajado', CASE WHEN s.eng > 0 THEN round(s.q::numeric / s.eng) END,
          'acertoPct', public.eng_pct(s.ac, s.ac + s.er)) ORDER BY s.semestre) FROM sem s)
    ),
    'meta', public.eng_meta(p_inicio, p_fim, k.base < 10, v_criterio)
  )
  INTO v_r
  FROM k CROSS JOIN ki;

  RETURN v_r;
END;
$function$;
```

Exemplo de resposta (PARACATU, "Últimos 6 meses" em 22/10/2026; valores arredondados; listas cortadas):

```json
{
  "data": {
    "ies": { "id": "d86c32ba-2d09-4c7e-a426-1d981ec7b595", "nome": "PARACATU" },
    "temDados": true,
    "periodo": { "inicio": "2026-05-01", "fim": "2026-10-22", "dias": 175, "hoje": "2026-10-22",
                 "mesReferenciaHabito": "2026-09",
                 "anterior": { "inicio": "2025-11-07", "fim": "2026-04-30", "comparavelQuestoes": true, "comparavelConteudos": false } },
    "recorte": { "semestre": null, "aluno": null },
    "kpis": { "baseAtiva": 521, "engajados": 330, "engajadosPct": 63.3, "engajadosPctAnterior": null, "engajadosPctIes": null,
              "semRetorno30": 133, "semRetorno30Pct": 25.5, "questoes": 145873, "questoesPorEngajado": 442,
              "acertoPct": 66.4, "acertoPctAnterior": null, "acertoPctIes": null },
    "aluno": null,
    "meses": [ { "mes": "2026-05", "parcial": false, "alunosAtivos": 180, "pctBase": 34.5, "diasAtivos": null,
                 "questoes": 21000, "acertoPct": 65.2, "videos": 1400, "documentos": 800 },
               { "mes": "2026-10", "parcial": true, "…": "…" } ],
    "habito": { "mes": "2026-09", "ativosNoMes": 223, "baixo": 133, "medio": 50, "alto": 35, "altissimo": 5, "diasAtivosAluno": null },
    "niveis": [ { "nivel": "frequente", "total": 4, "amostra": [ { "id": "…", "nome": "…" } ] },
                { "nivel": "esporadico", "total": 193, "amostra": [] },
                { "nivel": "parou", "total": 15, "amostra": [] },
                { "nivel": "nunca", "total": 309, "amostra": [] } ],
    "recencia": { "ativos30": 197, "sumidos30a59": 69, "sumidos60": 64, "nuncaAcessou": 191,
                  "previaSumidos30mais": [ { "id": "…", "nome": "…", "semestre": 8, "ultimaAtividade": "2026-08-02",
                                             "diasSemAtividade": 81,
                                             "detalhe": { "dia": "2026-08-02", "tipo": "questoes", "especialidade": "Cardiologia" } } ] },
    "consumo": { "questoes": { "total": 145873, "totalAnterior": 0, "totalIes": null, "acertoPct": 66.4,
                               "acertoPctAnterior": null, "acertoPctIes": null, "alunos": 296 },
                 "videos": { "total": 8810, "totalAnterior": null, "totalIes": null, "alunos": 209 },
                 "documentos": { "total": 5027, "totalAnterior": null, "totalIes": null, "alunos": 282 } },
    "especialidades": [ { "id": "…", "nome": "Cardiologia", "ciclo": "clinico", "questoes": 9000, "acertoPct": 64.1 } ],
    "semestres": [ { "semestre": 1, "ciclo": "basico", "base": 40, "engajados": 20, "engajadosPct": 50.0,
                     "videosPorEngajado": 9.1, "documentosPorEngajado": 8.4, "questoesPorEngajado": 14, "acertoPct": 61.0 } ]
  },
  "meta": { "periodo": "01/05/2026 a 22/10/2026", "fonte": "…", "atualizadoEm": "2026-10-22T09:02:41.5+00:00",
            "criterio": "Base ativa: …", "partial": true, "lowSample": false }
}
```

Sobre os números do exemplo:
- Campos marcados com `…` e os números de meses, especialidades e semestres são ilustrativos. Os demais são os valores da §4.
- A PARACATU não tem nenhuma resposta antes de 05/2026. Por isso `totalAnterior` é `0` e `acertoPctAnterior` é `null`: não há denominador.
- A tela trata `null` e anterior `0` com o texto alternativo da §12. **Nunca** mostra "+∞%" nem "▲ 66 p.p.".

### 8.2 `get_gestor_engajamento_alunos(p_ies_id uuid, p_inicio date, p_fim date, p_semestre smallint DEFAULT NULL, p_ordem text DEFAULT 'questoes', p_busca text DEFAULT NULL, p_sem_atividade_14d boolean DEFAULT false, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)`

Alimenta a tabela "Por aluno" da seção "Consumo dos alunos". A lista **não** é filtrada por aluno: o aluno filtrado aparece realçado nela.

Parâmetros:
- `p_ordem` ∈ `questoes` | `videos` | `documentos`: a aba selecionada.
- `p_busca`: texto livre, sem acento e sem caixa, casa com **qualquer trecho** do nome.
- `p_sem_atividade_14d`: `true` = só quem tem `dias_sem_atividade ≥ 14` ou nunca acessou.
- `p_page_size`: 1–50.

```sql
  -- (após guardas 1–3 e validação de período/semestre)
  IF p_ordem NOT IN ('questoes', 'videos', 'documentos') THEN RAISE EXCEPTION 'ordem_invalida' USING ERRCODE = '22023'; END IF;
  IF p_page IS NULL OR p_page < 1 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'paginacao_invalida' USING ERRCODE = '22023';
  END IF;
  v_busca := nullif(public.eng_norm_busca(btrim(coalesce(p_busca, ''))), '');

  WITH r AS MATERIALIZED (
    SELECT x.*,
           CASE p_ordem WHEN 'questoes' THEN x.questoes WHEN 'videos' THEN x.videos ELSE x.documentos END AS chave
    FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim) x
    WHERE (p_semestre IS NULL OR x.semestre = p_semestre)
      AND (v_busca IS NULL OR strpos(public.eng_norm_busca(x.nome), v_busca) > 0)
      AND (NOT p_sem_atividade_14d OR x.dias_sem_atividade IS NULL OR x.dias_sem_atividade >= 14)
  ),
  t AS (SELECT count(*) AS total FROM r),
  pg AS (
    SELECT r.* FROM r ORDER BY r.chave DESC, r.nome, r.sanarflix_user_id
    OFFSET (p_page - 1) * p_page_size LIMIT p_page_size
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'data', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', pg.sanarflix_user_id, 'nome', pg.nome, 'semestre', pg.semestre,
          'questoes', pg.questoes, 'acertoPct', public.eng_pct(pg.acertos, pg.acertos + pg.erros),
          'videos', pg.videos, 'documentos', pg.documentos,
          'ultimaAtividade', pg.ultima_atividade, 'diasSemAtividade', pg.dias_sem_atividade)
        ORDER BY pg.chave DESC, pg.nome, pg.sanarflix_user_id) FROM pg), '[]'::jsonb),
      'page', p_page,
      'pageSize', p_page_size,
      'total', t.total,
      'totalPages', greatest(1, ceil(t.total::numeric / p_page_size))::int),
    'meta', public.eng_meta(p_inicio, p_fim, t.total < 10, v_criterio)
  ) INTO v_r FROM t;
```

Exemplo: `{"data":{"data":[{"id":"…","nome":"Ana Clara Ribeiro","semestre":12,"questoes":1284,"acertoPct":74.0,"videos":142,"documentos":61,"ultimaAtividade":"2026-10-22","diasSemAtividade":0}],"page":1,"pageSize":20,"total":521,"totalPages":27},"meta":{…}}`.

### 8.3 `get_gestor_engajamento_lista(p_ies_id uuid, p_inicio date, p_fim date, p_semestre smallint DEFAULT NULL, p_aluno text DEFAULT NULL, p_categoria text DEFAULT 'sumidos30mais', p_busca text DEFAULT NULL, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)`

Alimenta:
- a lista de prévia (5 alunos) e o pop-up "Ver lista completa" de **Quem não voltou**;
- o pop-up "+N" dos cartões de **Nível de engajamento**;
- o "Exportar CSV" desses pop-ups, com `p_page_size` até 5.000.

| `p_categoria` | Filtro | Ordem |
|---|---|---|
| `frequente`, `esporadico`, `parou`, `nunca` | `nivel = p_categoria` | `dias_sem_atividade ASC NULLS LAST, nome` |
| `ativos30`, `sumidos30a59`, `sumidos60` | `faixa_recencia = p_categoria` | `dias_sem_atividade DESC NULLS LAST, nome` |
| `nunca_acessou` | `faixa_recencia = 'nunca_acessou'` | `nome` |
| `sumidos30mais` | `faixa_recencia IN ('sumidos30a59','sumidos60')` | `dias_sem_atividade DESC, nome` |

Regras de parâmetros:
- `p_page_size`: 1–5.000.
- Respeita `p_semestre` e `p_aluno`: com aluno filtrado, a lista tem 0 ou 1 linha.
- `p_busca`: mesma regra da §8.2.

```sql
  IF p_categoria NOT IN ('frequente','esporadico','parou','nunca','ativos30','sumidos30a59','sumidos60','nunca_acessou','sumidos30mais') THEN
    RAISE EXCEPTION 'categoria_invalida' USING ERRCODE = '22023';
  END IF;
  IF p_page IS NULL OR p_page < 1 OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'paginacao_invalida' USING ERRCODE = '22023';
  END IF;
  v_busca := nullif(public.eng_norm_busca(btrim(coalesce(p_busca, ''))), '');
  v_desc  := p_categoria IN ('ativos30', 'sumidos30a59', 'sumidos60', 'sumidos30mais');

  WITH r AS MATERIALIZED (
    SELECT x.*,
           CASE WHEN v_desc THEN -coalesce(x.dias_sem_atividade, -1)          -- desc, nulos por último
                ELSE coalesce(x.dias_sem_atividade, 2147483647) END AS chave  -- asc, nulos por último
    FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim) x
    WHERE (p_semestre IS NULL OR x.semestre = p_semestre)
      AND (p_aluno IS NULL OR x.sanarflix_user_id = p_aluno)
      AND (v_busca IS NULL OR strpos(public.eng_norm_busca(x.nome), v_busca) > 0)
      AND CASE p_categoria
            WHEN 'sumidos30mais' THEN x.faixa_recencia IN ('sumidos30a59', 'sumidos60')
            WHEN 'ativos30'      THEN x.faixa_recencia = 'ativos30'
            WHEN 'sumidos30a59'  THEN x.faixa_recencia = 'sumidos30a59'
            WHEN 'sumidos60'     THEN x.faixa_recencia = 'sumidos60'
            WHEN 'nunca_acessou' THEN x.faixa_recencia = 'nunca_acessou'
            ELSE x.nivel = p_categoria
          END
  ),
  t AS (SELECT count(*) AS total FROM r),
  pg AS (SELECT r.* FROM r ORDER BY r.chave, r.nome, r.sanarflix_user_id OFFSET (p_page - 1) * p_page_size LIMIT p_page_size)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'categoria', p_categoria,
      'data', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', pg.sanarflix_user_id, 'nome', pg.nome, 'semestre', pg.semestre,
          'ultimaAtividade', pg.ultima_atividade, 'diasSemAtividade', pg.dias_sem_atividade,
          'diasAtivos30', pg.dias_ativos_30,
          'melhorMes', to_char(pg.melhor_mes, 'YYYY-MM'), 'melhorMesDias', pg.melhor_mes_dias,
          'detalhe', public.eng_detalhe_atividade(pg.sanarflix_user_id, pg.ultima_atividade))
        ORDER BY pg.chave, pg.nome, pg.sanarflix_user_id) FROM pg), '[]'::jsonb),
      'page', p_page, 'pageSize', p_page_size, 'total', t.total,
      'totalPages', greatest(1, ceil(t.total::numeric / p_page_size))::int),
    'meta', public.eng_meta(p_inicio, p_fim, t.total < 10, v_criterio)
  ) INTO v_r FROM t;
```

### 8.4 `get_gestor_engajamento_aluno(p_ies_id uuid, p_inicio date, p_fim date, p_aluno text)`

Alimenta o drawer do aluno. `p_aluno` é obrigatório; se faltar, `aluno_fora_do_recorte`.

```sql
  SELECT b.semestre INTO v_sem FROM public.eng_base_ativa(v_ies) b WHERE b.sanarflix_user_id = p_aluno;
  IF NOT FOUND THEN RAISE EXCEPTION 'aluno_fora_do_recorte' USING ERRCODE = '22023'; END IF;

  WITH ies_r AS MATERIALIZED (SELECT * FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim)),
  a AS (SELECT * FROM ies_r WHERE sanarflix_user_id = p_aluno),
  ks AS (SELECT count(*) FILTER (WHERE dias_ativos_periodo > 0) AS eng, sum(questoes) AS q, sum(acertos) AS ac, sum(erros) AS er
         FROM ies_r WHERE semestre = v_sem),
  meses AS (
    SELECT m.mes::date AS mes,
           (m.mes::date < p_inicio OR (m.mes + interval '1 month - 1 day')::date > p_fim) AS parcial,
           coalesce(sum(d.questoes), 0) AS q, coalesce(sum(d.videos), 0) AS vi, coalesce(sum(d.documentos), 0) AS dc
    FROM generate_series(date_trunc('month', p_inicio), date_trunc('month', p_fim), interval '1 month') AS m(mes)
    LEFT JOIN public.eng_atividade_aluno_dia d
      ON d.sanarflix_user_id = p_aluno AND d.dia BETWEEN p_inicio AND p_fim
     AND date_trunc('month', d.dia) = m.mes
    GROUP BY m.mes
  ),
  esp_aluno AS (
    SELECT x.esp_id, sum(x.questoes) AS q, sum(x.acertos) AS ac, sum(x.erros) AS er
    FROM public.eng_questoes_aluno_dia_no x
    WHERE x.sanarflix_user_id = p_aluno AND x.dia BETWEEN p_inicio AND p_fim
    GROUP BY x.esp_id
    ORDER BY sum(x.questoes) DESC
    LIMIT 5
  ),
  esp_sem AS (   -- média do mesmo semestre, mesmas especialidades
    SELECT x.esp_id, sum(x.acertos) AS ac, sum(x.erros) AS er
    FROM public.eng_questoes_aluno_dia_no x
    JOIN ies_r s ON s.sanarflix_user_id = x.sanarflix_user_id AND s.semestre = v_sem
    WHERE x.dia BETWEEN p_inicio AND p_fim AND x.esp_id IN (SELECT esp_id FROM esp_aluno)
    GROUP BY x.esp_id
  ),
  tl AS (   -- últimas atividades: todo o histórico até hoje (D7), 4 itens
    SELECT * FROM (
      SELECT x.dia, 0 AS prio, NULL::timestamp AS ts, 'questoes' AS tipo, n.nome AS especialidade,
             sum(x.questoes) AS questoes, public.eng_pct(sum(x.acertos), sum(x.acertos + x.erros)) AS acerto_pct, NULL::text AS conteudo
      FROM public.eng_questoes_aluno_dia_no x
      JOIN public.eng_no_taxonomia n ON n.no_id = x.esp_id
      WHERE x.sanarflix_user_id = p_aluno
      GROUP BY x.dia, n.nome
      UNION ALL
      SELECT c.dia, 1, c.ultima_abertura, CASE c.content_type WHEN 'video' THEN 'video' ELSE 'documento' END,
             c.especialidade, NULL, NULL, c.content_name
      FROM public.eng_consumo_aluno_dia_conteudo c
      WHERE c.sanarflix_user_id = p_aluno
    ) u
    ORDER BY u.dia DESC, u.prio, u.ts DESC NULLS LAST, u.questoes DESC NULLS LAST, u.especialidade, u.conteudo
    LIMIT 4
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'aluno', jsonb_build_object('id', a.sanarflix_user_id, 'nome', a.nome, 'semestre', a.semestre,
        'situacao', CASE a.faixa_recencia WHEN 'ativos30' THEN 'ativo' WHEN 'nunca_acessou' THEN 'sem_atividade' ELSE 'sumido' END,
        'ultimaAtividade', a.ultima_atividade, 'diasSemAtividade', a.dias_sem_atividade),
      'resumo', jsonb_build_object(
        'questoes', a.questoes, 'acertoPct', public.eng_pct(a.acertos, a.acertos + a.erros),
        'videos', a.videos, 'documentos', a.documentos,
        'diasAtivos', a.dias_ativos_periodo, 'diasNoPeriodo', p_fim - p_inicio + 1,
        'mediaSemestreQuestoes', CASE WHEN ks.eng > 0 THEN round(ks.q::numeric / ks.eng) END,
        'mediaSemestreAcertoPct', public.eng_pct(ks.ac, ks.ac + ks.er)),
      'meses', (SELECT jsonb_agg(jsonb_build_object('mes', to_char(m.mes, 'YYYY-MM'), 'parcial', m.parcial,
                  'questoes', m.q, 'videos', m.vi, 'documentos', m.dc) ORDER BY m.mes) FROM meses m),
      'especialidades', coalesce((SELECT jsonb_agg(jsonb_build_object(
                  'id', e.esp_id, 'nome', n.nome, 'questoes', e.q,
                  'acertoPct', public.eng_pct(e.ac, e.ac + e.er),
                  'acertoPctSemestre', public.eng_pct(s.ac, s.ac + s.er)) ORDER BY e.q DESC, n.nome)
                 FROM esp_aluno e JOIN public.eng_no_taxonomia n ON n.no_id = e.esp_id
                 LEFT JOIN esp_sem s ON s.esp_id = e.esp_id), '[]'::jsonb),
      'timeline', coalesce((SELECT jsonb_agg(jsonb_build_object(
                  'dia', t.dia, 'tipo', t.tipo, 'especialidade', t.especialidade,
                  'questoes', t.questoes, 'acertoPct', t.acerto_pct, 'conteudo', t.conteudo)
                 ORDER BY t.dia DESC, t.prio, t.ts DESC NULLS LAST) FROM tl t), '[]'::jsonb)
    ),
    'meta', public.eng_meta(p_inicio, p_fim, false, v_criterio)
  ) INTO v_r FROM a CROSS JOIN ks;
```

### 8.5 `get_gestor_engajamento_questoes(p_ies_id uuid, p_inicio date, p_fim date, p_semestre smallint DEFAULT NULL)`

Alimenta a aba Questões inteira, exceto o pop-up de alunos do tema.

> **Acréscimo de 27/10 (migration `20261027140000`):** o envelope ganhou `dias`, a série diária da Evolução (`dia`, `questoes`, `acertoPct`). Só vem preenchida quando o período tem até 31 dias; acima disso vem `[]` e a tela usa `meses`. O SQL abaixo é o original de 22/10 e não mostra essa chave.

```sql
  WITH b AS MATERIALIZED (SELECT * FROM public.eng_base_ativa(v_ies)),
  bs AS (SELECT * FROM b WHERE p_semestre IS NULL OR semestre = p_semestre),
  x AS MATERIALIZED (
    SELECT q.* FROM public.eng_questoes_aluno_dia_no q
    JOIN bs ON bs.sanarflix_user_id = q.sanarflix_user_id
    WHERE q.dia BETWEEN p_inicio AND p_fim
  ),
  kp AS (SELECT coalesce(sum(questoes), 0) AS q, coalesce(sum(acertos), 0) AS ac, coalesce(sum(erros), 0) AS er,
                count(DISTINCT sanarflix_user_id) AS al FROM x),
  meses AS (
    SELECT m.mes::date AS mes,
           (m.mes::date < p_inicio OR (m.mes + interval '1 month - 1 day')::date > p_fim) AS parcial,
           coalesce(sum(x.questoes), 0) AS q, coalesce(sum(x.acertos), 0) AS ac, coalesce(sum(x.erros), 0) AS er
    FROM generate_series(date_trunc('month', p_inicio), date_trunc('month', p_fim), interval '1 month') AS m(mes)
    LEFT JOIN x ON date_trunc('month', x.dia) = m.mes
    GROUP BY m.mes
  ),
  sem AS (   -- ignora p_semestre (P8)
    SELECT s.n AS semestre, coalesce(sum(q.questoes), 0) AS q, coalesce(sum(q.acertos), 0) AS ac, coalesce(sum(q.erros), 0) AS er
    FROM generate_series(1, 12) AS s(n)
    LEFT JOIN b ON b.semestre = s.n
    LEFT JOIN public.eng_questoes_aluno_dia_no q
      ON q.sanarflix_user_id = b.sanarflix_user_id AND q.dia BETWEEN p_inicio AND p_fim
    GROUP BY s.n
  ),
  -- agregados por nível; "alunos" é contagem distinta em CADA nível (não soma)
  f  AS (SELECT ciclo, n1_id, n2_id, folha_id, sum(questoes) q, sum(acertos) ac, sum(erros) er, count(DISTINCT sanarflix_user_id) al
         FROM x GROUP BY 1, 2, 3, 4),
  e2 AS (SELECT ciclo, n1_id, n2_id, sum(questoes) q, sum(acertos) ac, sum(erros) er, count(DISTINCT sanarflix_user_id) al
         FROM x GROUP BY 1, 2, 3),
  e1 AS (SELECT ciclo, n1_id, sum(questoes) q, sum(acertos) ac, sum(erros) er, count(DISTINCT sanarflix_user_id) al
         FROM x GROUP BY 1, 2),
  c  AS (SELECT ciclo, sum(questoes) q, sum(acertos) ac, sum(erros) er FROM x GROUP BY 1)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'kpis', jsonb_build_object('questoes', kp.q, 'acertoPct', public.eng_pct(kp.ac, kp.ac + kp.er), 'alunos', kp.al,
                                 'porAluno', CASE WHEN kp.al > 0 THEN round(kp.q::numeric / kp.al) END),
      'meses', (SELECT jsonb_agg(jsonb_build_object('mes', to_char(m.mes, 'YYYY-MM'), 'parcial', m.parcial,
                 'questoes', m.q, 'acertoPct', public.eng_pct(m.ac, m.ac + m.er)) ORDER BY m.mes) FROM meses m),
      'semestres', (SELECT jsonb_agg(jsonb_build_object('semestre', s.semestre, 'questoes', s.q,
                 'acertoPct', public.eng_pct(s.ac, s.ac + s.er)) ORDER BY s.semestre) FROM sem s),
      'arvore', jsonb_build_object(
        'clinico', jsonb_build_object(
          'questoes', coalesce((SELECT q FROM c WHERE ciclo = 'clinico'), 0),
          'acertoPct', (SELECT public.eng_pct(ac, ac + er) FROM c WHERE ciclo = 'clinico'),
          'grandesAreas', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
              'id', g.n1_id, 'nome', n1.nome, 'questoes', g.q, 'alunos', g.al, 'acertoPct', public.eng_pct(g.ac, g.ac + g.er),
              'especialidades', (
                SELECT jsonb_agg(jsonb_build_object(
                  'id', s2.n2_id, 'nome', n2.nome, 'questoes', s2.q, 'alunos', s2.al, 'acertoPct', public.eng_pct(s2.ac, s2.ac + s2.er),
                  'temas', (
                    SELECT jsonb_agg(jsonb_build_object(
                      'id', t.folha_id, 'nome', n3.nome, 'questoes', t.q, 'alunos', t.al, 'acertoPct', public.eng_pct(t.ac, t.ac + t.er))
                      ORDER BY t.q DESC, n3.nome)
                    FROM f t JOIN public.eng_no_taxonomia n3 ON n3.no_id = t.folha_id
                    WHERE t.ciclo = 'clinico' AND t.n2_id = s2.n2_id))
                  ORDER BY s2.q DESC, n2.nome)
                FROM e2 s2 JOIN public.eng_no_taxonomia n2 ON n2.no_id = s2.n2_id
                WHERE s2.ciclo = 'clinico' AND s2.n1_id = g.n1_id))
              ORDER BY g.q DESC, n1.nome)
            FROM e1 g JOIN public.eng_no_taxonomia n1 ON n1.no_id = g.n1_id
            WHERE g.ciclo = 'clinico'), '[]'::jsonb)),
        'basico', jsonb_build_object(
          'questoes', coalesce((SELECT q FROM c WHERE ciclo = 'basico'), 0),
          'acertoPct', (SELECT public.eng_pct(ac, ac + er) FROM c WHERE ciclo = 'basico'),
          'disciplinas', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
              'id', g.n1_id, 'nome', n1.nome, 'questoes', g.q, 'alunos', g.al, 'acertoPct', public.eng_pct(g.ac, g.ac + g.er),
              'assuntos', (
                SELECT jsonb_agg(jsonb_build_object(
                  'id', t.folha_id, 'nome', n2.nome, 'questoes', t.q, 'alunos', t.al, 'acertoPct', public.eng_pct(t.ac, t.ac + t.er))
                  ORDER BY t.q DESC, n2.nome)
                FROM f t JOIN public.eng_no_taxonomia n2 ON n2.no_id = t.folha_id
                WHERE t.ciclo = 'basico' AND t.n1_id = g.n1_id))
              ORDER BY g.q DESC, n1.nome)
            FROM e1 g JOIN public.eng_no_taxonomia n1 ON n1.no_id = g.n1_id
            WHERE g.ciclo = 'basico'), '[]'::jsonb)),
        'total', jsonb_build_object('questoes', kp.q, 'alunos', kp.al, 'acertoPct', public.eng_pct(kp.ac, kp.ac + kp.er)))
    ),
    'meta', public.eng_meta(p_inicio, p_fim, kp.al < 10, v_criterio)
  ) INTO v_r FROM kp;
```

O que fecha por construção, porque tudo sai de `x`:
- `arvore.total.questoes` = `kpis.questoes` = `clinico.questoes` + `basico.questoes`;
- soma das grandes áreas = `clinico.questoes`; soma das especialidades de uma grande área = a grande área; e assim nos demais níveis.

### 8.6 `get_gestor_engajamento_questoes_alunos(p_ies_id uuid, p_inicio date, p_fim date, p_semestre smallint DEFAULT NULL, p_folha_id text DEFAULT NULL)`

Pop-up "alunos que resolveram" de um tema (clínico) ou assunto (básico): os 12 alunos com mais questões no nó.

```sql
  IF p_folha_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.eng_no_taxonomia n WHERE n.no_id = p_folha_id
      AND ((n.ciclo = 'clinico' AND n.nivel = 3) OR (n.ciclo = 'basico' AND n.nivel = 2))) THEN
    RAISE EXCEPTION 'no_invalido' USING ERRCODE = '22023';
  END IF;

  WITH bs AS (SELECT * FROM public.eng_base_ativa(v_ies) WHERE p_semestre IS NULL OR semestre = p_semestre),
  x AS (
    SELECT q.sanarflix_user_id, sum(q.questoes) AS q, sum(q.acertos) AS ac, sum(q.erros) AS er, max(q.dia) AS ultima
    FROM public.eng_questoes_aluno_dia_no q
    JOIN bs ON bs.sanarflix_user_id = q.sanarflix_user_id
    WHERE q.folha_id = p_folha_id AND q.dia BETWEEN p_inicio AND p_fim
    GROUP BY q.sanarflix_user_id
  ),
  tot AS (SELECT count(*) AS al, coalesce(sum(q), 0) AS q, coalesce(sum(ac), 0) AS ac, coalesce(sum(er), 0) AS er FROM x),
  top AS (
    SELECT x.*, bs.nome, bs.semestre FROM x JOIN bs USING (sanarflix_user_id)
    ORDER BY x.q DESC, bs.nome LIMIT 12
  ),
  caminho AS (
    SELECT f.nome AS folha, f.ciclo, p.nome AS pai, g.nome AS avo
    FROM public.eng_no_taxonomia f
    JOIN public.eng_no_taxonomia p ON p.no_id = f.pai_id
    LEFT JOIN public.eng_no_taxonomia g ON g.no_id = p.pai_id
    WHERE f.no_id = p_folha_id
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'no', jsonb_build_object('id', p_folha_id, 'nome', cm.folha, 'ciclo', cm.ciclo,
              'caminho', CASE WHEN cm.ciclo = 'clinico' THEN jsonb_build_array(cm.avo, cm.pai)
                              ELSE jsonb_build_array('Ciclo básico', cm.pai) END),
      'resumo', jsonb_build_object('alunos', tot.al, 'questoes', tot.q, 'acertoPct', public.eng_pct(tot.ac, tot.ac + tot.er)),
      'alunos', coalesce((SELECT jsonb_agg(jsonb_build_object(
                  'id', t.sanarflix_user_id, 'nome', t.nome, 'semestre', t.semestre, 'questoes', t.q,
                  'acertoPct', public.eng_pct(t.ac, t.ac + t.er), 'ultimaAtividade', t.ultima)
                ORDER BY t.q DESC, t.nome) FROM top t), '[]'::jsonb)),
    'meta', public.eng_meta(p_inicio, p_fim, tot.al < 10, v_criterio)
  ) INTO v_r FROM tot CROSS JOIN caminho cm;
```

`ultimaAtividade` aqui = último dia, **dentro do período**, em que o aluno resolveu questão **deste nó**.

### 8.7 `get_gestor_engajamento_conteudos(p_ies_id uuid, p_inicio date, p_fim date, p_semestre smallint DEFAULT NULL, p_tipo text DEFAULT 'todos')`

`p_tipo` ∈ `todos` | `video` | `document` (o valor do banco, não o rótulo). Recalcula tudo pelo tipo.

> **Acréscimo de 27/10 (migration `20261027140000`):** o envelope ganhou `dias`, a série diária da Evolução (`dia`, `consumos`). Só vem preenchida quando o período tem até 31 dias; acima disso vem `[]` e a tela usa `meses`. O SQL abaixo é o original de 22/10 e não mostra essa chave.

```sql
  IF p_tipo NOT IN ('todos', 'video', 'document') THEN RAISE EXCEPTION 'tipo_invalido' USING ERRCODE = '22023'; END IF;

  WITH b AS MATERIALIZED (SELECT * FROM public.eng_base_ativa(v_ies)),
  bs AS (SELECT * FROM b WHERE p_semestre IS NULL OR semestre = p_semestre),
  x AS MATERIALIZED (
    SELECT c.* FROM public.eng_consumo_aluno_dia_conteudo c
    JOIN bs ON bs.sanarflix_user_id = c.sanarflix_user_id
    WHERE c.dia BETWEEN p_inicio AND p_fim AND (p_tipo = 'todos' OR c.content_type = p_tipo)
  ),
  kp AS (SELECT count(*) AS n, count(*) FILTER (WHERE content_type = 'video') AS vi,
                count(*) FILTER (WHERE content_type = 'document') AS dc,
                count(DISTINCT sanarflix_user_id) AS al FROM x),
  meses AS (
    SELECT m.mes::date AS mes,
           (m.mes::date < p_inicio OR (m.mes + interval '1 month - 1 day')::date > p_fim) AS parcial,
           count(x.content_id) AS n
    FROM generate_series(date_trunc('month', p_inicio), date_trunc('month', p_fim), interval '1 month') AS m(mes)
    LEFT JOIN x ON date_trunc('month', x.dia) = m.mes
    GROUP BY m.mes
  ),
  sem AS (   -- ignora p_semestre (P8)
    SELECT s.n AS semestre, count(c.content_id) AS n
    FROM generate_series(1, 12) AS s(n)
    LEFT JOIN b ON b.semestre = s.n
    LEFT JOIN public.eng_consumo_aluno_dia_conteudo c
      ON c.sanarflix_user_id = b.sanarflix_user_id AND c.dia BETWEEN p_inicio AND p_fim
     AND (p_tipo = 'todos' OR c.content_type = p_tipo)
    GROUP BY s.n
  ),
  e  AS (SELECT especialidade, count(*) n, count(DISTINCT sanarflix_user_id) al FROM x GROUP BY 1),
  mo AS (SELECT especialidade, modulo, count(*) n, count(DISTINCT sanarflix_user_id) al FROM x GROUP BY 1, 2),
  co AS (SELECT especialidade, modulo, content_id, max(content_name) nome, max(content_type) tipo,
                count(*) n, count(DISTINCT sanarflix_user_id) al FROM x GROUP BY 1, 2, 3)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'kpis', jsonb_build_object('consumos', kp.n, 'videos', kp.vi, 'documentos', kp.dc, 'alunos', kp.al,
                                 'porAluno', CASE WHEN kp.al > 0 THEN round(kp.n::numeric / kp.al) END),
      'meses', (SELECT jsonb_agg(jsonb_build_object('mes', to_char(m.mes, 'YYYY-MM'), 'parcial', m.parcial, 'consumos', m.n) ORDER BY m.mes) FROM meses m),
      'semestres', (SELECT jsonb_agg(jsonb_build_object('semestre', s.semestre, 'consumos', s.n) ORDER BY s.semestre) FROM sem s),
      'arvore', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'especialidade', e.especialidade, 'consumos', e.n, 'alunos', e.al,
          'modulos', (
            SELECT jsonb_agg(jsonb_build_object(
              'modulo', mo.modulo, 'consumos', mo.n, 'alunos', mo.al,
              'conteudos', (
                SELECT jsonb_agg(jsonb_build_object('id', co.content_id, 'nome', co.nome, 'tipo', co.tipo,
                                                    'consumos', co.n, 'alunos', co.al)
                       ORDER BY co.n DESC, co.nome)
                FROM co WHERE co.especialidade = mo.especialidade AND co.modulo = mo.modulo))
              ORDER BY (mo.modulo = 'Materiais gerais'), mo.n DESC, mo.modulo)
            FROM mo WHERE mo.especialidade = e.especialidade))
          ORDER BY (e.especialidade = 'Outros conteúdos'), e.n DESC, e.especialidade)
        FROM e), '[]'::jsonb)
    ),
    'meta', public.eng_meta(p_inicio, p_fim, kp.al < 10, v_criterio)
  ) INTO v_r FROM kp;
```

### 8.8 `get_gestor_engajamento_conteudo_alunos(p_ies_id uuid, p_inicio date, p_fim date, p_semestre smallint DEFAULT NULL, p_content_id text DEFAULT NULL, p_especialidade text DEFAULT NULL, p_modulo text DEFAULT NULL)`

Pop-up de um conteúdo (folha da gaveta). A chave do nó é o trio (`especialidade`, `modulo`, `content_id`), igual ao da gaveta. Mostra os 12 alunos com mais aberturas.

```sql
  WITH bs AS (SELECT * FROM public.eng_base_ativa(v_ies) WHERE p_semestre IS NULL OR semestre = p_semestre),
  x AS (
    SELECT c.sanarflix_user_id, count(*) AS consumos, sum(c.aberturas) AS aberturas, max(c.ultima_abertura) AS ultima,
           max(c.content_name) AS nome, max(c.content_type) AS tipo
    FROM public.eng_consumo_aluno_dia_conteudo c
    JOIN bs ON bs.sanarflix_user_id = c.sanarflix_user_id
    WHERE c.content_id = p_content_id AND c.especialidade = p_especialidade AND c.modulo = p_modulo
      AND c.dia BETWEEN p_inicio AND p_fim
    GROUP BY c.sanarflix_user_id
  ),
  tot AS (SELECT count(*) AS al, coalesce(sum(consumos), 0) AS consumos, coalesce(sum(aberturas), 0) AS aberturas,
                 max(nome) AS nome, max(tipo) AS tipo FROM x),
  top AS (SELECT x.*, bs.nome AS aluno, bs.semestre FROM x JOIN bs USING (sanarflix_user_id)
          ORDER BY x.aberturas DESC, bs.nome LIMIT 12)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'conteudo', jsonb_build_object('id', p_content_id, 'nome', tot.nome, 'tipo', tot.tipo,
                                     'especialidade', p_especialidade, 'modulo', p_modulo),
      'resumo', jsonb_build_object('alunos', tot.al, 'consumos', tot.consumos, 'aberturas', tot.aberturas),
      'alunos', coalesce((SELECT jsonb_agg(jsonb_build_object(
                  'id', t.sanarflix_user_id, 'nome', t.aluno, 'semestre', t.semestre,
                  'aberturas', t.aberturas, 'consumos', t.consumos,
                  'ultimaAbertura', to_char(t.ultima, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                ORDER BY t.aberturas DESC, t.aluno) FROM top t), '[]'::jsonb)),
    'meta', public.eng_meta(p_inicio, p_fim, tot.al < 10, v_criterio)
  ) INTO v_r FROM tot;
```

`ultimaAbertura` é UTC (`Z`). O front converte para America/Sao_Paulo antes de calcular "há N dias".

### 8.9 `get_gestor_engajamento_export_alunos(p_ies_id uuid, p_inicio date, p_fim date, p_semestre smallint DEFAULT NULL, p_ordem text DEFAULT 'questoes', p_busca text DEFAULT NULL, p_sem_atividade_14d boolean DEFAULT false)`

Mesmos filtros e ordem da §8.2, **sem paginação** e **com e-mail**. É a única RPC que devolve e-mail.

O front só a chama quando `contexto.podeExportar` (hoje `true` para os três papéis do portal, ver `get_gestor_contexto`). A RPC não repete esse teste, porque o valor vem do papel, já validado na guarda (1).

```sql
  -- mesmos IF de p_ordem e v_busca da §8.2
  WITH r AS (
    SELECT x.*, CASE p_ordem WHEN 'questoes' THEN x.questoes WHEN 'videos' THEN x.videos ELSE x.documentos END AS chave
    FROM public.eng_alunos_recorte(v_ies, p_inicio, p_fim) x
    WHERE (p_semestre IS NULL OR x.semestre = p_semestre)
      AND (v_busca IS NULL OR strpos(public.eng_norm_busca(x.nome), v_busca) > 0)
      AND (NOT p_sem_atividade_14d OR x.dias_sem_atividade IS NULL OR x.dias_sem_atividade >= 14)
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'alunos', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'nome', r.nome, 'email', r.email, 'semestre', r.semestre,
          'questoes', r.questoes, 'acertoPct', public.eng_pct(r.acertos, r.acertos + r.erros),
          'videos', r.videos, 'documentos', r.documentos,
          'ultimaAtividade', r.ultima_atividade, 'diasSemAtividade', r.dias_sem_atividade)
        ORDER BY r.chave DESC, r.nome, r.sanarflix_user_id) FROM r), '[]'::jsonb)),
    'meta', public.eng_meta(p_inicio, p_fim, false, v_criterio)
  ) INTO v_r;
```

### 8.10 `get_admin_engajamento(p_inicio date, p_fim date, p_semestre smallint DEFAULT NULL)`

Alimenta a tela do admin inteira.

**Proficiência (D4).** Fixa e independente de período e semestre. Para cada IES com alunos na base:
- conjunto de simulados: `simulado_enamed` sem prova oficial, sem pai, visíveis pela regra de liberação;
- pega o simulado-pai **mais recente** por `data_ref`;
- conta alunos distintos (melhor tentativa por aluno);
- `pct = proficientes ÷ alunos`, com proficiente = `score_proprio ≥ 60`.

A SQL abaixo foi executada em 22/10/2026 e devolveu 15 IES com valor. PARACATU: **75%** (338 de 452, "UNIATENAS - 10/09/26").

```sql
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
  PERFORM public.eng_validar_periodo(p_inicio, p_fim);
  IF p_semestre IS NOT NULL AND p_semestre NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;
  v_n := p_fim - p_inicio + 1;
  v_ini_ant := p_inicio - v_n;

  WITH
  rede AS MATERIALIZED (SELECT * FROM public.eng_alunos_recorte(NULL, p_inicio, p_fim)),
  r AS MATERIALIZED (SELECT * FROM rede WHERE p_semestre IS NULL OR semestre = p_semestre),
  por_ies AS (
    SELECT r.id_ies, count(*) AS base,
      count(*) FILTER (WHERE dias_ativos_periodo > 0) AS eng,
      count(*) FILTER (WHERE dias_ativos_ant > 0)     AS eng_ant,
      count(*) FILTER (WHERE faixa_recencia IN ('sumidos30a59', 'sumidos60')) AS sem30,
      sum(questoes) AS q, sum(acertos) AS ac, sum(erros) AS er, sum(videos) AS vi, sum(documentos) AS dc
    FROM r GROUP BY r.id_ies
  ),
  k AS (
    SELECT count(DISTINCT id_ies) AS n_ies, count(*) AS base,
      count(*) FILTER (WHERE dias_ativos_periodo > 0) AS eng,
      count(*) FILTER (WHERE faixa_recencia IN ('sumidos30a59', 'sumidos60')) AS sem30,
      coalesce(sum(questoes), 0) AS q, coalesce(sum(acertos), 0) AS ac, coalesce(sum(erros), 0) AS er
    FROM r
  ),
  krede AS (SELECT count(*) AS base, count(*) FILTER (WHERE dias_ativos_periodo > 0) AS eng FROM rede),
  mediana AS (
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY 100.0 * eng / base) AS med FROM por_ies WHERE base > 0
  ),
  sims AS (
    SELECT p.id_ies, sa.id, sa.nome,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
    FROM por_ies p
    JOIN public.simulados_admin sa ON p.id_ies = ANY (sa.ies_ids)
    WHERE sa.type = 'simulado_enamed' AND NOT sa.prova_oficial AND sa.simulado_pai_id IS NULL
      AND sa.status IN ('ativo', 'encerrado')
      AND (sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado'
             OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now()))))
  ),
  tri AS (
    SELECT DISTINCT ON (s.id_ies, s.id, rt.student_id) s.id_ies, s.id AS pai_id, rt.student_id, rt.score_proprio
    FROM sims s
    JOIN public.simulados_admin sa2 ON COALESCE(sa2.simulado_pai_id, sa2.id) = s.id
     AND sa2.type = 'simulado_enamed' AND NOT sa2.prova_oficial
    JOIN public.resultados_alunos_tri rt ON rt.simulado_id = sa2.id AND rt.college_id = s.id_ies AND rt.score_proprio IS NOT NULL
    JOIN public.users u ON u.id = rt.student_id AND u.id_ies = s.id_ies
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
    ORDER BY s.id_ies, s.id, rt.student_id, rt.score_proprio DESC
  ),
  por_sim AS (
    SELECT id_ies, pai_id, count(*) AS n, count(*) FILTER (WHERE score_proprio >= 60) AS n_prof FROM tri GROUP BY 1, 2
  ),
  prof AS (
    SELECT DISTINCT ON (s.id_ies) s.id_ies, s.id, s.nome, s.data_ref, ps.n, ps.n_prof
    FROM sims s JOIN por_sim ps ON ps.id_ies = s.id_ies AND ps.pai_id = s.id
    ORDER BY s.id_ies, s.data_ref DESC NULLS LAST, s.nome
  ),
  meses AS (
    SELECT m.mes::date AS mes,
           (m.mes::date < p_inicio OR (m.mes + interval '1 month - 1 day')::date > p_fim) AS parcial,
           coalesce(sum(a.questoes), 0) AS q, coalesce(sum(a.acertos), 0) AS ac, coalesce(sum(a.erros), 0) AS er,
           coalesce(sum(a.videos), 0) AS vi, coalesce(sum(a.documentos), 0) AS dc
    FROM generate_series(date_trunc('month', p_inicio), date_trunc('month', p_fim), interval '1 month') AS m(mes)
    LEFT JOIN (public.eng_atividade_aluno_dia a JOIN r ON r.sanarflix_user_id = a.sanarflix_user_id)
      ON a.dia BETWEEN p_inicio AND p_fim AND date_trunc('month', a.dia) = m.mes
    GROUP BY m.mes
  ),
  sem AS (   -- ignora p_semestre (P8)
    SELECT s.n AS semestre, coalesce(sum(x.questoes), 0) AS q, coalesce(sum(x.acertos), 0) AS ac, coalesce(sum(x.erros), 0) AS er,
           coalesce(sum(x.videos), 0) AS vi, coalesce(sum(x.documentos), 0) AS dc
    FROM generate_series(1, 12) AS s(n) LEFT JOIN rede x ON x.semestre = s.n
    GROUP BY s.n
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'dias', v_n, 'hoje', public.eng_hoje(),
                   'anterior', jsonb_build_object('inicio', v_ini_ant, 'fim', p_inicio - 1,
                                 'comparavelConteudos', v_ini_ant >= DATE '2026-01-01')),
      'recorte', jsonb_build_object('semestre', p_semestre),
      'rede', jsonb_build_object(
        'ies', k.n_ies, 'baseAtiva', k.base, 'engajados', k.eng, 'engajadosPct', public.eng_pct(k.eng, k.base),
        'engajadosPctRede', CASE WHEN p_semestre IS NOT NULL THEN public.eng_pct(krede.eng, krede.base) END,
        'medianaEngajadosPctIes', (SELECT round(med::numeric, 1) FROM mediana),
        'semRetorno30', k.sem30, 'semRetorno30Pct', public.eng_pct(k.sem30, k.base),
        'questoes', k.q, 'acertoPct', public.eng_pct(k.ac, k.ac + k.er)),
      'ranking', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'iesId', p.id_ies, 'nome', i.nome, 'base', p.base, 'engajados', p.eng,
          'engajadosPct', public.eng_pct(p.eng, p.base),
          'engajadosPctAnterior', CASE WHEN v_ini_ant >= DATE '2026-01-01' THEN public.eng_pct(p.eng_ant, p.base) END,
          'semRetorno30Pct', public.eng_pct(p.sem30, p.base),
          'videosPorEngajado', public.eng_razao(p.vi, p.eng),
          'questoesPorEngajado', CASE WHEN p.eng > 0 THEN round(p.q::numeric / p.eng) END,
          'acertoPct', public.eng_pct(p.ac, p.ac + p.er),
          'proficiencia', CASE WHEN pf.id_ies IS NULL THEN NULL ELSE jsonb_build_object(
              'pct', public.eng_pct(pf.n_prof, pf.n), 'alunos', pf.n, 'proficientes', pf.n_prof,
              'simuladoId', pf.id, 'simuladoNome', pf.nome,
              'dataReferencia', (pf.data_ref AT TIME ZONE 'America/Sao_Paulo')::date) END)
        ORDER BY i.nome)
        FROM por_ies p JOIN public.ies i ON i.id = p.id_ies LEFT JOIN prof pf ON pf.id_ies = p.id_ies), '[]'::jsonb),
      'meses', (SELECT jsonb_agg(jsonb_build_object('mes', to_char(m.mes, 'YYYY-MM'), 'parcial', m.parcial,
                 'questoes', m.q, 'acertoPct', public.eng_pct(m.ac, m.ac + m.er),
                 'videos', m.vi, 'documentos', m.dc, 'conteudos', m.vi + m.dc) ORDER BY m.mes) FROM meses m),
      'semestres', (SELECT jsonb_agg(jsonb_build_object('semestre', s.semestre,
                 'questoes', s.q, 'acertoPct', public.eng_pct(s.ac, s.ac + s.er),
                 'videos', s.vi, 'documentos', s.dc, 'conteudos', s.vi + s.dc) ORDER BY s.semestre) FROM sem s)
    ),
    'meta', public.eng_meta(p_inicio, p_fim, k.base < 10, v_criterio_admin)
  ) INTO v_r
  FROM k CROSS JOIN krede;
```

Ordem: o front ordena o ranking ("Ordenar por") e numera as posições.

### 8.11 Quadro-resumo das RPCs

| RPC | Assinatura (tipos, na ordem) | Usada por |
|---|---|---|
| `get_gestor_engajamento_visao_geral` | `uuid, date, date, smallint, text` | Visão geral (tudo, menos tabela/listas/drawer) |
| `get_gestor_engajamento_alunos` | `uuid, date, date, smallint, text, text, boolean, integer, integer` | Tabela "Por aluno" |
| `get_gestor_engajamento_lista` | `uuid, date, date, smallint, text, text, text, integer, integer` | Prévias, pop-ups e CSV de níveis e recência |
| `get_gestor_engajamento_aluno` | `uuid, date, date, text` | Drawer |
| `get_gestor_engajamento_questoes` | `uuid, date, date, smallint` | Aba Questões |
| `get_gestor_engajamento_questoes_alunos` | `uuid, date, date, smallint, text` | Pop-up do tema/assunto |
| `get_gestor_engajamento_conteudos` | `uuid, date, date, smallint, text` | Aba Conteúdos |
| `get_gestor_engajamento_conteudo_alunos` | `uuid, date, date, smallint, text, text, text` | Pop-up do conteúdo |
| `get_gestor_engajamento_export_alunos` | `uuid, date, date, smallint, text, text, boolean` | "Exportar base de alunos (CSV)" |
| `get_admin_engajamento` | `date, date, smallint` | Admin |

Os parâmetros em JS seguem o padrão `p_*` com os mesmos nomes.

O front envia `p_semestre` como número ou `null`, e as datas como `"AAAA-MM-DD"`. O PostgREST resolve a sobrecarga pelos nomes dos parâmetros, então **não** crie sobrecargas com os mesmos nomes.

---

## 9. Mapa tela → componente → RPC → campo

Caminhos relativos a `src/features/gestor/` (gestor) e `src/` (admin). Componentes descritos na §10.

### 9.1 Cabeçalho e filtros (as três abas do gestor)

| Elemento | Componente | Fonte | Campo |
|---|---|---|---|
| Breadcrumb, título, subtítulo "… da {IES} · atualizado em …" | `routes/engajamento/EngajamentoLayout.tsx` | `get_gestor_engajamento_visao_geral` (sempre carregada pelo layout, também nas abas Questões e Conteúdos) | `data.ies.nome`, `meta.atualizadoEm` |
| Período | `components/engajamento/FiltroPeriodo.tsx` | URL (`periodo`, `de`, `ate`) | — |
| Semestre do aluno | `components/engajamento/FiltroSemestreEngajamento.tsx` | URL (`eng_sem`) | — |
| Exportar | `components/engajamento/BotaoExportarAba.tsx` | dados já carregados da aba atual | §10.7 |
| Abas | `components/engajamento/AbasEngajamento.tsx` | rota | — |
| Faixa "Página filtrada por" (só na Visão geral) | `components/engajamento/FaixaFiltroPagina.tsx` | URL + `data.recorte.aluno` | `recorte.aluno.nome`, `recorte.aluno.semestre` |
| Tipo de conteúdo (só em Conteúdos) | `components/engajamento/FiltroTipoConteudo.tsx` | URL (`tipo`) | — |

### 9.2 Visão geral (`routes/engajamento/VisaoGeralEngajamento.tsx`)

| Bloco do mock | Componente | RPC | Campos |
|---|---|---|---|
| 5 KPIs (sem aluno) | `KpisEngajamento.tsx` | visão geral | `kpis.*`, `periodo.anterior.*` |
| 5 KPIs (com aluno) | `KpisEngajamento.tsx` (modo aluno) | visão geral | `recorte.aluno`, `aluno.*`, `kpis.questoes`, `kpis.acertoPct` |
| Engajamento mês a mês / Dias ativos mês a mês | `EngajamentoMesAMes.tsx` | visão geral | `meses[].pctBase`, `meses[].alunosAtivos`, `meses[].diasAtivos`, `meses[].parcial` |
| Do acesso ao hábito | `DoAcessoAoHabito.tsx` | visão geral | `habito.*`, `kpis.baseAtiva` |
| Nível de engajamento (4 cartões) | `NivelEngajamento.tsx` | visão geral | `niveis[]` |
| Pop-up "+N" do cartão | `ListaAlunosDialog.tsx` | `get_gestor_engajamento_lista` (`p_categoria` = nível) | `data[]`, `total` |
| Consumo dos alunos: abas, KPIs, barras | `ConsumoAlunos.tsx` | visão geral | `consumo.*`, `meses[].questoes/videos/documentos`, `aluno.*` |
| Tabela "Por aluno" | `TabelaPorAluno.tsx` | `get_gestor_engajamento_alunos` | `data[]`, `total` |
| Exportar base de alunos (CSV) | `TabelaPorAluno.tsx` | `get_gestor_engajamento_export_alunos` | `alunos[]` |
| Drawer do aluno | `DrawerAlunoEngajamento.tsx` | `get_gestor_engajamento_aluno` | tudo |
| Quem não voltou: barra e legenda | `QuemNaoVoltou.tsx` | visão geral | `recencia.*`, `kpis.baseAtiva` |
| Quem não voltou: prévia de 5 (padrão) | `QuemNaoVoltou.tsx` | visão geral | `recencia.previaSumidos30mais` |
| Quem não voltou: prévia de 5 (faixa clicada) | `QuemNaoVoltou.tsx` | `get_gestor_engajamento_lista` (`p_page_size=5`) | `data[]`, `total` |
| "Ver lista completa" | `ListaAlunosDialog.tsx` | `get_gestor_engajamento_lista` | `data[]`, `total` |
| Especialidades mais praticadas | `EspecialidadesPraticadas.tsx` | visão geral | `especialidades[]` |
| Comparativo entre semestres | `ComparativoSemestres.tsx` | visão geral | `semestres[]` |

### 9.3 Questões (`routes/engajamento/QuestoesEngajamento.tsx`)

| Bloco | Componente | RPC | Campos |
|---|---|---|---|
| 3 KPIs | `KpisQuestoes.tsx` | `get_gestor_engajamento_questoes` | `kpis.*` |
| Evolução mensal (Quantidade / % de acerto) | `LinhaMensal.tsx` | idem | `meses[]` |
| Por semestre (Quantidade / % de acerto) | `BarrasPorSemestre.tsx` | idem | `semestres[]` |
| Por taxonomia | `GavetaTaxonomia.tsx` | idem | `arvore.*` |
| Pop-up do tema/assunto | `AlunosDoNoDialog.tsx` | `get_gestor_engajamento_questoes_alunos` | `no`, `resumo`, `alunos[]` |

### 9.4 Conteúdos (`routes/engajamento/ConteudosEngajamento.tsx`)

| Bloco | Componente | RPC | Campos |
|---|---|---|---|
| 2 KPIs | `KpisConteudos.tsx` | `get_gestor_engajamento_conteudos` | `kpis.*` |
| Evolução dos conteúdos consumidos | `LinhaMensal.tsx` | idem | `meses[].consumos` |
| Conteúdos por semestre | `BarrasPorSemestre.tsx` | idem | `semestres[].consumos` |
| Por especialidade | `GavetaConteudos.tsx` | idem | `arvore[]` |
| Pop-up do conteúdo | `AlunosDoConteudoDialog.tsx` | `get_gestor_engajamento_conteudo_alunos` | `conteudo`, `resumo`, `alunos[]` |

### 9.5 Admin (`src/experiences/admin/pages/EngajamentoSanarflixPage.tsx`)

| Bloco | Componente (`src/components/admin/engajamento/`) | Campos de `get_admin_engajamento` |
|---|---|---|
| Cabeçalho e filtros | página | `rede.ies` |
| Faixa de filtro de semestre | página | `recorte.semestre` |
| 4 KPIs | `KpisRede.tsx` | `rede.*` |
| Ranking de IES | `RankingIes.tsx` | `ranking[]`, `rede.engajadosPct` (traço) |
| Evolução da rede | `EvolucaoRede.tsx` | `meses[]`, `semestres[]` |
| Engajamento × acerto | `DispersaoEngajamentoAcerto.tsx` | `ranking[]`, `rede.engajadosPct`, `rede.acertoPct` |

### 9.6 Estado na URL e sincronia de filtros (gestor)

| Chave | Valores | Padrão | Escrita por |
|---|---|---|---|
| `ies` | uuid | IES do contexto (já existe) | `SidebarIes` |
| `periodo` | `6m` \| `30d` \| `letivo` \| `custom` | `6m` | `FiltroPeriodo` |
| `de`, `ate` | `AAAA-MM-DD` (só com `custom`) | — | `FiltroPeriodo` |
| `eng_sem` | `1`…`12` | ausente = todos | `FiltroSemestreEngajamento`, clique no Comparativo |
| `aluno` | `sanarflix_user_id` | ausente | clique no nome (tabela), botão "Filtrar a página por este aluno" (drawer) |
| `tipo` | `todos` \| `video` \| `document` | `todos` | `FiltroTipoConteudo` |

Regras de sincronia, verificadas por teste (§15):

1. **Aluno e semestre são mutuamente exclusivos.** Gravar `aluno` apaga `eng_sem`, e gravar `eng_sem` apaga `aluno`. Quando há `aluno`, o `<select>` de semestre mostra "Todos (1º ao 12º)" e fica habilitado. Escolher um semestre troca o filtro.
2. **Filtro do topo e Comparativo entre semestres** leem e escrevem a mesma chave `eng_sem`. Clicar de novo no semestre selecionado no Comparativo limpa a chave (toggle).
3. **Clicar no nome do aluno já selecionado** na tabela limpa `aluno` (toggle).
4. O "×" da faixa "Página filtrada por" limpa `aluno` e `eng_sem`.
5. Os links das abas Questões e Conteúdos **removem** `aluno`, porque o filtro de aluno só existe na Visão geral. Mantêm `periodo`, `de`, `ate`, `eng_sem` e `ies`. O link de volta para a Visão geral mantém tudo, menos `tipo`.
6. Valor inválido na URL cai no padrão, sem erro:
   - `periodo` desconhecido → `6m`;
   - `custom` sem datas válidas → `6m`;
   - `eng_sem` fora de 1–12 → todos;
   - `tipo` desconhecido → `todos`.
7. Toda escrita usa `replace: true`, como `useFiltrosGestor`.
8. Se a RPC devolver `aluno_fora_do_recorte` (um aluno de outra IES na URL), o hook limpa `aluno` e recarrega.

---

## 10. Front-end

### 10.1 Estrutura de arquivos (criar)

```
src/features/gestor/
  api/
    types-engajamento.ts            ← tipos TS de todas as respostas da §8
    engajamento.ts                  ← hooks React Query (§10.4)
  hooks/
    useFiltrosEngajamento.ts        ← estado da §9.6
  lib/
    engajamento.ts                  ← períodos, ciclos, formatadores (§10.3)
    exportarEngajamento.ts          ← montagem dos CSVs (§10.7)
  routes/engajamento/
    EngajamentoLayout.tsx           ← cabeçalho, filtros, abas, <Outlet/>
    VisaoGeralEngajamento.tsx
    QuestoesEngajamento.tsx
    ConteudosEngajamento.tsx
  components/engajamento/
    FiltroPeriodo.tsx  FiltroSemestreEngajamento.tsx  FiltroTipoConteudo.tsx
    AbasEngajamento.tsx  FaixaFiltroPagina.tsx  BotaoExportarAba.tsx
    FiguraGrafico.tsx               ← <figure> + role="img" + "Ver dados em tabela"
    BarrasMensais.tsx  LinhaMensal.tsx  BarrasPorSemestre.tsx  BarraHorizontal.tsx
    KpisEngajamento.tsx  EngajamentoMesAMes.tsx  DoAcessoAoHabito.tsx
    NivelEngajamento.tsx  ListaAlunosDialog.tsx  ConsumoAlunos.tsx  TabelaPorAluno.tsx
    DrawerAlunoEngajamento.tsx  QuemNaoVoltou.tsx  EspecialidadesPraticadas.tsx  ComparativoSemestres.tsx
    KpisQuestoes.tsx  GavetaTaxonomia.tsx  AlunosDoNoDialog.tsx
    KpisConteudos.tsx  GavetaConteudos.tsx  AlunosDoConteudoDialog.tsx
src/features/gestor/__tests__/engajamento/   ← testes (§15)
src/services/admin/engajamento.ts             ← hook useAdminEngajamento
src/experiences/admin/pages/EngajamentoSanarflixPage.tsx
src/components/admin/engajamento/
  KpisRede.tsx  RankingIes.tsx  EvolucaoRede.tsx  DispersaoEngajamentoAcerto.tsx
```

### 10.2 Arquivos existentes a alterar (e só estes)

| Arquivo | Mudança |
|---|---|
| `src/features/gestor/shell/SidebarNav.tsx` | Ver detalhes abaixo. |
| `src/features/gestor/gestorV2Routes.tsx` | `const EngajamentoLayout = lazy(…)` e as três páginas `lazy`. Rota-filha nova: `{ path: 'engajamento', element: <PortalV2Gate><EngajamentoLayout /></PortalV2Gate>, children: [{ index: true, element: <VisaoGeralEngajamento /> }, { path: 'questoes', element: <QuestoesEngajamento /> }, { path: 'conteudos', element: <ConteudosEngajamento /> }] }`. Fica **antes** de `...telasLegadas`; nenhuma tela legada usa `engajamento`. Usa o `PortalV2Gate` existente; **sem gate novo** (D9). |
| `src/features/gestor/api/queries.ts` | Acrescentar `export` em `function useEnvelope`. Nada mais muda nesse arquivo. |
| `src/experiences/admin/AdminNav.ts` | Ver detalhes abaixo. |
| `src/experiences/admin/adminRoutes.tsx` | `const EngajamentoSanarflixPage = lazy(() => import('@/experiences/admin/pages/EngajamentoSanarflixPage'));` e `{ path: 'engajamento', element: <EngajamentoSanarflixPage /> }`. |
| `src/integrations/supabase/types.ts` | **Só regenerar** com `generate_typescript_types` (A10). Nunca editar à mão. |
| Testes que enumeram RPCs, itens ou rotas | Ver §15.3. |

Detalhes de `SidebarNav.tsx`:
- **Tipo dos itens.** `GestorV2NavItem` ganha `grupo?: string` e `badge?: 'NOVO'`.
- **Lista `GESTOR_V2_NAV`** passa a ter 4 itens:
  ```ts
  { title: 'Início', url: '/gestor', icon: 'home' },
  { title: 'Visão Geral', url: '/gestor/visao-geral', icon: 'equalizer', grupo: 'Desempenho Institucional' },
  { title: 'Detalhamento por Simulados', url: '/gestor/detalhamento', icon: 'insights', grupo: 'Desempenho Institucional' },
  { title: 'Engajamento', url: '/gestor/engajamento', icon: 'timeline', grupo: 'Uso da plataforma', badge: 'NOVO' },
  ```
- **Título de grupo.** Sai a constante `PRIMEIRO_DO_GRUPO`. O título passa a ser desenhado quando `item.grupo` existe e é diferente do `grupo` do item anterior. Usa o mesmo estilo `TITULO_GRUPO_NAV` e o padding `'18px 12px 8px'`.
- **Badge NOVO.**
  - Elemento: `<span>` com `marginLeft: 'auto'`, `fontSize: 10`, `fontWeight: 700`, `letterSpacing: '0.04em'`, `padding: '2px 6px'`, `borderRadius: 'var(--gp-radius-pill)'`, `background: 'var(--gp-brand)'`, `color: 'var(--gp-on-brand)'`.
  - Texto `NOVO`. `aria-label="novo"` fica no próprio span; o nome acessível do link vira "Engajamento novo".
- **Prefetch.** `aquecerChunk` ganha: `if (url === '/gestor/engajamento') void import('@/features/gestor/routes/engajamento/EngajamentoLayout').catch(() => undefined);`.
- **Comentário.** O comentário "3 itens, nada mais" vira "4 itens em 2 grupos (spec 2026-10-22-engajamento §10.2)".

Detalhes de `AdminNav.ts`:
- No grupo `'Operação'`, depois de Monitoramento, entra `{ title: 'Engajamento SanarFlix', url: '/admin/engajamento', icon: TrendingUp, capability: 'simulados.manage' }`, com o import de `TrendingUp` de `lucide-react`.
- O comentário do topo passa a dizer "4 grupos, 13 itens".

### 10.3 `lib/engajamento.ts` — funções puras (todas com teste)

```ts
export type OpcaoPeriodo = '6m' | '30d' | 'letivo' | 'custom';
export type OpcaoPeriodoAdmin = '6m' | '30d' | 'ano';
export type TipoConteudo = 'todos' | 'video' | 'document';
export type Ciclo = 'basico' | 'clinico' | 'internato';

/** Hoje em America/Sao_Paulo, 'AAAA-MM-DD'. Usar Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }). */
export function hojeSaoPaulo(agora?: Date): string;

/**
 * P1/P2. Datas inclusivas 'AAAA-MM-DD'.
 * '6m': 1º dia de (mês de hoje − 5) → hoje.
 * '30d': hoje − 29 → hoje.
 * 'letivo': 01/01 ou 01/07 do semestre corrente → hoje.
 * 'ano': 01/01 → hoje.
 * 'custom': [de, ate] validado (≥ 2025-01-01, ≤ hoje, de ≤ ate, ≤ 731 dias); inválido → '6m'.
 */
export function calcularPeriodo(opcao: OpcaoPeriodo | OpcaoPeriodoAdmin, hoje: string, de?: string | null, ate?: string | null): { inicio: string; fim: string; opcaoEfetiva: string };

/** "Semestre letivo 2026.2" para hoje = 2026-10-22. */
export function rotuloSemestreLetivo(hoje: string): string;

/** D15: 1–4 básico, 5–8 clínico, 9–12 internato. */
export function cicloDoSemestre(n: number): Ciclo;
/** "8º semestre · clínico" */
export function rotuloOpcaoSemestre(n: number): string;

/** "hoje" (0), "ontem" (1), "há N dias" (≥2), "nunca" (null). */
export function rotuloRecencia(diasSemAtividade: number | null): string;

/** '2026-09' → 'set/26' */
export function mesAno(mes: string): string;
/** '2026-09' → 'Set'; com parcial=true → 'Set*' */
export function mesCurto(mes: string, parcial?: boolean): string;
/** '2026-10' → 'Outubro' */
export function mesExtenso(mes: string): string;
/** '2026-10-22' → '22/10' */
export function diaMes(data: string): string;

/** Primeiro nome para textos como "Dias em que Ana teve…". */
export function primeiroNome(nome: string): string;

/** Inteiro com separador pt-BR: 145873 → "145.873". Usar formatNumero de lib/formatters.ts. */
/** Percentual inteiro: 63.3 → "63%"; null → "—". Usar formatPct de lib/formatters.ts. */
/** Percentual com 1 casa e vírgula: 56.68 → "56,7%". */
export function pct1(v: number | null): string;
/** Decimal com 1 casa e vírgula: 42.15 → "42,2"; null → "—". */
export function dec1(v: number | null): string;
/** Compacto do admin: < 100.000 → "98.765"; ≥ 100.000 → "261 mil"; ≥ 1.000.000 → "1,3 mi". */
export function compacto(v: number): string;

/**
 * D10. Texto da nota comparativa.
 * taxa: deltaPp(atual, anterior) → "▲ 6 p.p." | "▼ 3 p.p." | "= 0 p.p."; anterior null → null.
 * total: deltaPct(atual, anterior) → "+14%" | "−8%" | "0%"; anterior null ou 0 → null.
 */
export function deltaPp(atual: number | null, anterior: number | null): string | null;
export function deltaPct(atual: number, anterior: number | null): string | null;

/** Rótulo do período anterior: '6m' → "6 meses anteriores"; '30d' → "30 dias anteriores"; demais → "{N} dias anteriores". */
export function rotuloPeriodoAnterior(opcao: string, dias: number): string;

/** "02/08 · Questões de Cardiologia" a partir de detalhe (§5.6); null → "nenhuma atividade registrada". */
export function textoDetalhe(detalhe: { dia: string; tipo: 'questoes' | 'video' | 'documento'; especialidade: string | null } | null): string;

/** Busca no front (filtro local de listas já carregadas): minúsculo e sem acento (NFD + remoção de ̀-ͯ). */
export function normalizarBusca(s: string): string;
```

### 10.4 Hooks (`api/engajamento.ts`)

Todos usam `useEnvelope` (exportado de `api/queries.ts`). A `queryKey` começa com `['gestor', 'engajamento', <bloco>, …filtros]`; o `user.id` é inserido pelo próprio `useEnvelope`. Ficam habilitados quando `iesId !== null` e, nos pop-ups, quando o objeto aberto existe.

| Hook | RPC | Args | `manterDadoAnterior` |
|---|---|---|---|
| `useEngajamentoVisaoGeral(f)` | §8.1 | `{ p_ies_id, p_inicio, p_fim, p_semestre, p_aluno }` | `true` |
| `useEngajamentoAlunos(f, ordem, busca, sem14, page)` | §8.2 | `+ p_ordem, p_busca, p_sem_atividade_14d, p_page, p_page_size: 20` | `true` |
| `useEngajamentoLista(f, categoria, busca, page, pageSize)` | §8.3 | `+ p_aluno, p_categoria, p_busca, p_page, p_page_size` | `false` |
| `useEngajamentoAluno(f, alunoId)` | §8.4 | `{ p_ies_id, p_inicio, p_fim, p_aluno }` | `false` |
| `useEngajamentoQuestoes(f)` | §8.5 | `{ p_ies_id, p_inicio, p_fim, p_semestre }` | `true` |
| `useEngajamentoQuestoesAlunos(f, folhaId)` | §8.6 | `+ p_folha_id` | `false` |
| `useEngajamentoConteudos(f)` | §8.7 | `+ p_tipo` | `true` |
| `useEngajamentoConteudoAlunos(f, conteudo)` | §8.8 | `+ p_content_id, p_especialidade, p_modulo` | `false` |
| `buscarExportAlunos(f, ordem, busca, sem14)` (função async, não hook) | §8.9 | — | — |
| `buscarListaCompleta(f, categoria, busca)` (função async) | §8.3 com `p_page_size: 5000` | — | — |

- A busca da tabela "Por aluno" e dos pop-ups usa **debounce de 300 ms** antes de virar parâmetro.
- Mudar a busca, o filtro ou a aba volta a página para 1.

**Admin.** `useAdminEngajamento(inicio, fim, semestre)` em `src/services/admin/engajamento.ts`:
- `useQuery` com `queryKey: ['admin', 'engajamento', inicio, fim, semestre]` e `staleTime` de 5 min;
- chama `supabase.rpc('get_admin_engajamento', {...})` com o mesmo cast de `src/services/admin/monitor.ts` (até `types.ts` ser regenerado; depois disso, sem cast).

### 10.5 Reuso obrigatório

Use os componentes existentes. Não crie equivalentes.

| Necessidade | Usar |
|---|---|
| Casca de bloco com estados loading/empty/error | `components/BlocoGestor.tsx` (`estado`, `titulo`, `aoTentarNovamente`, `mensagemVazio`) |
| Cabeçalho de página | `components/CabecalhoTela.tsx` (`ContainerRota`, `CabecalhoTela` com `acoes` à direita, `TituloBloco`) |
| Cartão de KPI | `components/KpiCard.tsx` (`titulo`, `valor`, `valorNumerico`, `formatarValor`, `meta`, `rodape`/`corpo` para a nota) |
| Tabela | `components/tabela/` (`TabelaGestor`, `CabecalhoTabela`, `CelulaCabecalho`, `LinhaTabela`, `Celula`, `LinhasSkeleton`, `RodapeTabela`, `Paginacao`) |
| Drawer | `Sheet` de `@/components/ui/sheet` com `container={useGestorPortalContainer()}`, `side="right"`, e `hooks/useDevolverFocoAoFechar.ts`. Mesmo padrão de `components/DrawerAluno.tsx`. |
| Pop-up | `Dialog` de `@/components/ui/dialog` com `container={useGestorPortalContainer()}` |
| Ícones | `components/Icon.tsx` (`name` de `icon-names.ts`: `play_circle`, `documents`, `groups`, `download`, `close`, `chevron_right`, `expand_more`, `search`, `timeline`, `arrow_upward`, `arrow_downward`, `arrow_right`, `remove`). **Não** use lucide no gestor. |
| CSV | `lib/exportarCsv.ts` (`montarCsv`, `baixarCsv`, `montarCsvSecoes`, `baixarCsvSecoes`, `nomeArquivoCsv`, `secaoCsv`) |
| Números | `lib/formatters.ts` (`formatNumero`, `formatPct`) |
| Corte de acerto crítico | `lib/regras.ts` (`nivelDesempenho`, `NIVEL_CRITICO_MAX`) (P12) |
| Delta | `components/Tag.tsx` → `TagDelta` (nota de tendência no admin) |
| Contexto/permissão de exportar | `useGestorContexto()` → `podeExportar` |
| Atraso do skeleton | `hooks/useDelayedLoading.ts` (regra dos 400 ms) |

### 10.6 Gráficos

- **Sem recharts nesta entrega.** Todos os gráficos são HTML/CSS e SVG simples, com o desenho do mock: barras verticais, barras horizontais, linha com área, barra empilhada e dispersão. Assim o visual fica idêntico ao mock e não há `ResizeObserver` em teste.
- **Wrapper obrigatório `FiguraGrafico.tsx`**, exigido por `__tests__/a11y.test.tsx`:
  ```tsx
  <figure>
    <div role="img" aria-label={rotulo}>{grafico}</div>
    <details>
      <summary className="cursor-pointer text-xs text-muted-foreground">Ver dados em tabela</summary>
      <table>{/* uma linha por ponto: rótulo, valor */}</table>
    </details>
  </figure>
  ```
- **Barras verticais.** Altura proporcional ao maior valor da série (máximo = 100% da área útil). O valor fica escrito acima da barra e o rótulo do mês abaixo. Mês parcial: cor mais clara (§13) e `*` no rótulo.
- **Linha (`LinhaMensal`).** SVG `viewBox="0 0 1000 220"` com `preserveAspectRatio="none"`, polyline + polygon de área com `fill-opacity` 0.08 e pontos em `div` absolutos (como no mock).
  - Eixo Y de quantidade: 0 a `ceil(max × 1,15)`, arredondado para múltiplo de 500 (conteúdos) ou de 1.000 (questões).
  - Eixo Y de % de acerto: `floor(min − 5)` a `ceil(max + 5)`, em múltiplos de 5, dentro de [0, 100].
  - O último ponto, se parcial, tem miolo branco (`--gp-surface-1`).
- **Barra empilhada** (Quem não voltou): 4 segmentos com largura = `n ÷ base`. Cada segmento é um `<button>` com `aria-pressed` e `aria-label="{nome}: {n} alunos"`. Segmento com 0 alunos não aparece, mas continua na legenda.
- **Dispersão (admin).**
  - x = `engajadosPct` e y = `acertoPct`, com eixos dinâmicos: `floor(min − 5)` a `ceil(max + 5)`, múltiplos de 5.
  - Raio = `8 + 22 × base ÷ maiorBase` px.
  - Rótulos abreviados: "Faculdade " → "Fac. ", "Centro Univ. " → "CU ".
  - Linhas tracejadas nas médias da rede.
  - IES sem `acertoPct` (sem questões) fica fora do gráfico, mas continua na tabela alternativa com "—".

### 10.7 Exportações

| Botão | Onde | Gate | Conteúdo | Arquivo |
|---|---|---|---|---|
| "Exportar" (cabeçalho) | 3 abas | nenhum (P16) | CSV em seções (`baixarCsvSecoes`) com os números **agregados** da aba atual. **Visão geral:** KPIs; Engajamento mês a mês; Do acesso ao hábito; Nível de engajamento (contagens); Quem não voltou (contagens); Consumo por mês (questões, vídeos, documentos); Especialidades mais praticadas; Comparativo entre semestres. **Questões:** KPIs; Evolução mensal (questões e acerto); Por semestre; Taxonomia achatada (colunas Ciclo; Nível 1; Nível 2; Nível 3; Questões; Alunos; Acerto %), com uma linha por nó de cada nível. **Conteúdos:** KPIs; Evolução; Por semestre; Árvore achatada (Especialidade; Módulo; Conteúdo; Tipo; Consumos; Alunos). Toda seção começa com a linha do recorte: período, semestre, aluno. | `nomeArquivoCsv(['engajamento', '<aba>', <slug da IES>])` |
| "Exportar base de alunos (CSV)" | Visão geral › Por aluno | `podeExportar` (botão some se `false`) | §8.9, colunas: `Aluno; E-mail cadastrado; Semestre; Questões resolvidas; % de acerto; Vídeos assistidos; Documentos lidos; Última atividade; Dias sem consumo`. "Última atividade" em `dd/mm/aaaa`; "Dias sem consumo" vazio quando nunca. | `nomeArquivoCsv(['engajamento', 'base-alunos', <slug>])` |
| "Exportar CSV" | pop-ups de lista (níveis e Quem não voltou) | `podeExportar` | §8.3 com `p_page_size=5000`, colunas `Aluno; Semestre; <Última atividade \| Melhor mês>; Dias sem consumo` | `nomeArquivoCsv(['engajamento', <categoria>, <slug>])` |

O slug da IES é minúsculo, sem acento, com espaços → `-`.

### 10.8 Admin — página

- **Página e cabeçalho.** `EngajamentoSanarflixPage.tsx` usa `AdminSectionHeader` (`src/experiences/admin/ui`) para o cabeçalho e os componentes da §9.5.
- **Estado na URL.** `periodo` (`6m` | `30d` | `ano`, padrão `6m`) e `sem` (1–12), lidos com `useSearchParams`.
- **Cores.** O admin não usa os tokens `--gp-*`, que existem só dentro de `.gestor-portal`. Usa as classes do tema geral do app, iguais às da página `MonitoramentoPage`:
  - marca: `bg-primary`;
  - texto secundário: `text-muted-foreground`;
  - bordas: `border-border`.
- **Restrições de dados.**
  - Nenhum dado individual de aluno aparece.
  - "Abrir portal →" é um `<Link to={'/gestor/engajamento?ies=' + iesId}>`. Admin tem a experiência `gestao` e passa pelo `PortalV2Gate`.

---

## 11. Estados

| Estado | Regra | O que aparece |
|---|---|---|
| Carregando | `isLoading` com atraso de 400 ms (`useDelayedLoading`) | `BlocoGestor estado="loading"` (skeleton com a altura do bloco). Tabelas: `LinhasSkeleton`. |
| Trocando filtro | `isPlaceholderData === true` | Bloco com o dado anterior a 60% de opacidade e `aria-busy="true"`. **Nunca** "vazio". |
| Erro | `isError` | `BlocoGestor estado="error"` com "Tentar novamente" (`refetch`). Um bloco com erro não derruba os outros: cada bloco tem o seu `BlocoErrorBoundary`. |
| IES sem dados | `visaoGeral.data.temDados === false` | O layout troca o conteúdo das três abas por `EstadoVazio` com título "Ainda não há dados do SanarFlix para esta instituição." e descrição "Os dados aparecem aqui assim que os alunos da instituição começarem a usar o SanarFlix." |
| Nunca atualizado | `meta.atualizadoEm === null` | Subtítulo termina em "· atualização pendente". Os blocos mostram o que vier (provavelmente zeros). |
| Filtrado por aluno/semestre | URL | Faixa "Página filtrada por" (§12.2) |
| Cartão de nível vazio | `total = 0` | "Nenhum aluno nesta categoria neste recorte" |
| Tabela sem linhas | `total = 0` | "Nenhum aluno encontrado neste recorte." |
| Faixa de recência vazia | 0 alunos na faixa | "Nenhum aluno nesta faixa neste recorte." |
| Gaveta de questões vazia | `arvore.total.questoes = 0` | `EstadoVazio` compacto "Nenhuma questão classificada neste recorte." |
| Gaveta de conteúdos vazia | `kpis.consumos = 0` | `EstadoVazio` compacto "Nenhum conteúdo consumido neste recorte." |
| Especialidades mais praticadas vazio | `especialidades = []` | "Nenhuma questão classificada neste recorte." |
| KPI sem valor | `null` | "—" |
| Comparativo indisponível | `*Anterior` nulo ou anterior = 0 | nota alternativa (§12.2) |
| Drawer sem atividade | `timeline = []` | "Nenhuma atividade registrada" |
| Admin sem IES | `ranking = []` | `AdminEmpty` "Nenhuma instituição com alunos ativos neste recorte." |

---

## 12. Textos literais da UI

O texto entre aspas é literal. `{x}` é substituição. Os números usam `formatNumero` (pt-BR, ponto de milhar), salvo indicação. Divergências do mock aprovadas nesta spec estão marcadas com **(≠ mock)**.

### 12.1 Sidebar e cabeçalho do gestor

- Título do grupo da sidebar: "Uso da plataforma". Item: "Engajamento" + badge "NOVO".
- Breadcrumb: "Uso da plataforma / Engajamento".
- H1: "Engajamento no SanarFlix".
- Subtítulo: "Vídeos, documentos e questões dos alunos da {ies.nome} · atualizado em {dd/mm/aaaa}, {HH:mm}". A hora é de America/Sao_Paulo. Sem atualização: "… da {ies.nome} · atualização pendente".
- Filtro **Período**:
  - opções "Últimos 6 meses", "Últimos 30 dias", "Semestre letivo {AAAA.S}", "Personalizado…";
  - em "Personalizado…" aparecem dois `<input type="date">` com rótulos "De" e "Até" e o botão "Aplicar";
  - `min="2025-01-01"`, `max={hoje}`.
- Filtro **Semestre do aluno**: opção 1 "Todos (1º ao 12º)"; depois "{n}º semestre · {básico|clínico|internato}".
- Botão "Exportar", com ícone `download`.
- Abas (`nav aria-label="Seções de engajamento"`): "Visão geral", "Questões", "Conteúdos".

### 12.2 Visão geral

**Faixa de filtro** (`role="status"`):
- "Página filtrada por";
- chip "Aluno: {nome} ({n}º sem.)" ou "{n}º semestre";
- botão `aria-label="Remover filtro"`;
- "Todos os componentes abaixo mostram só este recorte."

**KPIs sem aluno:**

| Rótulo | Valor | Linha 2 (sub) | Nota |
|---|---|---|---|
| "Base ativa" | `{baseAtiva}` | — | "alunos com acesso vigente" |
| "Alunos engajados" | `{engajadosPct}%` (inteiro) | "{engajados} de {baseAtiva}" | com semestre: "média da IES: {engajadosPctIes}%"; sem semestre e comparável: "{▲ X p.p.\|▼ X p.p.\|= 0 p.p.} vs. {rótulo anterior}"; senão: "sem comparativo para este período" |
| "Sem retorno há 30+ dias" (valor em `--gp-danger-on`) | `{semRetorno30}` | "{semRetorno30Pct}% da base" (inteiro) | "usaram e pararam" |
| "Questões resolvidas" | `{questoes}` | — | "{questoesPorEngajado} por aluno engajado"; se 0 engajados: "nenhum aluno engajado no período" |
| "Acerto médio" | `{acertoPct}%` ou "—" | — | com semestre: "média da IES: {acertoPctIes}%"; sem semestre e comparável: "{delta p.p.} vs. {rótulo anterior}"; senão: "sem comparativo para este período" |

{rótulo anterior} vem de `rotuloPeriodoAnterior` (§10.3).

**KPIs com aluno:**

| Rótulo | Valor | Sub | Nota |
|---|---|---|---|
| "Semestre" | "{n}º" | — | "turma com {baseSemestre} alunos" |
| "Situação" | "Ativo" \| "Sumido" \| "Sem atividade" (os dois últimos em `--gp-danger-on`) | — | "última atividade: {hoje\|ontem\|há N dias\|nunca}" |
| "Dias ativos" | `{diasAtivos}` | "de {diasNoPeriodo}" | "dias com alguma atividade no período" |
| "Questões resolvidas" | `{kpis.questoes}` | — | "média do semestre: {mediaSemestreQuestoes}" |
| "Acerto" | `{kpis.acertoPct}%` ou "—" | — | "média do semestre: {mediaSemestreAcertoPct}%" |

**Engajamento mês a mês:**
- Título "Engajamento mês a mês". Descrição "% da base ativa com ao menos 1 atividade no mês".
- Cada barra: valor "{pctBase}%" (inteiro); rótulo "{Mês}" + linha "{alunosAtivos} alunos".
- Rodapé (só se o último mês é parcial): "{Mês por extenso} parcial, até {dd/mm}."
- Com aluno:
  - título "Dias ativos mês a mês";
  - descrição "Dias em que {primeiro nome} teve ao menos 1 atividade";
  - valor "{diasAtivos} d".

**Do acesso ao hábito:**
- Título "Do acesso ao hábito".
- Descrição: "Dias ativos em {mmm/aa} (último mês fechado) · {ativosNoMes} dos {baseAtiva} alunos tiveram atividade no mês".
- Linhas (nome / descrição / valor):
  - "Base ativa" / "Alunos com acesso vigente no SanarFlix" / "{baseAtiva}" + "· 100%";
  - "Baixo engajamento" / "1 a 3 dias ativos no mês" / "{baixo}" + "· {x,x}% dos ativos no mês";
  - "Médio engajamento" / "4 a 7 dias ativos no mês" / idem;
  - "Alto engajamento" / "8 a 14 dias ativos no mês" / idem;
  - "Altíssimo engajamento" / "15 dias ou mais ativos no mês" / idem.
- Com aluno:
  - descrição "Em que faixa {primeiro nome} ficou em {mmm/aa} · {diasAtivosAluno} dias ativos no mês";
  - valor de cada linha "Sim"/"Não" (Base ativa: "Sim").

**Nível de engajamento:**
- Título "Nível de engajamento".
- Descrição: "Combina recência (acessou nos últimos 30 dias?) com frequência (quantos dias estudou) · toda a base ativa cai em exatamente uma categoria".
- Cartões (ordem fixa), nome e regra (a regra aparece na linha do cartão e no `title`/`aria-label` do ícone "i"):
  - "Ativo e frequente" — "Acessou nos últimos 30 dias e estudou em 15 dias ou mais nesse intervalo";
  - "Ativo, mas esporádico" — "Acessou nos últimos 30 dias, mas estudou em menos de 15 dias";
  - "Era frequente e parou" — "Sem atividade há mais de 30 dias, mas teve algum mês do período com 15 dias ativos ou mais";
  - "Nunca engajou" — "Sem atividade há mais de 30 dias e nenhum mês com 15 dias ativos, ou nunca acessou".
- Contagem: "{total}" e, ao lado, "ALUNOS · {pct}%" (pct inteiro sobre a base do recorte).
- Chips: os 3 nomes de `amostra`. Botão "+{total − amostra.length}" com `aria-label="Ver todos os {total} alunos com {nome do cartão em minúsculas}"`, só quando `total > amostra.length`.
- Rodapé: "As quatro categorias somam a base ativa ({baseAtiva} alunos). Régua única: 15 dias ativos em 30 (ou num mês) define "frequente"." Com aluno: "(1 aluno)".

**Pop-up de lista** (níveis e "Ver lista completa"):
- Título = nome do cartão ou da faixa.
- Subtítulo: "{total} alunos · {regra do cartão, só nos níveis} · {recorte}". {recorte}:
  - "filtro: {nome do aluno}" (com aluno);
  - "filtro: {n}º semestre" (com semestre);
  - senão "{ies.nome} · {opção de período em minúsculas, ex.: últimos 6 meses}".
- Busca: placeholder "Buscar aluno pelo nome" (rótulo visualmente oculto "Buscar aluno nesta lista"). Botão "Exportar CSV".
- Colunas: "Aluno", "Sem.", "Última atividade" (níveis frequente/esporádico e faixas de recência) ou "Melhor mês" (níveis parou/nunca), "Dias sem consumo".
- Célula de detalhe:
  - frequente/esporádico: "última: {recência} · {diasAtivos30} dias ativos em 30";
  - parou/nunca: "{mmm/aa} · {melhorMesDias} dias ativos"; sem melhor mês e com alguma atividade: "— (sem atividade no período)"; nunca acessou: "— (nunca acessou)";
  - faixas de recência: `textoDetalhe(detalhe)` (§10.3).
- "Dias sem consumo": número ou "—".
- Rodapé: "Mostrando {a}–{b} de {total}" + botões "Anterior" e "Próxima". Fechar: `aria-label="Fechar lista"`.

**Consumo dos alunos:**
- Sobretítulo "Acompanhamento"; H2 "Consumo dos alunos"; descrição "O que os alunos estão resolvendo, assistindo e lendo no SanarFlix · clique no nome para filtrar a página, na seta para ver o detalhe". **(≠ mock: sai "Exportar planilha", D11.)**
- Abas (`role="tablist"`, `aria-label="Tipo de consumo"`): "Questões", "Vídeos", "Documentos".
- KPIs (3 cartões cinza) sem aluno:

| Aba | Cartão 1 | Cartão 2 | Cartão 3 |
|---|---|---|---|
| Questões | "Questões resolvidas" `{total}`; nota: com semestre "IES inteira: {totalIes}"; comparável e anterior > 0: "{+X%} sobre os {rótulo anterior}"; senão "sem comparativo para este período" | "% de acerto" `{acertoPct}%`; nota: com semestre "média da IES: {acertoPctIes}%"; comparável: "{±X p.p.} sobre os {rótulo anterior}"; senão "sem comparativo para este período" | "Alunos que resolveram" "{alunos} de {baseAtiva}"; nota "{baseAtiva − alunos} sem nenhuma questão no período" |
| Vídeos | "Vídeos assistidos" `{total}`; nota igual à de questões, com `videos` | "Média por aluno que assistiu" `{dec1(total ÷ alunos)}`; nota "vídeos no período" | "Alunos que assistiram" "{alunos} de {baseAtiva}"; nota "{…} sem nenhum vídeo no período" |
| Documentos | "Documentos lidos" | "Média por aluno que leu"; nota "documentos no período" | "Alunos que leram"; nota "{…} sem nenhum documento no período" |

- KPIs com aluno:

| Aba | Cartão 1 | Cartão 2 | Cartão 3 |
|---|---|---|---|
| Questões | "Questões resolvidas" + "média do semestre: {mediaSemestreQuestoes}" | "% de acerto" + "média do semestre: {mediaSemestreAcertoPct}%" | "Dias com questões" `{diasComQuestoes}` + "de {diasAtivos} dias ativos" |
| Vídeos | "Vídeos assistidos" + "média do semestre: {dec1(mediaSemestreVideos)}" | "Média por mês" `{dec1(total ÷ nº de meses do período)}` + "vídeos" | "Especialidade mais assistida" `{nome}` ou "—" + "{total} vídeos" |
| Documentos | "Documentos lidos" + "média do semestre: {dec1(mediaSemestreDocumentos)}" | "Média por mês" + "documentos" | "Especialidade mais lida" + "{total} documentos" |

- Título do gráfico: "{Questões resolvidas\|Vídeos assistidos\|Documentos lidos} por mês" + (com aluno) " · {nome}" + (último mês parcial) " · {Mês curto} parcial até {dd/mm}".
- Tabela:
  - título "Por aluno"; busca: placeholder "Buscar aluno pelo nome" (rótulo oculto igual);
  - grupo `aria-label="Filtrar alunos"` com os botões "Todos" e "Sem atividade há 14 dias";
  - botão "Exportar base de alunos (CSV)";
  - colunas "Aluno", "Semestre", "Questões resolvidas", "% de acerto", "Vídeos assistidos", "Documentos lidos", "Última atividade" e uma coluna sem título visível ("Detalhes", oculto). As colunas da aba ativa ficam realçadas (`--gp-brand-surface-soft`).
- Células:
  - semestre "{n}º";
  - acerto "{x}%" ou "—" (vermelho quando crítico, P12);
  - "Última atividade" com `rotuloRecencia`, em `--gp-danger-on` quando ≥ 14 dias ou nunca;
  - botão-seta com `aria-label="Abrir detalhes de {nome}"`.
- O nome é um botão com `aria-pressed`. Linha do aluno filtrado: fundo `--gp-brand-surface`, nome em `--gp-brand-strong`.
- Vazio: "Nenhum aluno encontrado neste recorte."
- Rodapé: "Mostrando {a}–{b} de {total} alunos, ordenados pela aba selecionada" + `Paginacao`.

**Drawer do aluno** (`aria-label="Detalhes do aluno"`):
- Cabeçalho: iniciais (1ª letra do primeiro e do último nome); nome (H2); linha "{n}º semestre · {Situação} · última atividade {recência}". Fechar: `aria-label="Fechar detalhes"`.
- Cartões:
  - "Questões" `{questoes}` + "média do semestre: {…}";
  - "Acerto" `{x}%` + "média do semestre: {…}%";
  - "Vídeos · Docs" "{videos} · {documentos}";
  - "Dias ativos" `{diasAtivos}` + "de {diasNoPeriodo} no período".
- "Atividade mês a mês":
  - barras empilhadas por mês: questões ÷ 4, vídeos, documentos;
  - legenda "Questões (÷4)", "Vídeos", "Documentos".
- "Acerto por especialidade vs. semestre":
  - linhas "{nome}", barra (largura = acerto do aluno), traço = `acertoPctSemestre`;
  - valor "{acerto}%" + " ({questoes})";
  - rodapé "Traço preto = média do mesmo semestre".
- "Últimas atividades" (data `dd/mm`):
  - "Resolveu {n} questões de {especialidade} ({x}% de acerto)";
  - "Assistiu “{conteúdo}” · {especialidade}";
  - "Abriu o documento “{conteúdo}” · {especialidade}";
  - vazio "Nenhuma atividade registrada".
- Botão "Filtrar a página por este aluno": grava `aluno`, apaga `eng_sem` e fecha o drawer.

**Quem não voltou:**
- Título "Quem não voltou"; descrição "Base ativa pelo tempo desde a última atividade".
- Botão-link "Filtrar na tabela de alunos": liga "Sem atividade há 14 dias" na tabela e rola até `#consumo`.
- Barra (`role="group"`, `aria-label="Distribuição da base pelo tempo desde a última atividade · clique numa faixa para listar os alunos"`).
- Legenda/segmentos: "Ativos nos últimos 30 dias", "Sumidos há 30–59 dias", "Sumidos há 60+ dias", "Nunca acessaram" **(≠ mock: era "Nunca acessaram no período", D7)**.
- Título da lista: sem faixa selecionada, "Alunos sumidos há 30+ dias"; senão, o nome da faixa.
- Colunas "Aluno", "Sem.", "Última atividade", "Dias sem consumo".
- Detalhe: `textoDetalhe`; nunca acessou: "nenhuma atividade registrada".
- Vazio: "Nenhum aluno nesta faixa neste recorte."
- Com mais de 5: "Mostrando {k} de {total} alunos" + botão "Ver lista completa".

**Especialidades mais praticadas:**
- Título; descrição "Questões resolvidas e % de acerto"; link "Abrir taxonomia →" (vai para `questoes`, mantendo os filtros).
- Linha: nome, barra (largura relativa à maior), quantidade; abaixo, "acerto {x}%".

**Comparativo entre semestres:**
- Título; descrição "Clique num semestre para filtrar a página" **(≠ mock: sai "· engajamento cresce no internato, quando a prova de residência se aproxima", que é afirmação sobre dado e pode não valer para a IES)**.
- Colunas "Semestre" ("{n}º" + ciclo em texto menor), "Base", "Engajados" (barra + "{x}%"), "Vídeos / aluno" (`dec1`), "Docs / aluno" (`dec1`), "Questões / aluno" (inteiro), "Acerto" ("{x}%").
- Linha selecionada: fundo `--gp-brand-surface`. Semestre do aluno filtrado: fundo `--gp-brand-surface-soft`.

### 12.3 Questões

- KPIs:
  - "Questões resolvidas" + "{alunos} alunos resolveram";
  - "Acerto" "{x}%" + "corretas ÷ (corretas + erradas)";
  - "Questões por aluno" + "{questoes} questões ÷ {alunos} alunos que resolveram".
- Evolução:
  - seletor (`aria-label="Métrica da evolução"`) "Quantidade" | "% de acerto";
  - títulos "Evolução das questões resolvidas" / "Evolução do % de acerto";
  - descrições "Total de questões por mês" / "Acerto médio por mês (eixo de {min}% a {max}%)", + " · {mês por extenso em minúsculas} parcial, até {dd/mm}" se houver mês parcial.
- Por semestre:
  - seletor (`aria-label="Métrica por semestre"`) "Quantidade" | "% de acerto";
  - títulos "Questões por semestre" / "% de acerto por semestre";
  - descrições "Total resolvido no período por alunos de cada semestre" / "Acerto médio dos alunos de cada semestre (barra cheia = 100%)".
- Por taxonomia:
  - título "Por taxonomia";
  - descrição "Ciclo clínico: grande área › especialidade › tema · Ciclo básico: disciplina › assunto · clique numa linha para abrir o nível abaixo · clique num tema ou assunto para ver os alunos que resolveram questões dele";
  - botão "Recolher tudo";
  - `role="treegrid"` com `aria-label="Questões por grande área, especialidade e tema"`;
  - cabeçalhos "Classificação", "Questões", "Alunos", "Acerto".
- Faixas de seção:
  - "Ciclo clínico e residência" (CSS uppercase), legenda "Grande área › especialidade › tema";
  - "Ciclo básico", legenda "Disciplina › assunto";
  - colunas da faixa: total, "—", "{x}% de acerto".
- Linhas:
  - `aria-label` "Abrir {nome}" / "Recolher {nome}";
  - folha: `aria-haspopup="dialog"`, `aria-label` "Ver alunos do tema {nome}" (clínico) ou "Ver alunos do assunto {nome}" (básico), com ícone `groups`.
- Linha "Total".
- Rodapé: "Cada questão é contada uma única vez, na sua classificação principal; por isso cada nível soma exatamente o total ({total}), igual aos indicadores do topo. A coluna Alunos não soma: o mesmo aluno resolve questões de vários temas."
- Abertura inicial: abrir a 1ª grande área do clínico e, dentro dela, a 1ª especialidade. Sem clínico, abrir a 1ª disciplina do básico.
- Pop-up:
  - sobretítulo "{caminho[0]} › {caminho[1]}"; título = nome do nó;
  - resumo "{alunos} alunos resolveram · {questoes} questões · {x}% de acerto";
  - colunas "Aluno", "Semestre", "Questões", "Acerto" (barra + %), "Última atividade";
  - rodapé "Mostrando os 12 alunos com mais questões de {alunos}." (só se `alunos > 12`);
  - fechar `aria-label="Fechar"`; fundo clicável `aria-label="Fechar janela"`.

### 12.4 Conteúdos

- Filtro "Tipo de conteúdo" (grupo `aria-labelledby`): "Todos", "Vídeo" (ícone `play_circle`), "Documento" (ícone `documents`).
- KPIs:
  - "Conteúdos consumidos", nota: "Todos" → "{videos} vídeos · {documentos} documentos"; "Vídeo" → "vídeos abertos no período"; "Documento" → "documentos abertos no período";
  - "Conteúdos por aluno" + "{consumos} conteúdos ÷ {alunos} alunos que consumiram".
- "Evolução dos conteúdos consumidos": descrição "Total por mês" + " · {mês} parcial, até {dd/mm}".
- "Conteúdos por semestre": descrição "Total consumido no período por alunos de cada semestre".
- Por especialidade:
  - título "Por especialidade";
  - descrição "Especialidade › módulo › conteúdo · clique numa linha para abrir o nível abaixo · clique num conteúdo para ver quais alunos o consumiram";
  - "Recolher tudo";
  - `role="treegrid"` com `aria-label="Conteúdos consumidos por especialidade, módulo e conteúdo"`;
  - cabeçalhos "Especialidade / módulo / conteúdo", "Consumos", "Alunos", "Participação no nível".
- Folha: ícone com `aria-label` "Vídeo" ou "Documento"; botão `aria-label="Ver alunos que consumiram {nome}"`.
- Rodapé: "Consumo = player ou documento aberto. O SanarFlix não registra tempo assistido." **+ (≠ mock, novo)** " Abrir o mesmo conteúdo várias vezes no mesmo dia conta um consumo. Só há registro de acesso pela web, a partir de janeiro de 2026."
- Abertura inicial: a 1ª especialidade e o seu 1º módulo.
- Pop-up:
  - sobretítulo "{especialidade} › {módulo}"; título = conteúdo;
  - resumo "{alunos} alunos · {consumos} consumos · {vídeo|documento}";
  - colunas "Aluno", "Semestre", "Aberturas", "Última abertura";
  - rodapé "Mostrando os 12 alunos com mais aberturas de {alunos}." (se `alunos > 12`).

### 12.5 Admin

- H1 "Engajamento por instituição".
- Subtítulo "Rede B2B · {rede.ies} IES · {opção de período em minúsculas} · sem dados individuais de aluno — para isso, abra o portal do gestor da IES".
- Filtros:
  - "Período": "Últimos 6 meses", "Últimos 30 dias", "{ano corrente}";
  - "Semestre do aluno": "Todos (1º ao 12º)" e "{n}º semestre · {ciclo}".
- Faixa: "Página filtrada por" + chip "{n}º semestre" + `aria-label="Remover filtro"` + "Indicadores, ranking e gráficos mostram só alunos deste semestre em todas as IES."
- KPIs sem semestre:
  - "Base ativa da rede" + "{ies} IES";
  - "Engajados" "{x}%" + "mediana por IES: {y}%";
  - "Sem retorno há 30+ dias" + "{x}% da base";
  - "Questões resolvidas" (`compacto`) + "acerto médio {x}%".
- KPIs com semestre:
  - "Base ativa · {n}º semestre" + "{ies} IES";
  - "Engajados" + "rede inteira: {engajadosPctRede}%";
  - "Sem retorno há 30+ dias" + "{x}% da base do semestre";
  - "Questões resolvidas" + "acerto médio {x}%".
- Ranking:
  - título "Ranking de IES"; "Ordenar por:"; botões (`aria-label="Ordenar ranking por"`) "Engajamento", "Acerto", "Base ativa"; padrão "Engajamento"; ordem decrescente; empate pelo nome.
  - Colunas: "#", "Instituição", "Base ativa", "Engajados" (barra + traço da média da rede + "{x}%"), "% Alunos proficientes*", "Sumidos 30+d" ("{x}%"), "Vídeos / aluno" (`dec1`), "Questões / aluno", "Acerto" ("{x}%"), "Tendência", "Ações" (oculto).
  - Proficiência:
    - valor "{x}%", e abaixo "{simuladoNome} · {mmm/aa da dataReferencia}";
    - sem simulado: "—" e abaixo "sem simulado ENAMED";
    - vermelho (`text-destructive`) quando < 40%.
  - Tendência: "▲ {d} p.p." / "▼ {d} p.p." / "= 0 p.p." (`d` = `engajadosPct − engajadosPctAnterior`, inteiro); sem anterior: "—". Use `TagDelta` ou classes `text-destructive` / `text-foreground`, **sem verde** (identidade visual).
  - "Sumidos 30+d" em destaque (`text-destructive`) quando acima do `semRetorno30Pct` da rede.
  - Link "Abrir portal →".
- Rodapés:
  - "Traço preto = média da rede ({rede.engajadosPct}%). Tendência = variação do engajamento vs. o período anterior de mesma duração." **(≠ mock: "vs. os 6 meses anteriores")**;
  - "* % de alunos proficientes no simulado mais recente que a IES realizou conosco (nome e data abaixo do valor). Por isso as IES podem estar comparadas em simulados diferentes. Esse número não muda com o filtro de semestre nem de período."
- Evolução da rede:
  - título "Evolução da rede"; descrição "Escolha o indicador · o gráfico ao lado mostra o mesmo indicador por semestre";
  - indicadores (`aria-label="Indicador"`) "Questões", "% de acerto", "Conteúdos", "Vídeos", "Documentos".
  - Gráfico mensal: "{nome} por mês", com nomes "Questões resolvidas", "% de acerto", "Conteúdos consumidos", "Vídeos", "Documentos".
  - Descrições:
    - "Total de questões resolvidas na rede";
    - "Acerto médio da rede (eixo de {min}% a {max}%)";
    - "Vídeos + documentos abertos na rede";
    - "Vídeos abertos na rede";
    - "Documentos abertos na rede";
    - com semestre, + " · só {n}º semestre"; + " · {mês} parcial, até {dd/mm}".
  - Por semestre: "{nome} por semestre".
  - Descrições:
    - "Total resolvido por alunos de cada semestre";
    - "Acerto médio por semestre (barra cheia = 100%)";
    - "Vídeos + documentos abertos por alunos de cada semestre";
    - "Vídeos abertos por alunos de cada semestre";
    - "Documentos abertos por alunos de cada semestre";
    - + " · clique num semestre para filtrar a página".
- Dispersão:
  - título "Engajamento × acerto"; descrição "Tamanho do ponto = base ativa. Linhas tracejadas = médias da rede.";
  - eixos "% de acerto" (vertical) e "% engajados →", com min e max nas pontas.

---

## 13. Identidade visual

- **Família de cor.** Vermelho da marca e neutros. **Sem verde em gráficos.**
- **Exceção aprovada:** os 4 cartões de Nível de engajamento usam a família semântica, como o Diagnóstico Curricular (`CascataDiagnostico.tsx`).
- **Literais proibidos:** nenhum hex, `rgb()` ou `rgba()` no código do gestor (guard `tema.test.tsx`). Tons intermediários usam `color-mix(in srgb, var(--gp-brand) N%, var(--gp-surface-1))`, o mesmo recurso que `SidebarNav.tsx` já usa. Assim o tema escuro se ajusta sozinho.

| Mock | Uso | Token / expressão |
|---|---|---|
| `#C8102E` | barras e linhas principais, borda ativa, sublinhado de aba | `var(--gp-brand)` |
| `#9F0C24` | texto ativo, número em destaque, série "Questões" do drawer, "Altíssimo engajamento" | `var(--gp-brand-strong)` |
| `#E0566C` | 2ª série, "Alto engajamento", "Sumidos 30–59" | `color-mix(in srgb, var(--gp-brand) 70%, var(--gp-surface-1))` |
| `#F2A3B0` / `#E5A3A6` | "Médio engajamento", "Sumidos 60+", barra de mês parcial, barras de consumo dos meses fechados | `color-mix(in srgb, var(--gp-brand) 45%, var(--gp-surface-1))` |
| `#F6BCC5` | "Baixo engajamento", 3ª série do drawer | `color-mix(in srgb, var(--gp-brand) 30%, var(--gp-surface-1))` |
| `#D4D4D8` | "Base ativa" no hábito, "Nunca acessaram" | `var(--gp-border-input)` |
| `#FDEEF0` | superfícies de seleção, faixa de filtro, faixa de seção da gaveta | `var(--gp-brand-surface)` |
| `#FDF2F3` | coluna realçada da aba ativa | `var(--gp-brand-surface-soft)` |
| `#F6C9D0` | bordas de seleção | `var(--gp-brand-border)` |
| `#B91C1C` | texto de alerta (acerto crítico, recência ≥ 14 d) | `var(--gp-danger-on)` |
| `#F4F4F5` / `#EDEDEF` | trilho das barras | `var(--gp-surface-3)` |
| `#E4E4E7` | bordas de cartão | `var(--gp-border-strong)` |
| `#52525B` / `#71717A` | textos secundários | `var(--gp-text-2)` / `var(--gp-text-3)` |
| `#18181B` | texto e "traço preto" de média | `var(--gp-text-1)` |

Cartões de Nível de engajamento:

| Cartão | Topo/ponto | Número/nome | Chip (fundo / borda / texto) | Ícone |
|---|---|---|---|---|
| Ativo e frequente | `--gp-success` | `--gp-success-on` | `--gp-success-surface` / `--gp-success` / `--gp-success-on` | `arrow_upward` |
| Ativo, mas esporádico | `--gp-warning` | `--gp-warning-on` | `--gp-warning-surface` / `--gp-warning` / `--gp-warning-on` | `arrow_right` |
| Era frequente e parou | `--gp-danger` | `--gp-danger-on` | `--gp-danger-surface` / `--gp-danger` / `--gp-danger-on` | `arrow_downward` |
| Nunca engajou | `--gp-text-3` | `--gp-text-1` | `--gp-surface-3` / `--gp-border-input` / `--gp-text-1` | `remove` |

- **Faixa de seção da gaveta de questões** (D do briefing): fundo `--gp-brand-surface`, `border-top: 3px solid var(--gp-brand)`, `border-bottom: 1px solid var(--gp-brand-border)`, título em `--gp-brand-strong`.
- **Tipografia e números:** a do portal (`--gp-font-size-*`), com `font-variant-numeric: tabular-nums` nas tabelas e nos KPIs.
- **Admin:** classes do tema geral (`bg-primary`, `text-muted-foreground`, `border-border`, `text-destructive`), sem `--gp-*`.

---

## 14. Consultas de validação

Rode na PARACATU (`d86c32ba-2d09-4c7e-a426-1d981ec7b595`), período `[2026-05-01, hoje]`, **logo depois de um refresh**. Os números "esperado em 22/10" servem de ordem de grandeza. O critério é **RPC = consulta**.

Para chamar uma RPC como gestor ou admin pelo `execute_sql`, simule o JWT:

```sql
BEGIN;
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '<uuid de um gestor da PARACATU ou de um admin>', 'role', 'authenticated')::text, true);
SELECT public.get_gestor_engajamento_visao_geral('d86c32ba-2d09-4c7e-a426-1d981ec7b595', DATE '2026-05-01', public.eng_hoje());
ROLLBACK;
```

O uuid do gestor sai de `SELECT ur.user_id FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE ur.role = 'gestor' AND u.id_ies = 'd86c32ba-2d09-4c7e-a426-1d981ec7b595' LIMIT 1;`. **Peça ao João qual usuário usar** se houver dúvida.

Atalho usado abaixo: `B` = base ativa da PARACATU.

```sql
-- CTE comum (prefixe cada consulta com ela)
WITH B AS (
  SELECT sanarflix_user_id, semestre_atual AS semestre FROM public.dim_aluno_b2b
  WHERE id_ies = 'd86c32ba-2d09-4c7e-a426-1d981ec7b595' AND lower(btrim(perfil)) = 'aluno'
    AND status_atual = 'ativo' AND semestre_atual BETWEEN 1 AND 12)
```

| # | O que confere | SQL na fonte (depois do `WITH B`) | Bate com | Esperado 22/10 |
|---|---|---|---|---|
| V1 | Base ativa | `SELECT count(*) FROM B;` | `kpis.baseAtiva` | 521 |
| V2 | Engajados | `SELECT count(DISTINCT u) FROM (SELECT f.sanarflix_user_id u FROM fato_resolucao_questoes_b2b f JOIN B USING (sanarflix_user_id) WHERE f.response_date BETWEEN '2026-05-01' AND eng_hoje() UNION SELECT c.sanarflix_user_id FROM fato_consumo_conteudo_b2b c JOIN B USING (sanarflix_user_id) WHERE c.event_date BETWEEN '2026-05-01' AND eng_hoje()) s;` | `kpis.engajados` | 330 |
| V3 | Cobertura da classificação | `SELECT (SELECT count(DISTINCT question_id) FROM fato_resolucao_questoes_b2b WHERE taxonomia_status <> 'ausente') AS com_tax, (SELECT count(*) FROM eng_questao_classificacao WHERE origem = 'taxonomia') AS classificadas, (SELECT count(DISTINCT question_id) FROM fato_resolucao_questoes_b2b WHERE taxonomia_status = 'ausente' AND contexto_status = 'ausente') AS inalcancaveis;` (sem `WITH B`) | `com_tax = classificadas` | ≈ 67.792 = 67.792; inalcançáveis ≈ 3.273 |
| V4 | Atividade = fonte (rede) | `SELECT (SELECT count(*) FROM fato_resolucao_questoes_b2b) = (SELECT sum(respostas_todas) FROM eng_atividade_aluno_dia) AS respostas_ok, (SELECT count(*) FROM (SELECT DISTINCT sanarflix_user_id, event_date, content_id FROM fato_consumo_conteudo_b2b) s) = (SELECT sum(videos + documentos) FROM eng_atividade_aluno_dia) AS consumo_ok;` | ambos `true` | true, true |
| V5 | Questões resolvidas | `SELECT count(*) FROM fato_resolucao_questoes_b2b f JOIN B USING (sanarflix_user_id) JOIN eng_questao_classificacao c USING (question_id) WHERE f.response_date BETWEEN '2026-05-01' AND eng_hoje();` | `kpis.questoes` = `consumo.questoes.total` = `arvore.total.questoes` (Questões) | 145.873 (de-para vazio) |
| V6 | Acertos/erros | idem V5 com `count(*) FILTER (WHERE f.acertou)` e `FILTER (WHERE f.acertou = false)` | `acertoPct` | 96.825 / 49.048 → 66,4% |
| V7 | Vídeos e documentos | `SELECT content_type, count(*) FROM (SELECT DISTINCT c.sanarflix_user_id, c.event_date, c.content_id, c.content_type FROM fato_consumo_conteudo_b2b c JOIN B USING (sanarflix_user_id) WHERE c.event_date BETWEEN '2026-05-01' AND eng_hoje()) s GROUP BY 1;` | `consumo.videos.total`, `consumo.documentos.total`, `kpis.consumos` (Conteúdos, "Todos") | 8.810 / 5.027 |
| V8 | Recência fecha | `SELECT ativos30 + sumidos30a59 + sumidos60 + nuncaAcessou` do JSON | = `kpis.baseAtiva` | 197+69+64+191 = 521 |
| V9 | Níveis fecham | soma de `niveis[].total` | = `kpis.baseAtiva` | 4+193+15+309 = 521 |
| V10 | Hábito fecha | `baixo + medio + alto + altissimo` | = `habito.ativosNoMes` | 133+50+35+5 = 223 |
| V11 | Gaveta fecha | no JSON de Questões: Σ `grandesAreas[].questoes` = `clinico.questoes`; Σ `disciplinas[].questoes` = `basico.questoes`; `clinico + basico` = `total.questoes` = `kpis.questoes`; em cada nó, Σ filhos = nó | tudo igual | — |
| V12 | Semestres fecham | Σ `semestres[].questoes` (Questões, sem `p_semestre`) | = `kpis.questoes` | — |
| V13 | Meses fecham | Σ `meses[].questoes` / `videos` / `documentos` (Visão geral) | = totais de `consumo.*` | — |
| V14 | Gaveta de conteúdos fecha | Σ `arvore[].consumos` = `kpis.consumos`; em cada especialidade, Σ `modulos[].consumos` = especialidade; em cada módulo, Σ `conteudos[].consumos` = módulo | tudo igual | — |
| V15 | Proficiência | SQL `prof` da §8.10 isolada | `ranking[PARACATU].proficiencia` | 75,0% (338/452), "UNIATENAS - 10/09/26", 2026-09-10 |
| V16 | Admin fecha com o gestor | `ranking[PARACATU]` (engajados, base, acerto) | = `get_gestor_engajamento_visao_geral` da PARACATU, mesmo período | — |
| V17 | Admin fecha com a rede | Σ `ranking[].base` = `rede.baseAtiva`; Σ `ranking[].engajados` = `rede.engajados` | iguais | base ≈ 7.120 |
| V18 | Lista = cartão | `get_gestor_engajamento_lista(…, 'parou', …).total` = `niveis[parou].total`; idem para as 9 categorias | iguais | — |
| V19 | Tabela = base | `get_gestor_engajamento_alunos(…).total` sem busca/filtro = `kpis.baseAtiva` | iguais | 521 |
| V20 | Segurança | (a) como `anon`: qualquer RPC → erro de permissão; (b) gestor de **outra** IES chamando com o id da PARACATU → `Permission denied: cannot access this IES`; (c) gestor chamando `get_admin_engajamento` → `admin role required`; (d) `SELECT grantee, table_name FROM information_schema.role_table_grants WHERE table_name LIKE 'eng\_%' AND grantee IN ('anon', 'authenticated');` → 0 linhas | como descrito | — |
| V21 | Idempotência | rodar `eng_refresh('manual')` duas vezes; as `contagens` das duas linhas de log são iguais, exceto timestamps | iguais | — |
| V22 | Desempenho | `EXPLAIN ANALYZE` de cada RPC do gestor na **Integrado** (`72b19e77-c569-4bf7-a433-44563df1015f`, maior base: 960) com "Últimos 6 meses", e do admin | < 2 s cada (gestor), < 5 s (admin) | — |

Se algum número não bater, **pare e avise o João** com a consulta e os dois valores (§3.3).

---

## 15. Testes

### 15.1 Baseline (medir na tarefa A0)

| Medição | Valor |
|---|---|
| Arquivos de teste | 137 |
| Testes | 1.722 (40 falhas, 1.679 aprovados, 3 pulados) |
| Arquivos com falha | 11 |
| Erros de worker por timeout | 2 |

Medição de 22/10/2026 com `node node_modules/vitest/vitest.mjs run`.
- `npx vitest` não resolve nesta pasta: o `node_modules` é um link para o do repo principal. Use o caminho completo.
- Entre as falhas pré-existentes estão os 5 casos de `src/test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts`.
- O "385/385" da memória antiga **não vale mais**.
- **Critério de toda tarefa:** nenhuma falha **nova** em relação à lista salva na A0.

### 15.2 Testes novos (por tarefa, ver o plano)

| Tipo | Arquivo | O que prova |
|---|---|---|
| SQL estático | `src/test/unit/engajamentoMigrations.test.ts` | Para cada `get_gestor_engajamento_*` (migration mais recente que a define): `SECURITY DEFINER`, `STABLE`, `SET search_path TO 'public'`, a ordem papel → `v_ies` → `gestor_pode_acessar_ies`, ausência de `ies_features`/`gestao.portal_v2`/`fato_`/`taxonomias`, `REVOKE … FROM PUBLIC, anon` e `GRANT … TO authenticated`. Para `get_admin_engajamento`: `has_role(… 'admin'` antes de qualquer `WITH`. Para toda `CREATE TABLE public.eng_`: existe `REVOKE ALL ON TABLE public.<t> FROM PUBLIC, anon, authenticated` e `ENABLE ROW LEVEL SECURITY` na mesma migration. Para toda `CREATE … FUNCTION public.eng_`: `REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated`. |
| Contrato | `src/features/gestor/__tests__/contratoEnvelopeRpc.test.ts` (acrescentar casos) | As chaves de `'data', jsonb_build_object(` de cada RPC nova contêm exatamente as que `types-engajamento.ts` declara. |
| Funções puras | `src/features/gestor/__tests__/engajamento/libEngajamento.test.ts` | Cada função da §10.3 com: limites de período (31/12, 1º/07, `custom` inválido), ciclo 4/5/8/9, recência 0/1/2/null, `deltaPp`/`deltaPct` com null e 0, `pct1`, `dec1`, `compacto`. |
| Hook de URL | `…/engajamento/useFiltrosEngajamento.test.tsx` | Regras 1–8 da §9.6 |
| Hooks de RPC | `…/engajamento/queriesEngajamento.test.tsx` | Mesmo padrão de `__tests__/queries.test.tsx`: `mockRpc` chamado com o nome e os `p_*` exatos; `queryKey` com `user.id`; desabilitado sem `iesId`. |
| Componentes | um arquivo por bloco em `…/engajamento/` | Textos literais da §12, estados da §11, clique → setter correto, `aria-*` da §12. Fixtures **geradas a partir do exemplo JSON da §8** (nada de chave inventada). |
| Rotas | `__tests__/gestorV2Routes.test.tsx` (acrescentar) | `/gestor/engajamento`, `/questoes` e `/conteudos` montam dentro do portal novo. |
| Nav | `__tests__/SidebarNav.test.tsx` e `src/test/unit/adminNav.test.ts` (atualizar) | 4 itens, 2 grupos, badge NOVO; admin com 13 itens. |
| A11y | `__tests__/a11y.test.tsx` (acrescentar) | axe sem violações nas três abas e no drawer; todo gráfico com `figure` + `role="img"` + "Ver dados em tabela". |
| Tema | `__tests__/tema.test.tsx` (já cobre) | Nenhum hex/rgb nos arquivos novos. |

### 15.3 Testes existentes que **precisam** mudar (e só estes)

| Arquivo | Mudança |
|---|---|
| `src/features/gestor/__tests__/SidebarNav.test.tsx` | Atualizar as expectativas de quantidade/ordem dos itens e de títulos de grupo. |
| `src/test/unit/adminNav.test.ts` | Contagens de 11/12 para 12/13 itens e lista de URLs com `/admin/engajamento`. |
| `src/test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts` | A lista `toEqual([...])` de "descobre as onze RPCs" passa a incluir as 9 `get_gestor_engajamento_*` (ordem alfabética). **Este arquivo já falha no baseline:** só acrescente os nomes, sem tentar consertar as falhas antigas; registre isso no relatório da tarefa. |
| `src/features/gestor/__tests__/gestorV2Routes.test.tsx` | Só se algum `toEqual` de paths quebrar com a rota nova (o smoke test das 5 telas legadas não deve mudar). |

---

## 16. Riscos, limitações e trabalho futuro

| # | Item | Mitigação / próximo passo |
|---|---|---|
| R1 | Refresh mais lento que o previsto (ler 1,3 mi de linhas com JSON) | Medir na A5. Se passar de 15 min, avisar o João. Alternativa futura: refresh incremental por `carregado_em`. |
| R2 | A carga externa muda o schema das fontes | O pipeline falha, o log registra o erro e a tela segue com os dados de ontem. Avisar o João. |
| R3 | Semestre reclassifica o histórico (§1.5) | Futuro: usar `dim_aluno_b2b_snapshot` (desde 01/10/2026) para o semestre na data da atividade. |
| R4 | Base ativa histórica | Futuro: `b2b_question_access_intervals` (`sanarflix_user_id`, `valid_from`, `valid_until`, 14.947 linhas) permitiria "base ativa no mês". Fora desta entrega. |
| R5 | De-para vazio: ~125 mil respostas fora das questões | Outra sessão preenche `eng_depara_quiz_no`. Nenhuma mudança de código é necessária: o próximo refresh incorpora. |
| R6 | Consumo só web e só desde 2026 | Registrado no rodapé de Conteúdos. Futuro: incluir o app quando a carga trouxer. |
| R7 | Proficiência sem valor em 6 IES | "—" com nota. Some quando a IES fizer simulado ENAMED. |
| R8 | Telas do aluno (card de ranking e tela de ranking) | Trabalho futuro. Na base ativa só 4 alunos não têm `academy_user_id`, então a ponte de identidade não é mais o bloqueio. O bloqueio é o opt-in com a IES. |
| R9 | `eng_alunos_recorte` lê todo o histórico do aluno | Volume pequeno (≤ ~600 dias × 1 mil alunos por IES). Se a V22 falhar, o índice `eng_atividade_aluno_dia (sanarflix_user_id, dia)` já é a PK. Avisar antes de qualquer otimização que mude regra. |
