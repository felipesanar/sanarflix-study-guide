## Problema

Para o gestor, todos os simulados aparecem como "Encerrado" com apenas o botão "Ver Desempenho" (que ele nunca poderá usar, pois nunca fez os simulados). Faltam:

1. Permitir que o gestor inicie/continue/veja questões dos simulados, mesmo encerrados.
2. Liberar a aba **Desempenho** para que, ao finalizar, ele veja seu próprio desempenho como aluno.

## Causa raiz

- Em `src/components/simulados/SimuladosDisponiveis.tsx`, o código força `status = 'encerrado'` sempre que `data_encerramento` passou, independentemente do papel. Isso faz o `SimuladoCard` renderizar só o botão "Ver Desempenho" / "Encerrado".
- Em `src/utils/accessRules.ts`, o bloco do `isGestor` não habilita `SimuladoDesempenho`, então a aba "Desempenho" não aparece em `src/pages/Simulados.tsx` (que checa `accessRules.SimuladoDesempenho`).

## Alterações

### 1. `src/utils/accessRules.ts`
No bloco `if (isGestor(user))`, adicionar `SimuladoDesempenho: true` junto com `desempenhoInstitucional: true` e `simulados: true`. Assim, a aba "Desempenho" passa a aparecer em `/simulados` para gestores.

### 2. `src/components/simulados/SimuladosDisponiveis.tsx`
No `carregarSimulados`, tratar o gestor como aluno "privilegiado":

- Importar `isGestor` (já importado) e calcular `const tratarComoAluno = isGestor(user);`
- No `map` que monta `simuladosComStatus`: quando `tratarComoAluno` for `true`, **ignorar o override de `encerrado` por `data_encerramento`** e manter o fluxo normal de estados (`disponivel` / `em_andamento` / `concluido`). Ou seja, o gestor verá:
  - "Iniciar Simulado" se nunca iniciou,
  - "Continuar" se há estado em `localStorage`,
  - "Concluído" + "Ver Desempenho" depois que ele mesmo finalizar.
- Para alunos comuns, comportamento permanece idêntico (encerrado vira badge "Encerrado" sem ação).

Nada muda em `SimuladoCard.tsx`, na execução da prova (`/simulados/:id/prova`), na correção (edge function `corrigir-simulado`) ou em `SimuladoDesempenho.tsx` — eles já operam com base no `user.id`, então o gestor verá apenas o desempenho dos simulados que ele mesmo fizer.

## Fora de escopo

- RLS de `simulados_admin` / `questoes_simulado` para gestor já foi adicionada na migração anterior.
- Inserções em `simulados_iniciados`, `answer_progress` e `simulados_finalizados` já são permitidas a qualquer usuário autenticado para `user_id = auth.uid()`.
- Nenhuma mudança em Desempenho Institucional, ranking ou agregações.

## Arquivos a editar

- `src/utils/accessRules.ts`
- `src/components/simulados/SimuladosDisponiveis.tsx`
