# Exportar usuários em XLSX (Admin → Usuários)

## O que será feito

Adicionar um botão "Exportar XLSX" na barra de filtros da tabela de usuários (ao lado do botão de atualizar). Ao clicar, o admin baixa uma planilha com todos os usuários que atendem aos filtros ativos no momento — busca por nome/email, IES, semestre e papel — e não apenas os 25 da página visível.

Colunas do arquivo, nesta ordem:

```text
user_id | nome_ies | nome_usuario | email | semestre | matricula_ra | role
```

Regras de conteúdo:
- `nome_ies`: nome da IES vinculada; vazio quando o usuário não tem IES.
- `semestre` / `matricula_ra`: vazios quando nulos no banco.
- `role`: papéis privilegiados do usuário separados por vírgula; quando não há nenhum, exporta `aluno` (mesma leitura usada no filtro da tabela).

Comportamento do botão:
- Visível apenas para quem já pode ver a lista; disponível para Admin (e Atendimento, que também usa esta página) — sem novas permissões.
- Enquanto exporta, o botão mostra estado de carregamento; ao final, toast de sucesso com a contagem de linhas, ou toast de erro se algo falhar.
- Nome do arquivo com data e recorte, ex.: `usuarios-2026-09-01.xlsx`.

## Detalhes técnicos

- Arquivo alterado: `src/components/admin/UsersListTable.tsx` (frontend apenas). Sem migration, sem mudança em Edge Functions.
- A exportação reaproveita a mesma montagem de query já usada em `fetchUsers` (filtros de `id_ies`, `semestre`, papel via `user_roles` e o `.or()` de nome/email), extraída para um helper local para evitar divergência entre lista e export.
- Paginação server-side em blocos de 1000 linhas (`.range`) até esgotar o total, para não estourar limites do PostgREST em recortes grandes; papéis buscados em lotes por `user_id`.
- Geração do arquivo com a dependência `xlsx` já presente no projeto (mesmo padrão de `institutionalReportXlsx.ts` e `BulkCreateUsersDialog.tsx`), com larguras de coluna definidas e todos os campos como texto/número simples.
