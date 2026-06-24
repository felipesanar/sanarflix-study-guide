## Problema

Os RPCs `get_institutional_performance` e `get_institutional_student_scores` estão retornando 400. A causa é o erro de SQL:

```
column ap.updated_at does not exist
```

A migration anterior (do mecanismo `simulado_pai_id`) usou `ap.updated_at` no CTE `ultima_fallback` para escolher a tentativa mais recente do aluno, mas a tabela `answer_progress` **não possui** coluna de timestamp algum (suas colunas são: `answer_id`, `correct`, `question_id`, `resposta_usuario`, `simulado`, `respondida?`, `user_id`).

Resultado: nenhuma tela do **Desempenho Institucional** carrega ("completamente errado e apresentando problemas") porque essas duas RPCs alimentam KPIs, faixas, listas de alunos, etc.

## Correção (1 migration, SQL apenas)

Substituir a ordenação por `ap.updated_at` no CTE `ultima_fallback` (presente nas duas funções) por uma referência válida — ordenar pela `created_at` do simulado em `simulados_admin`, do mais recente para o mais antigo. Assim, quando o aluno tem respostas em mais de um simulado do grupo (pai + repescagens) mas não tem nenhum registro em `simulados_finalizados`, escolhemos a tentativa associada ao simulado **criado mais recentemente** (proxy razoável; o caminho principal continua usando `simulados_finalizados.finalizado_em`).

Mudança exata em ambas as funções (`get_institutional_performance` e `get_institutional_student_scores`):

```sql
ultima_fallback AS (
  SELECT DISTINCT ON (ap.user_id)
         ap.user_id, ap.simulado AS simulado_id
  FROM answer_progress ap
  JOIN simulados_admin sa_ord ON sa_ord.id = ap.simulado
  WHERE ap.simulado IN (SELECT simulado_id FROM grupo)
    AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id)
  ORDER BY ap.user_id, sa_ord.created_at DESC NULLS LAST
)
```

Nada mais muda: assinatura, permissões, joins, agregações, grants e o restante das 5 funções da migration anterior continuam idênticos.

## Validação

- Re-executar `get_institutional_performance('7ac2a46b-…','9f21b138-…')` deve retornar JSON válido.
- Painel de Desempenho da IES FAI deve voltar a renderizar KPIs, faixas, evolução e lista de alunos sem 400.
- Logs do Postgres não devem mais conter "column ap.updated_at does not exist".

## Fora de escopo

- Não tocar em frontend, mocks, `/simulados`, `SimuladoDesempenho`, ranking, Caderno de Erros, Analytics.
- Não alterar a lógica de pai/filho — só o critério de desempate do fallback.
