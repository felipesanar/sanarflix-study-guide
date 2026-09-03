# Visão geral: usar o simulado mais recente COM nota TRI

## Problema confirmado

O simulado mais recente da IES no print (`Simulado ENAMED - SANARFLIX`, 07/09/2026) não tem nenhuma linha em `resultados_ies_tri` nem em `resultados_alunos_tri` (verificado: 0 e 0). Ainda assim ele entra na régua da Visão geral, porque a RPC `get_gestor_visao_geral` monta a lista de simulados "realizados" com o critério `n_resp > 0 OR n_tri > 0` — ou seja, basta ter respostas. Resultado: a coluna ATUAL fica com Conceito ENAMED e Alunos proficientes em `—`, e o Percentual de acerto (60%) passa a falar de um simulado sem TRI, enquanto PRIMEIRO/ANTERIOR falam de outros.

## Mudança

Alterar apenas a definição de `public.get_gestor_visao_geral(uuid, text)` no banco (DDL), sem tocar em `src/`:

- A lista de simulados considerados passa a exigir **nota TRI calculada no recorte** (`n_tri > 0`), em vez de `n_resp > 0 OR n_tri > 0`.
- Consequências (todas desejadas, porque tudo deriva da mesma lista):
  - Os pontos PRIMEIRO / ANTERIOR / ATUAL dos 4 KPIs passam a apontar sempre para simulados com TRI; o ATUAL é o mais recente com TRI.
  - Percentual de acerto, gráfico de evolução, evolução por área, diagnóstico e período do cabeçalho ficam coerentes com esse mesmo recorte.
  - Simulado sem TRI simplesmente não aparece na Visão geral — nada é inventado, nenhum dado é apagado.
  - Quando nenhum simulado da IES tem TRI, a tela cai nos estados vazios já existentes (KPIs em `—`, período "sem simulado com resultado").
- O KPI "Simulados realizados" (contrato) não muda: ele já exige TRI (`kpi_com_tri`).
- Nada muda em `Detalhamento`, `Visão de alunos`, cronograma ou nas demais RPCs.

## Detalhes técnicos

- Migration única, apenas `CREATE OR REPLACE FUNCTION public.get_gestor_visao_geral(p_ies_id uuid, p_semestre text)`, preservando corpo, assinatura, `STABLE SECURITY DEFINER`, `SET search_path`, guards de papel (`has_role` admin/gestor/gestor_grupo), `gestor_pode_acessar_ies` e ACLs atuais.
- Única alteração no corpo: a CTE `realizados` passa de `WHERE n_resp > 0 OR n_tri > 0` para `WHERE n_tri > 0`.
- `meta.partial` (que sinaliza "cobertura parcial") passa naturalmente a `false` na maioria dos casos, já que ele conta justamente os simulados sem TRI da lista.
- Verificação após aplicar: rodar `get_gestor_visao_geral` para a IES do print e conferir que o ATUAL é `UNIATENAS - 26/08/26`/equivalente com TRI, que Conceito e Proficientes deixam de vir `—`, e que `meta.periodo` reflete só simulados com TRI.
