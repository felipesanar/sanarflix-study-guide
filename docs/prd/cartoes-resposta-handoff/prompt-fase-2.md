# Prompt para iniciar a Fase 2 em uma nova sessão

Copie o bloco abaixo como primeira mensagem da sessão. **Abra a sessão (o Claude) na pasta `C:\Users\joao.nader\work\sanarflix-cartoes`** e em nenhuma outra: uma tarefa = uma pasta = uma sessão. Veja `C:\Users\joao.nader\work\LEIA-ME.txt`.

```
Você vai executar a Fase 2 — Identificação, roster e planilha de saída do PRD de correção de cartões-resposta do SanarFlix Academy (V0, sem LLM).

Onde trabalhar: a pasta C:\Users\joao.nader\work\sanarflix-cartoes (um worktree do repositório sanarflix-study-guide, cujo .git fica em C:\Users\joao.nader\work\sanarflix-principal), branch feat/cartoes-resposta. Não use a pasta antiga do OneDrive nem as pastas sanarflix-fix-* (são de outras tarefas). Nunca commitar, mesclar ou dar push na main.
Comece com `git branch --show-current` (tem que ser feat/cartoes-resposta; se não for, pare e pergunte) e `git fetch origin && git merge origin/main` (regra 1 da seção 4 do PRD). Se houver conflito, pare e pergunte.
Supabase de produção: gvqvrmkizemwsasmupmo (confirme o ref antes de qualquer chamada).

Leia, nesta ordem, antes de qualquer ação:
1. docs/prd/cartoes-resposta-handoff/LEIA-ME.md — mapa do projeto, siglas (Fase, P1 a P8, F1 a F6) e estado atual.
2. docs/prd/2026-10-07-cartoes-resposta.md (revisão 7) — seções 1.1, 3, 4, 5, 7 e a Fase 2 na seção 8.
3. docs/prd/cartoes-resposta-handoff/fase-1.md (seções 3 e 8) e fase-e.md (seções 4 e 7).

Estado atual: tag cartoes-fase-e (as tags e a Fase E podem ainda não estar no GitHub). Existem services/cartao-omr/ com o gerador de cartões (layout.py, drawlist.py, card.py, models.py, cli.py), os templates sfa_v2.json e uniatenas_v1.json (com a lista de desenho `draw`), o pipeline de leitura de uma página (cartao_omr/pipeline/; `read_page` devolve um PageResult), tools/eval_accuracy.py e 140 testes Python verdes (venv em services/cartao-omr/.venv). No front, src/features/cartoes/ e a aba Admin → Simulados → Cartões-resposta emitem os cartões em TypeScript (192 testes; node_modules é uma junção para o de sanarflix-principal). Limiares do OMR: T_ALTO 0,50, T_BAIXO 0,20, GAP_MIN 0,30 (as fixtures não discriminam limiares; só o piloto da Fase 3 confirma). A importação do Academy já aceita o UUID do aluno ou a Matrícula/RA na 1ª coluna (cabeçalho `matricula_ra_ou_id`). O papel `cartao_omr_reader` ainda NÃO existe: é o portão de produção desta fase.

Atenção nesta fase:
- O portão do papel `cartao_omr_reader` exige aprovação explícita do João: migration aditiva, GRANT SELECT mínimo em simulados_admin(id,nome,ies_ids), questoes_simulado(simulado_id,numero_questao,ordem), users(id,nome,id_ies,matricula_ra) e ies(id,nome); senha informada pelo João fora do Git; validar pela information_schema; lembrar que o ACL padrão dá privilégio total a anon/authenticated em tabela nova. Se a ferramenta for barrada pelo modo automático, avise o João e não contorne com execute_sql.
- A planilha tem 1 + N colunas por posição: coluna 1 = UUID do aluno, depois Questão 1…N.
- Há 35 falhas antigas de testes do Portal do Gestor na main (gestorMigrations*, CascataDiagnostico, VisaoGeral, contratoEnvelopeRpc): fora do escopo.
- P8: as correções F1 (session-security) e F2 (gestor-ai-insights) existem em branches e pastas separadas (as duas já commitadas) e ainda não foram publicadas. Não bloqueiam esta fase, mas bloqueiam a impressão de cartões reais. Não mexa nelas.

Execute só a Fase 2. Peça aprovação explícita antes de qualquer ação em produção.
Ao final, siga a regra 8 da seção 4 (testes, commit, tag cartoes-fase-2, handoff fase-2.md, atualizar o LEIA-ME.md, prompt da fase seguinte, próximos passos meus/do João).
```
