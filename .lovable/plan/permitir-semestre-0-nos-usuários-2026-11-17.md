# Permitir semestre 0 nos usuários

Semestre 0 identifica quem não é aluno: professores, gestores e o time interno. A faixa aceita passa a ser **0 a 12**, e as mensagens de erro passam a dizer "entre 0 e 12".

## Onde está a trava hoje (confirmado no código)
1. **Admin → Usuários → editar usuário:** o campo só aceita de 1 a 12 e mostra o erro "Semestre deve ser um número entre 1 e 12".
2. **Admin → Usuários → criar usuário:** a mesma trava, com o erro "Semestre deve ser entre 1 e 12".
3. **Servidor de criação/edição de usuários (b2b-create-user):** também recusa valores menores que 1. Liberar só a tela não bastaria, porque o servidor recusaria o 0 ao salvar.
4. **Validação do usuário salvo no navegador (validation.ts):** também exige no mínimo 1. Uma conta com semestre 0 seria tratada como inválida ao recarregar a página.

## Mudanças
- Nos itens 1 a 4, o mínimo passa de 1 para 0 e o máximo continua 12.
- Na lista de usuários, o 0 aparece como "0" e não fica apagado como se estivesse vazio.
- O cadastro público de alunos (b2c-signup) continua exigindo de 1 a 12, porque só alunos se cadastram por ali.

## O que não muda (comportamento atual com semestre 0)
- Telas do aluno que dependem do semestre (Seu Guia, progresso): com 0 elas se comportam como hoje sem semestre definido, ou seja, ficam sem conteúdo do semestre. Para professores e gestores isso é o esperado.
- O banco não muda, porque a coluna já aceita qualquer número inteiro.

## Testes
- Atualizar `src/test/unit/validation.test.ts`: o 0 passa a ser aceito, e -1 e 13 continuam recusados.

## Detalhes técnicos
- `UsersListTable.tsx`: na validação, `semestre < 0`; no campo, `min={0}`; e `muted={user.semestre == null}`.
- `CreateUserDialog.tsx`: na validação, `sem < 0`, e o campo de semestre com `min={0}`, se for o caso.
- `supabase/functions/b2b-create-user/index.ts`: `.min(0, 'Semestre mínimo: 0')`. O código já usa `semestre ?? null` e `!== null`, então o 0 não se perde ao salvar.
- `src/utils/validation.ts`: os dois schemas com `.min(0)`.
