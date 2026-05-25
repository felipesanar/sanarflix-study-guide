## Adicionar `gestor_grupo` às RPCs institucionais faltantes

### Diagnóstico
O erro "requires admin, professor, b2b_partner, gestor or gestor_formal role" vem da RPC `get_institutional_simulados`, que é chamada pelo `useInstitutionalPerformanceData.ts` para popular o seletor de simulados. Essa RPC (e mais 2) ainda não foi atualizada para aceitar `gestor_grupo`.

Auditoria das 10 RPCs institucionais (`get_institutional_*` + `get_ies_*`):

| RPC | Aceita gestor_grupo? | Ação |
|---|---|---|
| get_institutional_performance | ✅ | ok |
| get_institutional_evolution | ✅ | ok |
| get_institutional_student_scores | ✅ | ok |
| get_institutional_evolution_tri | ✅ | ok |
| get_institutional_longitudinal_tri | ✅ | ok |
| **get_institutional_simulados** | ❌ | corrigir |
| **get_institutional_question_details** | ❌ | corrigir |
| **get_institutional_tri** | ❌ | corrigir |
| get_ies_student_count | n/a (sem check) | ok |
| get_ies_features | n/a (sem check) | ok |

### Migração

Recriar as 3 RPCs faltantes seguindo exatamente o padrão já estabelecido em `get_institutional_performance` (migração `20260525150143`):

1. **Adicionar `OR has_role(v_user_id, 'gestor_grupo')`** no bloco de autorização inicial.
2. **Resolver IES via `user_can_access_ies(v_user_id, p_ies_id)`** para `gestor_grupo` — não restringir a `id_ies` do perfil (gestor de grupo acessa N IES via `get_accessible_ies`). Quando `p_ies_id` é informado, validar permissão; quando não, usar a primeira IES acessível como fallback.
3. Manter comportamento existente para `admin`, `b2b_partner`, `gestor`, `gestor_formal`, `professor`.

Mensagem de erro padronizada para `'Access denied'` (já é o padrão das RPCs corrigidas).

Migração puramente aditiva (somente `CREATE OR REPLACE FUNCTION`).

### Critérios de sucesso
- [ ] João Vitor (`gestor_grupo`) consegue ver lista de simulados da IES selecionada (PORTO SEGURO etc.) no Painel de Desempenho.
- [ ] Drill-down por questão (`get_institutional_question_details`) funciona ao selecionar tema.
- [ ] Cálculos TRI (`get_institutional_tri`) carregam para qualquer IES do grupo do usuário.
- [ ] Demais roles (gestor, gestor_formal, admin, b2b) seguem funcionando idênticos.

### Frontend
Nenhuma alteração. O hook já passa `p_ies_id` corretamente para gestor_grupo.