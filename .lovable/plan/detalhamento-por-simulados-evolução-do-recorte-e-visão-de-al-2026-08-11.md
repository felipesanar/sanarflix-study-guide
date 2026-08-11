# Detalhamento por Simulados — evolução do recorte e Visão de alunos

## 1. Gráfico "Evolução do recorte" (2+ simulados)

### Por que está vazio
Diagnóstico confirmado: na mudança de ontem, `EvolucaoChart` passou a plotar o **percentual de alunos proficientes** (`proficientesPct` de cada ponto) em vez da média de proficiência. A Visão Geral foi ajustada junto (a RPC `get_gestor_visao_geral` passou a devolver o campo), mas o Detalhamento não: `EvolucaoRecorte` monta os pontos a partir de `metricas` e só passa `valor: proficienciaMedia` — sem `proficientesPct`. Resultado: todos os pontos ficam com valor nulo e o gráfico cai no estado vazio "Nenhum simulado deste recorte tem percentual de alunos proficientes calculado".

A RPC `get_gestor_detalhamento` já calcula internamente, por simulado, `n_tri` (alunos com TRI) e `n_prof` (alunos com nota ≥ 60) — usa os dois no `enamedProjetado` — mas não expõe o percentual no envelope `metricas`.

### O que fazer
- **Banco (migration aditiva)**: em `get_gestor_detalhamento`, acrescentar a chave `proficientesPct` a cada item de `metricas` (`100 * n_prof / n_tri`, arredondado; `null` quando `n_tri = 0`, nunca zero). Nada mais muda no envelope.
- **Front**: `MetricasSimulado` ganha `proficientesPct?: number | null`; `EvolucaoRecorte` passa esse campo ao gráfico. O critério de entrada continua o mesmo (só simulados com TRI processado), e a série passa a ser o percentual de proficientes, igual à Visão Geral.
- Ajustar título/legenda do card para refletir o dado ("Evolução do percentual de alunos proficientes" no bloco de recorte) e revisar os testes de `EvolucaoRecorte`.

## 2. Componente "Visão de alunos" (2+ simulados)

### Confirmação
As colunas **Número de acertos** e **Proficiência** **não** são médias. A RPC monta cada linha a partir da CTE `alvo`, que é o **simulado mais recente do recorte**; `Variação` compara esse simulado com o imediatamente anterior da seleção.

### O que fazer (só front, sem alterar a RPC)
- **Tag ao lado do título "Visão de alunos"**: chip minimalista, aparece apenas com 2+ simulados selecionados, com texto curto ("simulado mais recente") e tooltip explicando que acertos e proficiência são do último simulado do recorte, não médias.
- **Coluna Variação**: além do número, mostrar entre parênteses o simulado usado como base da comparação — ex. `+6,6 (vs 3º Simulado FAI)`. O rótulo ordinal + nome vem de `metricas` ordenado por data (o penúltimo do recorte), então é o mesmo para todas as linhas; células sem base ou sem participação continuam com `—`.
- Como a RPC devolve **uma** variação por aluno (último vs. anterior), não é possível exibir uma variação por simulado selecionado sem mudar a RPC. Fica registrado como pendência; se quiser a série completa depois, é uma segunda etapa de banco.

## Detalhes técnicos
- Migration: `CREATE OR REPLACE FUNCTION public.get_gestor_detalhamento(uuid, text, uuid[])` preservando `SECURITY DEFINER`, `search_path`, guards de role/IES e ACLs — só a chave nova em `metricas`.
- Arquivos front: `src/features/gestor/api/types.ts`, `src/features/gestor/components/EvolucaoRecorte.tsx`, `src/features/gestor/components/TabelaAlunosSimulado.tsx`, `src/features/gestor/routes/Detalhamento.tsx` (passar `metricas` para a tabela) e os testes correspondentes.
