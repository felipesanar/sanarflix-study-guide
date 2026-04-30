## Diagnóstico

O erro mostrado no toast vem direto do banco:

> `Access denied: requires admin, professor, b2b_partner or gestor role`

Isso é uma `RAISE EXCEPTION` disparada pelas RPCs institucionais quando o usuário não tem nenhuma das roles aceitas. Inspecionando as funções no banco (`get_institutional_simulados`, `get_institutional_performance`, `get_institutional_student_scores`, `get_institutional_evolution`, `get_institutional_question_details`), todas usam o mesmo gate:

```sql
IF NOT (
     has_role(v_user_id, 'admin')
  OR has_role(v_user_id, 'professor')
  OR has_role(v_user_id, 'b2b_partner')
  OR has_role(v_user_id, 'gestor')
) THEN
  RAISE EXCEPTION 'Access denied: ...';
END IF;
```

A role nova é `gestor_formal` (enum `app_role`) — ela **não** está nessa lista, então qualquer usuário com apenas `gestor_formal` cai no `RAISE` e nunca recebe os simulados/desempenho. O fix anterior no frontend (`isGestor` agora reconhece `gestor_formal`) deixou a rota visível, mas a primeira chamada à RPC já falha com o erro do print.

### Sutileza importante (memória do projeto)

A regra atual `Gestor formal excluído do desempenho institucional` diz que respostas de usuários `gestor_formal` **não entram nas agregações** — e isso continua valendo: as RPCs já filtram `NOT has_role(u.id, 'gestor_formal')` nos joins com `users`. O que essa regra **não** trata é se um usuário `gestor_formal` pode **abrir** a tela. O pedido atual é exatamente isso: dar acesso de leitura, mantendo a exclusão dele das próprias agregações. As duas coisas são compatíveis e independentes.

Pelo enunciado do usuário ("apenas admin e gestor_formal devem ter acesso"), o escopo é estritamente: incluir `gestor_formal` no whitelist das RPCs. Não vou remover `professor`, `b2b_partner` e `gestor` do whitelist no banco porque essas roles são usadas em outros fluxos institucionais (B2B partners, gestor antigo) e remoção mexeria em mais coisas que o pedido — a UI já restringe a navegação via `accessRules`.

## Mudanças

### 1. Migration aditiva — atualizar 5 RPCs institucionais

`supabase/migrations/<timestamp>_gestor_formal_can_read_institutional.sql`

Recriar via `CREATE OR REPLACE FUNCTION` cada uma das funções, mantendo o corpo idêntico exceto pelo gate de acesso, que passa a aceitar `gestor_formal`:

```sql
IF NOT (
     has_role(v_user_id, 'admin')
  OR has_role(v_user_id, 'professor')
  OR has_role(v_user_id, 'b2b_partner')
  OR has_role(v_user_id, 'gestor')
  OR has_role(v_user_id, 'gestor_formal')
) THEN
  RAISE EXCEPTION 'Access denied: ...';
END IF;
```

E também no bloco de resolução de IES, `gestor_formal` segue o mesmo caminho de `gestor`/aluno (recebe `id_ies` do próprio `users`, não pode escolher outra IES via `p_ies_id`):

```sql
IF p_ies_id IS NOT NULL
   AND (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'b2b_partner'))
THEN
  v_ies_id := p_ies_id;
ELSE
  SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
END IF;
```

(esse trecho já está assim — `gestor_formal` cai no `ELSE`, o que está correto e mantém a regra "gestores só veem a própria IES" reforçada anteriormente).

Funções a recriar:
- `get_institutional_simulados(p_ies_id uuid)`
- `get_institutional_performance(p_simulado_id uuid, p_ies_id uuid)`
- `get_institutional_student_scores(p_simulado_id uuid, p_ies_id uuid)`
- `get_institutional_evolution(p_ies_id uuid)`
- `get_institutional_question_details(...)`

Os filtros internos `NOT has_role(u.id, 'gestor_formal')` nos joins permanecem intactos — usuário gestor_formal continua oculto das agregações.

### 2. Atualizar memória

Editar `mem://constraints/gestor-formal-excluido-do-desempenho-institucional` adicionando uma seção esclarecendo:
- `gestor_formal` **pode abrir** o Desempenho Institucional (RPCs aceitam).
- `gestor_formal` **continua excluído** das agregações.
- Restrição "só vê a própria IES" também se aplica (cai no ramo ELSE de resolução de IES).

### 3. Sem mudanças de frontend

`src/utils/accessRules.ts` e `src/hooks/useInstitutionalPerformanceData.ts` já tratam `gestor_formal` corretamente (acesso à rota + filtro forçado para a própria IES).

## Validação manual

Após apply da migration, com um usuário FAI de role apenas `gestor_formal`:
1. Login → menu lateral mostra "Desempenho Institucional".
2. Abrir a página → toast de erro some, simulados da FAI são listados.
3. Selecionar um simulado → KPIs/charts carregam.
4. Filtro de IES no topo só lista FAI (regra existente).
5. Conferir no banco que respostas do próprio gestor_formal não aparecem nas agregações (regra existente preservada).
