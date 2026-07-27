# 13 · Plano de entrega

Uma fase por PR. Cada fase é entregável e testável sozinha.

| Fase | Escopo | Saída |
|---|---|---|
| **0 · Fundação** | Tokens (claro+escuro), tipos de `contracts/types.ts`, cliente de API + React Query, MSW com as fixtures, `GestorLayout` (sidebar, marca, seletor de IES por papel), rotas vazias, tema | App navega entre 3 rotas vazias com shell final |
| **1 · Início** | Cronograma (todos os status), avisos, direcionadores, estados vazio/erro/loading | Home completa |
| **2 · Visão Geral (executivo)** | Filtro de semestre + 4 KPIs + régua de evolução + gráfico protagonista + toggle Grande área/Aluno | Panorama funcional |
| **3 · Diagnóstico** | Resumo por nível, cascata de 2 níveis, drawer de temas, exportar recorte | Investigação curricular |
| **4 · Alunos** | Distribuição, dispersão com tendência, tabela com busca/tags/paginação, visão detalhada | Jornada de aluno |
| **5 · Detalhamento (1 simulado)** | Seletor, 3 KPIs, acerto por área e semestre com clique cruzado, dispersão, alunos do simulado + drawer, questões (último bloco) + drawer de cronograma | Camada investigativa |
| **6 · Comparativo (2+)** | Colapsado + expandido, questões por tema, coluna Variação, ocultar questões | Comparação honesta |
| **7 · Acabamento** | Motion completo, reduced-motion, a11y, tema escuro revisado, virtualização, telemetria | Pronto para piloto |

## Estratégia de release

- **Feature flag por instituição** (`portal_gestor_v2`). Sem big bang.
- Piloto com 1–2 IES por 2 semanas → ajuste → GA por lotes.
- Rollback = desligar a flag; nenhuma migração destrutiva de dado.
- Backend entrega as views agregadas **antes** da fase 2 (senão a UI mede dado bruto e não escala).

## Telemetria (sem PII)

| Evento | Por quê |
|---|---|
| `gestor_tela_vista` (tela, semestre) | Adoção por tela |
| `gestor_filtro_alterado` (tipo, valor) | O filtro está sendo usado? |
| `gestor_tempo_ate_primeiro_insight` | Tempo até abrir cascata/drawer/detalhe |
| `gestor_drawer_aberto` (tipo) | Profundidade de investigação |
| `gestor_export_solicitado` (escopo) | Valor percebido |
| `gestor_erro_bloco` (bloco, código) | Saúde real por bloco |

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Agregação pesada no backend | Materialized views + cache por recorte; contrato de latência < 800ms |
| Gabarito atrasado gera tela vazia | Estado `processing` explícito, com data prevista |
| Comparativo com muitos simulados fica ilegível | Aviso acima de 5 + comparativo colapsado por padrão |
| Time confundir escala TRI/proficiência | Formatadores centralizados + testes de regra |
| Dark mode divergir do claro | Mesmos tokens, camada dark; visual regression nos dois temas |
