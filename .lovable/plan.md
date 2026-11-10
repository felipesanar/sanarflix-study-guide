# Excluir simulados sem respostas (Admin → Simulados → Provas)

## O que o admin vai ver
- Na janela de edição (lápis), um botão vermelho **"Excluir simulado"** no rodapé, só no modo edição.
- Ao abrir a janela, o sistema confere se o simulado tem respostas:
  - **Sem respostas:** botão ativo. Clicar abre uma confirmação em que o admin precisa digitar o nome do simulado. Depois disso o simulado some da lista.
  - **Com respostas:** botão desativado, com aviso: "Este simulado tem respostas de alunos (N alunos) e não pode ser excluído pelo painel. Fale com o time de desenvolvimento."
- A exclusão fica registrada no histórico de ações dos admins (nome, id, quem excluiu).

## O que conta como "tem respostas"
Qualquer registro do simulado em: respostas dos alunos, histórico de respostas, alunos que iniciaram ou finalizaram, resultados TRI de alunos ou da IES, ou se ele for "simulado pai" de outro. Se qualquer um existir, a exclusão é recusada — inclusive pelo banco, não só pela tela.

## O que é apagado junto
As questões do simulado, os cadernos e vínculos de previsão de contrato da IES (ies_simulado_previsto) daquele simulado. Nada de alunos é tocado.

## Detalhes técnicos
- Nova RPC `admin_delete_simulado(p_simulado_id uuid)` SECURITY DEFINER: exige `has_role(auth.uid(),'admin')`; trava `FOR UPDATE` na linha; verifica existência em answer_progress, answer_progress_historico, simulados_iniciados, simulados_finalizados, resultados_alunos_tri, resultados_ies_tri, simulados_admin.simulado_pai_id; se houver, `RAISE` com código `has_responses`. Caso contrário apaga ies_simulado_previsto (FK sem cascade) e depois simulados_admin (cascades cuidam de questões/cadernos/notificações); grava admin_audit_log. GRANT EXECUTE só para authenticated.
- Nova RPC leve `admin_simulado_delete_check(p_simulado_id)` retornando contagens para a tela.
- Exceção explícita à regra "migrações só aditivas": a migração só cria funções; a exclusão é ação do admin, sob as travas acima.
- Front: `deleteSimulado`/`checkSimuladoDeletable` em `src/services/admin/simulados.ts`; botão + diálogo de confirmação em `SimuladoConfigDialog.tsx`; ProvasTab recarrega a lista após excluir.
- Testes: diálogo mostra botão desativado com respostas e ativo sem; exige nome digitado para confirmar.
