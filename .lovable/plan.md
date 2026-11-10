# Nova regra de exclusão de simulados

## Regra
- **0 respondentes**: exclusão direta (como hoje), confirmando pelo nome.
- **1 a 5 respondentes distintos**: o botão "Excluir simulado" fica ativo, mas a confirmação mostra a lista de quem respondeu (nome, e-mail, IES, papel — ex.: admin, aluno — e data em que respondeu). O admin revisa, digita o nome do simulado e confirma. As respostas dessas pessoas para esse simulado são apagadas junto.
- **Mais de 5 respondentes distintos**: botão desativado, aviso "Contate um dev" com a quantidade.

"Respondente" = qualquer usuário distinto com registro em respostas, histórico de respostas, simulado iniciado, simulado finalizado ou resultado TRI do aluno. Os papéis não são filtrados: todo mundo conta.

## Proteções que continuam
- Resultado TRI por IES ou simulado filho (simulado_pai_id) continua bloqueando a exclusão (é preciso contatar um dev).
- O banco confere tudo de novo na hora de excluir (o limite de 5, a trava da linha e os mesmos respondentes que o admin viu). Se mudou, a exclusão é recusada e a lista é atualizada.
- O registro de auditoria passa a guardar a lista de respondentes e a quantidade de linhas apagadas por tabela.
- Os dados dos alunos fora desse simulado não são alterados.

## Detalhes técnicos
- Migration aditiva com `CREATE OR REPLACE`:
  - `admin_simulado_delete_check(uuid)` passa a retornar `respondentes_distintos`, `respondentes jsonb` (até 5: user_id, nome, email, ies, roles, ultima_atividade) e `modo` ('direto' | 'revisao' | 'bloqueado'), além de `deletable`.
  - `admin_delete_simulado(uuid, p_respondentes_confirmados uuid[] default null)`: faz `FOR UPDATE`, recalcula o conjunto e exige que seja igual ao confirmado quando houver mais de 0 respondentes. Apaga, filtrando por simulado, as linhas de answer_progress, answer_progress_historico, simulados_iniciados, simulados_finalizados, resultados_alunos_tri e simulado_aluno_caderno, depois ies_simulado_previsto e simulados_admin, e grava em admin_audit_log. Continua SECURITY DEFINER com has_role admin.
  - Esta exclusão pontual de linhas de respostas é uma exceção, aprovada por você, à regra de "migrations só aditivas": é uma ação do admin com trava, não uma limpeza em massa.
- Front: `services/admin/simulados.ts` (novos campos e parâmetro), `ExcluirSimuladoButton.tsx` (3 estados e tabela de respondentes no diálogo).
- Testes: atualizar `ExcluirSimuladoButton.test.tsx` com os casos 0, 3 (lista visível e envio dos IDs) e 6 (bloqueado).
