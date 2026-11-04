# Migração pendente de decisão

`mentor_portal_v2_lacunas.sql` NÃO foi aplicada. Ela recria funções existentes do portal do mentor
(`get_mentor_contexto`, `mentor_turma`, `mentor_sessoes_listar`, `mentor_convites_listar`) e troca a assinatura de
`mentor_intervencao_criar` (DROP + CREATE com parâmetros opcionais `p_perfil`, `p_origem`, `p_origem_ref`).

Em 04/11 o Felipe autorizou só mudanças aditivas em produção e pediu para levar a ele qualquer migração que altere
objeto existente. O front funciona sem ela: a fonte Academy lê foto e link da agenda direto de `mentores` e grava o
perfil do card B2B por `registrar_evento_mentor`.

Se aprovada: mover de volta para `supabase/migrations/`, renomear o teste para `.test.ts` em `src/test/unit/`,
aplicar pelo roteiro (functiondef, BEGIN/ROLLBACK, advisors) e renomear para a versão gravada.
