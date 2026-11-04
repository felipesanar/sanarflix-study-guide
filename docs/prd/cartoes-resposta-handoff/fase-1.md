# Handoff — Fase 1: Pipeline de leitura (go/no-go)

- **Data:** 16/10/2026
- **Resultado: GO.** Todos os critérios de aceite foram atendidos nas fixtures, **com a ressalva da seção 3**.
- **Branch:** `feat/cartoes-resposta` (merge com `origin/main` feito no início da sessão, sem conflito). **Tag:** `cartoes-fase-1`.
- **Testes:** `services/cartao-omr` → **121 passed** (eram 92). A suíte do front não foi rodada: a fase só tocou `services/` e `docs/`.
- **Portões de produção:** nenhum. Houve **consultas de catálogo somente leitura** para a P8 (seção 6), autorizadas pelo João.

## 1. O que foi feito
Pacote `services/cartao-omr/cartao_omr/pipeline/` (funções puras, sem banco e sem arquivos):

| Módulo | O que faz |
|---|---|
| `render.py` | Página do PDF → cinza a 200 dpi (`pymupdf`). `is_blank`: quase sem pixels escuros no centro e fundo claro. |
| `align.py` | Acha candidatos a marcadores (componentes conexos quadrados e sólidos), escolhe os 4 de canto pela proporção da página (297/210), identifica o `tl` pelo marcador de orientação vizinho e atribui `tr`/`br`/`bl` pelas distâncias. Calcula a homografia mm → px com os 4 centros e a **refina com os 20 cantos dos marcadores**. `align_score` = RMS da reprojeção em mm (ilegível se > 1,5 mm). `rectify` gera a página canônica (1 px = 25,4/dpi mm). |
| `qr.py` | `zxing-cpp` no recorte retificado do QR (±3 mm), depois ampliado ×2, binarizado, página retificada e página inteira. Só aceita texto que `models.parse_qr` reconhece. |
| `omr.py` | `flatten` (divide pelo fundo local), tinta = pixel < 0,55 do fundo, fração de tinta num círculo de 70% do diâmetro, normalizada pela mediana das bolhas da página. `classify` (marcada / branco / multipla / ambigua) e `classify_batch` (vetorizada, para calibração). `read_matricula` (UniAtenas, 8 colunas obrigatórias, `NN-X-NNNNN`). |
| `page.py` | `read_page(gray, cfg, layout_hint)` → `PageResult` (`ok`, `pagina_em_branco` ou `pagina_ilegivel`, `qr`, `qr_ilegivel`, `alignment`, `answers`, `matricula`). |

Também: `tools/eval_accuracy.py` (métricas, matriz de confusão e `--calibrar`), perfil de fixtures **`estresse`** em `tools/make_fixtures.py`, `config.py` com `ReadConfig`, README atualizado.

### Decisões de projeto
- **Sem girar a imagem.** O PRD dizia "girar e repetir" para 180°/90°. A homografia já resolve qualquer rotação (testado em 90°, 180° e 270°), então não há laço de rotação.
- **A grade de respostas é igual nos dois layouts**, então o OMR das 100 questões roda mesmo sem QR. A matrícula só é lida quando o layout é `uniatenas` (pelo QR ou por `layout_hint`).
- **QR ilegível não derruba a página:** as respostas saem e `user_id` fica `None` (`qr_ilegivel = True`). A Fase 2 manda a página para Pendências.
- **Limiares:** `T_ALTO` 0,50, `T_BAIXO` 0,20, `GAP_MIN` 0,30, `T_INK` 0,55 (ver seção 3).

## 2. Resultados
Conjunto **completo** (245 páginas, semente 777; 20.974 questões estritas, 83.896 bolhas):

| Critério | Meta | Medido |
|---|---|---|
| Acerto por bolha | ≥ 99,8% | **100%** |
| Múltipla lida como letra | 0 | **0** |
| Letra errada nas marcas não estritas | 0 | **0** (1.053 aceitas como ambígua/branco, 130 com a letra pretendida) |
| Matrícula correta (UniAtenas) | ≥ 99,5% | **79/79** e 0 defeituosas aceitas como válidas |
| QR lido (QR intacto) | ≥ 99% | **236/236**; os 2 danificados não foram lidos |
| Ilegíveis com rotação ≤ ±5° | ≤ 0,5% | **0/238**; as 2 propositais foram detectadas |
| Páginas em branco | – | **5/5** |
| Erro de alinhamento | – | médio 0,087 mm (máx 0,22 mm) |

Fixtures versionadas (28 páginas): 100% em tudo. Conjunto de **estresse** (65 páginas; 100/150 dpi, ruído, JPEG de qualidade 25–45, marcas a partir de 45% de cobertura): 100% em tudo, alinhamento médio de 0,13 mm.

Tempo (medido em 12 núcleos): ~24 s para 245 páginas em paralelo; num único processo, ~27 ms por página para renderizar e ~80 ms para ler.

## 3. Ressalva: as fixtures não discriminam os limiares
- A pior marca "marcada" pontua **0,609** e o pior branco **0,082**. Entre os dois não há nenhuma questão estrita.
- Resultado: **650 combinações** de limiares acertam 100% (`T_ALTO` de 0,20 a 0,60, `T_BAIXO` de 0,10 a 0,48, `GAP_MIN` de 0,05 a 0,40). A "calibração" não escolhe nada: mantive os valores definidos antes de ver os dados, no meio da região (folga de ~0,11 sobre a pior marca e ~0,12 sobre o pior branco).
- Uma marca real mais fraca que as sintéticas (caneta falhando, bolha preenchida pela metade, traço fino) cairia na zona 0,2 a 0,5, que o leitor devolve como **`ambigua`**, isto é, para revisão humana. Esse é o modo de falha seguro e o que a Fase 3 precisa **quantificar**: que fração das questões reais vira `ambigua`.
- As fixtures e o leitor foram escritos pela mesma pessoa e sessão: parte do acerto de 100% é estrutural. Os testes de estresse reduzem, mas não eliminam, esse risco.

**Para a Fase 3:** rodar o piloto com gabarito conhecido, montar o gabarito no mesmo formato JSON (`tools/make_fixtures.py` documenta o esquema; para cartões reais bastam `truth` e `letter` por questão) e usar `eval_accuracy.py --calibrar` sobre ele. É aí que `T_ALTO`, `T_BAIXO` e `T_INK` se confirmam ou mudam.

## 4. Outros ajustes desta sessão
- **Texto do cartão pessoal** (pedido do João): "Confira se o nome **acima de ALUNO** é o seu." Os PDFs de exemplo foram regenerados; **as fixtures versionadas não** (o texto não afeta a leitura e regenerar 6 MB de binários só incharia o Git).
- **Gabarito das fixtures:** a rasura agora registra `letter` (a letra forte). O avaliador aceita gabaritos antigos usando a bolha mais coberta.
- **Importação por ID** (João, 16/10): a 1ª coluna aceita UUID ou Matrícula/RA, cabeçalho `matricula_ra_ou_id`. O PRD (seção 7.4) já reflete isso.

## 5. Desvios do PRD
- Sem laço de rotação (seção 1).
- Módulo extra `pipeline/page.py` (orquestra as etapas; a Fase 2 o usa).
- `align_score` é o **RMS** da reprojeção dos 20 cantos de marcador em mm; o máximo e o erro do marcador de orientação (4 mm, usado como checagem independente) também são calculados.
- Detecção de página em branco só vale **se o alinhamento falhar** (um cartão em branco tem texto e marcadores e nunca cai nesse caso).

## 6. P8 — `user_id` impresso no QR: auditoria feita
Relatório completo em `docs/prd/cartoes-resposta-handoff/p8-auditoria-user-id.md`. Em resumo:
- **F1 (ALTA)** `session-security`: qualquer pessoa com a anon key e um UUID derruba todas as sessões desse usuário, sem login. **Verificado** no código e na versão publicada.
- **F2 (MÉDIA)** `gestor-ai-insights`: o cache de IA sobre um aluno é devolvido antes de checar papel/IES. **Verificado.**
- **F3 (BAIXA)** `get_user_roles`/`has_role`: qualquer usuário logado consulta os papéis de um UUID. **Verificado.**
- **F4 (fora do tema)** `send-study-reminder` é um relé de e-mail aberto. **Verificado.**
- Estão corretos: RLS (ligado em todas as tabelas, nenhuma política satisfeita só por UUID) e as 13 funções executáveis por `anon`.
- Correções são do código do Academy; **nenhuma foi feita**. A P8 só fecha com F1 e F2 corrigidas e F3 decidida.

## 7. Pendências
1. **P8:** corrigir F1 e F2 (e decidir F3, F4, F6) antes de imprimir cartões reais. Dono: João / equipe do Academy.
2. **P2, P3, P5:** o João resolve na sequência (campi UniAtenas; matrículas faltantes e os 5 cadastros `99-G-99999`; comunicação às IES).
3. **Fase E** (emissão em TypeScript): o go da Fase 1 foi dado, então ela pode começar. É trabalho fora de `services/`.
4. **Push:** o commit da Fase 1 e a tag `cartoes-fase-1` ainda não foram enviados.

## 8. Notas para a próxima fase (Fase 2 — identificação, roster e planilha)
- **Portão de produção:** criar o papel `cartao_omr_reader` por migration aditiva, **só com aprovação explícita do João**. `GRANT SELECT` mínimo: `simulados_admin(id, nome, ies_ids)`, `questoes_simulado(simulado_id, numero_questao, ordem)`, `users(id, nome, id_ies, matricula_ra)` e `ies(id, nome)`. Conferir os grants pela `information_schema` e lembrar que tabela nova nasce com privilégio total para `anon`/`authenticated` (ver [[sanarflix-supabase-default-acl-revoke]]). Se `apply_migration` for barrada, avisar o João; não contornar com `execute_sql`.
- **Contrato do leitor:** `read_page(gray)` → `PageResult`. Mapeamento para Pendências: `status == pagina_ilegivel` → `pagina_ilegivel`; `qr_ilegivel` → `qr_ilegivel` + `aluno_nao_identificado`; `qr.data.sim8` diferente do `--simulado` → `simulado_divergente` (comparar com `models.sim8(simulado_id)`); `Cell.kind` `multipla`/`ambigua` → célula vazia, amarela, com comentário; `matricula.valid == False` → `matricula_invalida`.
- **Planilha** (PRD 7.4): 1ª aba `Respostas`, exatamente `1 + N` colunas (N = `total_questoes`), coluna 1 `matricula_ra_ou_id` com o UUID, depois `Questão 1…N`, só A–D ou vazio. Espelhar `parseMatrizRespostas` e `isRespostaValida` em um teste Python.
- **UniAtenas:** a matrícula lida (`NN-X-NNNNN`) é comparada com `upper(trim(matricula_ra))`, sem aproximação, e convertida em `user_id` para a coluna 1. Os 5 cadastros `99-G-99999` não casam (cadastro errado).
- **Recortes das pendências:** use `templates/*.json` (`crops_mm.nome`, `crops_mm.matricula`) sobre a página retificada (`align.rectify`).
- **Desempenho:** ~0,11 s por página num único processo (27 ms de render + 80 ms de leitura). Um PDF de 500 cartões leva cerca de 1 minuto sem paralelismo; `eval_accuracy.py` mostra como paralelizar com `ProcessPoolExecutor`.
- Rodar `eval_accuracy.py` depois de qualquer mudança em `pipeline/` ou `config.py`.

## 9. Próximos passos
**Meus (Claude):**
1. Fase 2: `roster.py` (psycopg, só SELECT), `identity.py`, `export_xlsx.py`, `cartao-omr processar` completo, `gerar-cartoes` com o roster do banco e o teste de compatibilidade com a importação. Começa pelo portão do papel `cartao_omr_reader`.
2. Fase E (emissão em TypeScript) quando o João quiser: `draw` exportado pelo Python, gerador TS com `jspdf`, testes de paridade.
3. Se pedido: preparar as correções F1, F2 e F4 no código do Academy.

**Do João:**
1. Rodar o push da branch e da tag `cartoes-fase-1` (comandos na resposta da sessão).
2. Aprovar a ordem: Fase 2 antes da Fase E, ou o contrário.
3. Corrigir ou me pedir as correções de F1 e F2 (e decidir F3, F4 e F6) antes do piloto.
4. Resolver P2, P3 e P5. Para a Fase 3, preparar o piloto: um simulado de teste, cartões pessoais impressos e preenchidos por voluntários **com gabarito conhecido**, escaneados em 200 e 300 dpi.

## 10. Prompt de início da Fase 2
```
Você vai executar a Fase 2 — Identificação, roster e planilha de saída do PRD de correção de cartões-resposta do SanarFlix Academy (V0, sem LLM).

Repo: sanarflix-study-guide (pasta "Academy Project"). Branch: feat/cartoes-resposta. Nunca commitar/pushar na main.
Comece com `git branch --show-current` e `git fetch origin && git merge origin/main` (regra 1 da seção 4).
Supabase de produção: gvqvrmkizemwsasmupmo (confirme o ref antes de qualquer chamada).

Leia, nesta ordem, antes de qualquer ação:
1. docs/prd/2026-10-07-cartoes-resposta.md (revisão 6) — seções 1.1, 3, 4, 5, 7 e a Fase 2 na seção 8.
2. docs/prd/cartoes-resposta-handoff/fase-1.md — entregas, desvios e notas da fase anterior (principalmente as seções 3 e 8).

Estado atual: tag cartoes-fase-1. Existem services/cartao-omr/ com o gerador de cartões, os templates sfa_v2.json e uniatenas_v1.json, o pipeline de leitura de uma página (cartao_omr/pipeline/: render, align, qr, omr, page; `read_page` devolve um PageResult), tools/eval_accuracy.py e 121 testes verdes. Limiares do OMR: T_ALTO 0,50, T_BAIXO 0,20, GAP_MIN 0,30 (as fixtures não discriminam limiares; só o piloto da Fase 3 confirma). A importação do Academy já aceita o ID do aluno (UUID) ou a Matrícula/RA na 1ª coluna, cabeçalho `matricula_ra_ou_id`. O papel `cartao_omr_reader` ainda NÃO existe: é o portão de produção desta fase.
Atenção nesta fase: o portão do papel `cartao_omr_reader` exige aprovação explícita do João (migration aditiva, GRANT SELECT mínimo em simulados_admin(id,nome,ies_ids), questoes_simulado(simulado_id,numero_questao,ordem), users(id,nome,id_ies,matricula_ra) e ies(id,nome); senha informada pelo João fora do Git; validar pela information_schema). Se a ferramenta for barrada pelo modo automático, avise o João e não contorne com execute_sql. A planilha tem 1 + N colunas por posição: coluna 1 = UUID do aluno, depois Questão 1…N. A P8 (user_id no QR) tem 2 correções pendentes no código do Academy (F1 session-security e F2 gestor-ai-insights); não bloqueiam esta fase, mas bloqueiam a impressão de cartões reais.

Execute só a Fase 2. Peça aprovação explícita antes de qualquer ação em produção.
Ao final, siga a regra 8 da seção 4 (testes, commit, tag cartoes-fase-2, handoff, prompt da fase seguinte, próximos passos meus/do João).
```
