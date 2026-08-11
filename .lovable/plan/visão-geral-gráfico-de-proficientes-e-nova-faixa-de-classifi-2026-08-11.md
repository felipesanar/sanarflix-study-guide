# Visão Geral: gráfico de proficientes e nova faixa de classificação

## 1. "Evolução institucional" (modo Geral) passa a mostrar % de alunos proficientes

Hoje a linha mostra a média da nota de proficiência (TRI) por simulado. Vai passar a mostrar o **percentual de alunos proficientes** (nota ≥ 60) em cada simulado — a mesma conta do KPI "Alunos proficientes", então os dois números conversam.

O dado já é calculado no banco (`prof_pct` por simulado), só não é devolvido para a tela. A regra de excluir simulados sem TRI processado **fica exatamente como está**: um simulado sem TRI não tem proficiência nem contagem de proficientes, continua fora do gráfico e continua contado no aviso do rodapé.

Ajustes de leitura que vêm junto:
- Eixo Y continua 0–100, agora lido como "% de alunos proficientes".
- Tooltip: "X% de alunos proficientes · N alunos".
- Legenda da série e coluna da tabela alternativa: "Alunos proficientes (%)".
- A linha tracejada "meta de proficiência · 60" **sai deste modo**: 60 é corte de nota do aluno, não meta de percentual de turma — mantê-la ali afirmaria uma meta que não existe. Os modos "Grande área" e "Aluno" não mudam.
- Estado de 1 único simulado passa a exibir o percentual, com o mesmo texto explicativo.

## 2. Nova faixa de classificação no Diagnóstico Curricular

| Nível | Hoje | Novo |
|---|---|---|
| Crítico | abaixo de 30% de acerto | **abaixo de 50%** |
| Mediano | 30% a 79% | **50% a 79%** |
| Excelente | 80% ou mais | 80% ou mais (sem mudança) |

O corte vive em um único lugar no front (`NIVEL_CRITICO_MAX`), então todos os textos, chips, tooltips das três classificações, exportações e o estado vazio ("nenhuma área abaixo de X% de acerto") passam a dizer 50% automaticamente.

O agrupamento das áreas, porém, é feito no banco: as funções que classificam área/especialidade/tema (`get_gestor_visao_geral`, `get_gestor_diagnostico`, `get_gestor_detalhamento_temas`) têm o corte 30 escrito dentro delas e precisam de uma migration para ir a 50. Sem isso o rótulo mudaria mas a área continuaria caindo em "mediano".

Efeito prático esperado: o grupo "crítico", hoje quase sempre vazio, passa a receber a maior parte das grandes áreas com acerto entre 30% e 49%.

## Detalhes técnicos

**Banco (uma migration, `CREATE OR REPLACE`, aditiva):**
- `get_gestor_visao_geral`: acrescenta `proficientesPct` a cada item de `evolucao` (a partir de `metricas.prof_pct`), mantendo `valor` (média de proficiência) no envelope para não quebrar a tabela/KPIs que já o consomem; troca `< 30` por `< 50` em `areas_nivel` e no flag `critica` de `evolucaoPorArea`.
- `get_gestor_diagnostico` e `get_gestor_detalhamento_temas`: troca do corte 30 → 50 na classificação de nível.

**Front:**
- `api/types.ts`: `evolucao[].proficientesPct: number | null`.
- `charts/EvolucaoChart.tsx`: série passa a usar `proficientesPct`; filtro de "tem TRI" continua baseado na ausência de proficiência do simulado; remove a `ReferenceLine` da meta 60; textos de tooltip, legenda, `desc`/`aria-label` e tabela alternativa.
- `lib/regras.ts`: `NIVEL_CRITICO_MAX = 50`.
- Testes: atualizar os casos de fronteira em `regras.test.ts`, `regras-criticas.test.tsx`, `CascataDiagnostico.test.tsx` e `TabelaQuestoes.test.tsx` (28%/42% deixam de ser mediano) e o teste do gráfico.
