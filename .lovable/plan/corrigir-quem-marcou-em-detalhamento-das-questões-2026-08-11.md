# Corrigir "quem marcou" em Detalhamento das questões

## Diagnóstico (confirmado)

A funcionalidade existe ponta a ponta, menos um elo: **a RPC `get_gestor_questoes` não devolve o `id` da questão**.

- Conferido no banco: o corpo de `get_gestor_questoes` monta cada questão sem nenhuma chave `id`/`questaoId` (a coluna `q.id` é usada só nos JOINs internos).
- Por isso `Questao.id` chega `undefined`, `TabelaQuestoes` passa `questionId={undefined}` para `DistribuicaoAlternativas`, e a linha mostra "Lista de alunos indisponível para esta questão" em vez de chamar a RPC.
- A RPC de destino já existe e funciona: `get_gestor_questao_respondentes(p_ies_id, p_question_id, p_alternativa)` devolve `{ data: [{ alunoId, nome }], meta }`, com os mesmos guards de role e de IES das demais RPCs do gestor.

## O que vai ser feito

1. **Banco (migration aditiva)**: acrescentar a chave `id` (o `questoes_simulado.id`) ao objeto de cada questão em `get_gestor_questoes`. Nada mais muda — mesma assinatura, mesmos guards, mesmo restante do payload.

2. **Lista em formato de tabela**: no painel "Quem marcou X" da distribuição por alternativa, trocar a lista simples por uma tabela enxuta (mesmos componentes de tabela do portal), com o nome do aluno e a contagem no cabeçalho ("12 alunos"). Mantém os estados de carregando / erro / vazio já existentes, sem afirmar "nenhum aluno" antes da resposta.

3. **Clique no nome abre o drawer do aluno**: o nome vira botão e abre o mesmo `DrawerAluno` usado em "Visão de alunos", com o recorte de simulados selecionado no filtro. O drawer é montado uma única vez em `TabelaQuestoes` (padrão já usado por `TabelaAlunos`), e a distribuição só avisa qual aluno foi clicado.

## Detalhes técnicos

- Migration: `CREATE OR REPLACE FUNCTION public.get_gestor_questoes(...)` com o texto atual + `'id', q.id` no `jsonb_build_object` da questão; ACLs preservadas (`REVOKE` de `PUBLIC`/`anon`, `GRANT EXECUTE` para `authenticated` e `service_role`).
- `src/features/gestor/api/types.ts`: `Questao.id` deixa de ser opcional e o comentário que explicava a ausência é atualizado.
- `src/features/gestor/charts/DistribuicaoAlternativas.tsx`: `RespondentesAlternativa` passa a renderizar tabela e recebe `onAbrirAluno(alunoId, nome)`, repassado por `DistribuicaoAlternativasProps`.
- `src/features/gestor/components/TabelaQuestoes.tsx`: estado `alunoSelecionado`, render do `DrawerAluno` com `simulados` vindos de `useFiltrosGestor`.
- Testes: ajustar/estender `__tests__/TabelaQuestoes.test.tsx` para cobrir a tabela de respondentes e a abertura do drawer.

## Observação

A RPC de respondentes escopa por IES, mas não aplica o filtro de semestre do recorte — se um semestre estiver selecionado, a lista ainda traz todos os alunos da IES que marcaram a alternativa. Posso incluir esse filtro na mesma migration se você quiser; fora disso, fica como está.
