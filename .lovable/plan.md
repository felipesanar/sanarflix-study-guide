# Corrigir exportação XLSX da base completa (Admin → Usuários)

## O que está acontecendo

A base tem 7.867 usuários e apenas 430 registros de papéis (confirmado por consulta ao banco). Sem nenhum filtro, o export percorre a base em blocos de 1.000 e, para cada bloco, consulta os papéis passando os 1.000 IDs de usuário na URL da requisição. Isso gera uma URL de dezenas de milhares de caracteres, que é rejeitada — por isso o toast "Não foi possível exportar os usuários." aparece só no recorte sem filtro (com filtros, os blocos são pequenos e a URL cabe).

Observação: a causa exata do erro ainda não está confirmada pela mensagem do servidor, porque o toast atual descarta o motivo. O plano corrige a origem provável e, ao mesmo tempo, passa a mostrar/registrar o motivo real caso ainda falhe.

## O que será feito

- Buscar os papéis uma única vez, antes do loop (a tabela inteira tem 430 linhas), em vez de uma consulta por bloco com 1.000 IDs. Isso elimina a URL gigante e deixa o export mais rápido.
- Quando o filtro de papel estiver ativo, reaproveitar os IDs já resolvidos, sem nova ida ao banco.
- Reduzir o bloco de leitura de usuários para um tamanho seguro (500) e manter a paginação até esgotar o recorte, garantindo que a base completa saia inteira.
- Melhorar a mensagem de erro: o toast passa a incluir o motivo retornado pelo servidor (e o erro completo continua no log), para que qualquer falha futura seja diagnosticável em um clique.
- Mostrar progresso durante a exportação (ex.: "Exportando… 3.000 de 7.867"), já que o arquivo completo leva alguns segundos.

Nada muda nas colunas nem no comportamento dos filtros: o arquivo continua com `user_id`, `nome_ies`, `nome_usuario`, `email`, `semestre`, `matricula_ra`, `role`, respeitando o recorte ativo.

## Detalhes técnicos

- Arquivo alterado: `src/components/admin/UsersListTable.tsx` (apenas `handleExportXlsx` e o estado de exportação). Sem migration, sem mudança em Edge Functions.
- `resolveRoleFilterIds` e `applyListFilters` permanecem como estão, para lista e export não divergirem.
- Mapa de papéis montado a partir de um único `select user_id, role from user_roles` (com paginação defensiva em blocos de 1.000 caso a tabela cresça), consultado em memória por usuário.
