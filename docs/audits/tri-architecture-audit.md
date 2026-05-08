# Auditoria TRI — Desempenho Institucional

> Documento técnico gerado a partir da auditoria descrita em `.lovable/plan.md`.
> **Escopo:** somente diagnóstico. Nenhuma alteração de código foi executada.
> **Data:** 2026-05-08.

---

## 1. Estado atual da arquitetura

### 1.1 Tabelas TRI no Supabase

| Tabela | Linhas | PK atual | FKs | RLS |
|---|---|---|---|---|
| `dim_questoes_tri` | 95 | `item_id` | `item_id → questoes_simulado(id)` | **Desativada** |
| `resultados_alunos_tri` | 210 | `student_id` | `student_id → users(id)`; `simulado_id → simulados_admin(id)`; `college_id → ies(id)`; **e** `college_id → resultados_ies_tri(college_id)` (redundante) | **Desativada** |
| `resultados_ies_tri` | 2 | `college_id` | `college_id → ies(id)`; `simulado_id → simulados_admin(id)` | **Desativada** |

Colunas confirmadas:

- `dim_questoes_tri`: `item_id, difficulty_b, std_error, infit, outfit, is_flagged, flag_reason` → **modelo Rasch (1PL)**. Não há parâmetro `a` (discriminação) nem `c` (chute).
- `resultados_alunos_tri`: `student_id, college_id, simulado_id, theta, std_error, num_items_answered, num_correct, proportion_correct, score_proprio, score_enamed, is_proficient_proprio, is_proficient_enamed, is_extreme`.
- `resultados_ies_tri`: `college_id, simulado_id, num_students, num_proficient, pcp, mean_score, median_score, std_score, min_score, max_score, concept, sanctions, is_restricted`.

### 1.2 Consumo no frontend / RPCs

Busca em todo `src/` e `supabase/` por referências às tabelas TRI:

- **Apenas `src/integrations/supabase/types.ts`** as menciona (tipos auto-gerados pelo Supabase).
- **Nenhum** hook, serviço, componente, edge function ou RPC lê `resultados_alunos_tri`, `resultados_ies_tri` ou `dim_questoes_tri`.

RPCs usadas hoje pela página `DesempenhoInstitucionalV2` (via `src/services/institutional.ts`):

- `get_institutional_performance(p_simulado_id, p_ies_id)`
- `get_institutional_student_scores(p_simulado_id, p_ies_id)`
- `get_institutional_evolution(p_ies_id)`
- `get_institutional_question_details(...)`
- `get_institutional_simulados(...)`

Todas operam sobre `answer_progress` + `questoes_simulado` (% acerto bruto). **Nenhuma usa as tabelas TRI.**

### 1.3 Cálculos no mapper (`src/utils/mapInstitutionalData.ts`)

- KPI **"Proficiência Média (TRI)"** = `overallAccuracy` (% de acerto). **Não é TRI.**
- **"% Proficientes"** = alunos com `pct >= 60` em acerto bruto. Não usa `is_proficient_*`.
- **"Conceito"** derivado da % de proficientes via thresholds 40/60/75/90. Não usa `concept` da `resultados_ies_tri`.
- **"Distância Próxima Faixa"**, **"Alunos faltam meta"**, **"Sanção"** → derivados do mesmo cálculo de acerto bruto.
- **Faixas** (Insuficiente / Regular / Intermediário / Bom / Excelente) classificam por `% acerto`, não por `theta` nem por `score_enamed`.
- **Evolução institucional** estima `% proficientes` de simulados anteriores via heurística `accuracy * 0.85 - 5`.

### 1.4 Fluxo de dados (atual)

```text
Pipeline Python externo  ──►  resultados_*_tri  /  dim_questoes_tri   (NÃO lido pelo app)
                                                                        
answer_progress ─► RPC get_institutional_*  ─► services/institutional.ts
                                                  │
                                                  ▼
                                       useInstitutionalPerformanceData
                                                  │
                                                  ▼
                                    mapInstitutionalRpcToViewModel
                                       (recomputa proficiência por % acerto
                                        e rotula como "TRI")
                                                  │
                                                  ▼
                                       DesempenhoInstitucionalV2.tsx
```

---

## 2. Problemas encontrados

### 2.1 Críticos (modelagem do banco)

1. **PK insuficiente em `resultados_ies_tri`** — `PRIMARY KEY (college_id)` impede armazenar mais de um simulado por IES. Hoje só há 2 linhas (1 IES = 1 simulado). Correto: `(college_id, simulado_id)`.
2. **PK insuficiente em `resultados_alunos_tri`** — `PRIMARY KEY (student_id)` impede um aluno ter resultado em mais de um simulado. Correto: `(student_id, simulado_id)`.
3. **FK redundante** — `resultados_alunos_tri.college_id → resultados_ies_tri(college_id)` cria acoplamento: nenhum aluno pode existir sem linha agregada da IES. Já existe `fk_alunos_tri_ies → ies(id)`; a outra deve ser removida.
4. **RLS desativada nas 3 tabelas** — cliente autenticado não consegue ler. Quando habilitada, precisa de políticas equivalentes às de `simulados_admin` (admin global, b2b_partner, professor/gestor da IES via `get_current_user_ies_id() = college_id`, service_role para ingestão).

### 2.2 Inconsistências conceituais (frontend)

5. **KPI "Proficiência Média (TRI)" exibe % de acerto.** O rótulo mente.
6. **"Alunos Proficientes"** ignora `is_proficient_proprio` / `is_proficient_enamed` e recomputa por % de acerto.
7. **Conceito da IES** recomputado no frontend em vez de usar `resultados_ies_tri.concept`.
8. **Sanção** recomputada no frontend por thresholds; ignora `resultados_ies_tri.sanctions` / `is_restricted`.
9. **Evolução institucional** estima % de proficientes via heurística. Deve vir direto de `resultados_ies_tri` por `(college_id, simulado_id)`.
10. **Faixas de distribuição** usam `% acerto`. Por TRI, faixas devem ser por `score_enamed` (0–100 normalizado) ou por `theta`.
11. **Gap para próximo conceito** derivado de `% proficientes` por acerto. Deve usar `pcp` e `concept` reais.

### 2.3 Inconsistências técnicas

12. Nenhuma RPC `get_institutional_*` foi atualizada para juntar com TRI.
13. `src/integrations/supabase/types.ts` mostra apenas a FK redundante para `resultados_ies_tri` em `resultados_alunos_tri`; o supabase-js não conhece os relacionamentos com `users` / `ies` / `simulados_admin` para joins implícitos.
14. `dim_questoes_tri` é **Rasch (1PL)** — não há `discriminacao` nem `chute`. Qualquer texto, tooltip ou insight que mencione esses parâmetros está incorreto.
15. Faltam **índices secundários** em `resultados_alunos_tri(simulado_id, college_id)` e `resultados_ies_tri(simulado_id)`. Após corrigir as PKs, criar índices para queries por simulado.

### 2.4 Riscos futuros

16. Sem PK composta + RLS, ingestões repetidas do pipeline Python irão falhar (conflito de PK) ou sobrescrever dados (depende do modo de upsert).
17. Sem materialized view para evolução, custo de query cresce linearmente com nº de simulados × alunos.
18. Mistura de "TRI" e "% acerto" sob o mesmo rótulo na UI induz decisão pedagógica errada do gestor.

---

## 3. Componentes corretos (manter)

- Estrutura geral da página `DesempenhoInstitucionalV2.tsx`, abas, filtros, drawers, simulador, layout, design system.
- Diagnóstico curricular (área → especialidade → tema) baseado em **% acerto** — está conceitualmente correto e deve continuar usando acerto bruto.
- KPI "Total de Alunos", "Percentual de Acertos" (rótulo honesto), "Taxa de Adesão".
- Hooks de UI (`useDesempenhoV2State`), filtros (`applyDesempenhoV2Filters`), exportadores PDF / XLSX.
- Pipeline externo Python que produz as 3 tabelas — fora do escopo.

---

## 4. Separação canônica TRI × % acerto

| Indicador | Fonte correta |
|---|---|
| Nota individual do aluno | `resultados_alunos_tri.score_enamed` (ou `score_proprio`) |
| Theta individual | `resultados_alunos_tri.theta` |
| Aluno proficiente? | `resultados_alunos_tri.is_proficient_enamed` |
| Nota média da IES | `resultados_ies_tri.mean_score` |
| % proficientes da IES | `resultados_ies_tri.pcp` / `num_proficient` / `num_students` |
| Conceito da IES | `resultados_ies_tri.concept` |
| Sanção / restrição regulatória | `resultados_ies_tri.sanctions`, `is_restricted` |
| Evolução institucional entre simulados | `resultados_ies_tri` agrupado por `simulado_id` |
| Faixas de desempenho | `score_enamed` (0–100) |
| Diagnóstico curricular (área / especialidade / tema) | **% acerto** (continuar) |
| Prevalência, "questões mais erradas" | **% acerto** (continuar) |
| Dificuldade da questão (parâmetro) | `dim_questoes_tri.difficulty_b` |
| Qualidade do item (flag) | `is_flagged`, `infit`, `outfit` |

---

## 5. Roadmap faseado

### Fase 1 — Correções críticas de modelagem e segurança

Migration aditiva (sem `DELETE` / `TRUNCATE`):

1. PKs:
   - `resultados_ies_tri` → `(college_id, simulado_id)`.
   - `resultados_alunos_tri` → `(student_id, simulado_id)`.
2. Remover FK redundante `resultados_alunos_tri_college_id_fkey`.
3. Índices: `(simulado_id)` em ambas; `(college_id, simulado_id)` em `resultados_alunos_tri`.
4. RLS habilitada nas 3 tabelas com políticas equivalentes às de `simulados_admin`.
5. Documentar contrato de upsert do pipeline Python: `ON CONFLICT (student_id, simulado_id) DO UPDATE …`.

### Fase 2 — Consolidação TRI no backend de leitura

1. RPCs novas (não substituem as atuais):
   - `get_institutional_tri(p_simulado_id, p_ies_id)` → `concept, pcp, mean_score, num_students, num_proficient, sanctions, is_restricted` + lista de alunos com `score_enamed, is_proficient_enamed, theta`.
   - `get_institutional_evolution_tri(p_ies_id)` → série temporal real por simulado a partir de `resultados_ies_tri`.
2. Centralizar regras de proficiência e conceito **no banco**. Frontend só lê.
3. Logs temporários: `console.log('[TRI_AUDIT] …')`, `[IES_TRI]`, `[ALUNO_TRI]`, `[INSIGHT_VALIDATION]` nos hooks de leitura.

### Fase 3 — Refatoração do frontend (mapper + UI)

1. Em `mapInstitutionalData.ts`:
   - `proficientes` ← `students.filter(s => s.is_proficient_enamed)`.
   - KPI "Proficiência Média (TRI)" ← `resultados_ies_tri.mean_score`.
   - `conceito` ← `resultados_ies_tri.concept`.
   - `sancao` ← `resultados_ies_tri.sanctions`.
   - Faixas ← `score_enamed`.
2. Renomear / ajustar tooltips e textos para deixar explícito quando é **TRI** vs **% acerto**.
3. Visão de Alunos: exibir `score_enamed` como "Nota TRI"; manter coluna separada de "% acerto" se útil pedagogicamente.
4. Insights pedagógicos: revisar textos; remover referências a "discriminação" / "chute" (não existem no Rasch atual).
5. Simulador de impacto: validar fórmulas — entrada deve ser variação de `pcp` ou `mean_score`, não de % acerto.

### Fase 4 — Escalabilidade e evolução pedagógica

1. Materialized view `mv_evolucao_institucional_tri` por `(college_id, simulado_id, created_at)`.
2. Cache de queries TRI (react-query `staleTime` maior — pipeline roda em batch).
3. Comparação longitudinal: delta de `mean_score` e `concept` entre simulados consecutivos.
4. Crescimento individual: delta de `theta` por aluno.
5. Tracking institucional histórico (snapshot por execução do pipeline).

---

## 6. Critérios de sucesso da auditoria

- [x] 3 tabelas TRI auditadas (estrutura, FKs, PKs, RLS, dados).
- [x] Fluxo Supabase → RPC → Frontend documentado.
- [x] Inconsistências conceituais e técnicas listadas.
- [x] Separação canônica TRI × % acerto definida.
- [x] Roadmap em 4 fases entregue.
- [x] Nenhum arquivo de produção alterado nesta etapa.

---

## 7. Próxima ação sugerida

1. Aprovação explícita do usuário para executar **Fase 1** (migration aditiva: PKs compostas, remoção da FK redundante, índices, RLS).
2. Em seguida, Fase 2 — criar as RPCs novas em paralelo às antigas (sem breaking change).
3. Só então Fase 3 — refator do mapper e UI, com remoção dos cálculos legados.

> Nada de visual será alterado. Nenhum cálculo legado será removido antes da Fase 3, garantindo zero quebra durante a transição.
