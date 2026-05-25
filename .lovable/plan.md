## Revisão: `gestor_grupo` deve seguir o mesmo padrão dos outros gestores

### Contexto
Na iteração anterior, forçamos `semestre = NULL` para usuários com role `gestor_grupo`, com a justificativa de que "gestor não é aluno". Você confirmou que esse não é o comportamento correto: **todos os gestores existentes na plataforma (`gestor`, `gestor_formal`, `professor`, `atendimento`) possuem `semestre` preenchido e estão vinculados a uma IES específica**. O `gestor_grupo` deve seguir exatamente o mesmo padrão — apenas com a diferença de que ele tem acesso a **múltiplas IES** via tabelas `educational_groups` / `group_ies` / `user_groups`.

O `semestre` no perfil do gestor é apenas um valor âncora (não define seu nível de acesso); o que governa permissão é o `user_roles` + `get_accessible_ies(user_id)`.

### Mudanças

**1. `supabase/functions/b2b-create-user/index.ts`**

Remover a normalização `semestre → null` para `gestor_grupo`. Voltar a usar o `semestre` enviado pelo admin no formulário, igual aos demais roles:

```ts
// REMOVER:
const semestre = role === 'gestor_grupo' ? null : rawSemestre;

// VOLTAR PARA:
const semestre = rawSemestre;
```

Os blocos de `update` e `insert` (`semestre: semestre ?? null`) permanecem como estão — eles já lidam corretamente com semestre opcional.

**2. Migração de dados — usuário João Vitor (`48436225-55a2-494b-8d69-645cf9fcef39`)**

Nenhuma ação necessária. O usuário já está com `semestre = 1` (PASSOS) e `id_ies` correto. Isso agora é considerado o estado correto. A migração proposta anteriormente para zerar o `semestre` **não será executada**.

**3. Investigação pendente do problema original**

Continua valendo o ajuste no `AuthContext.tsx` (bypass do throttle de 30s quando `roles` em cache está vazio) — esse fix é ortogonal ao tema do `semestre` e ajuda usuários recém-promovidos a ver as roles sem esperar/relogar.

A causa raiz de "Desempenho Institucional" não aparecer para o João Vitor provavelmente é:
- (a) cache stale de `roles` no `localStorage` (resolvido pelo fix do AuthContext), ou
- (b) o usuário não está em `user_groups` / o grupo dele não está em `group_ies` — a função `get_accessible_ies(user_id)` retorna array vazio e as RLS de `gestor_grupo` bloqueiam tudo.

Após esta revisão, vou validar (b) via consulta de leitura no banco antes de qualquer outra mudança.

### Critérios de sucesso
- [ ] `b2b-create-user` grava `semestre` informado pelo admin para qualquer role, incluindo `gestor_grupo`.
- [ ] João Vitor permanece com `semestre = 1` / `id_ies = PASSOS`.
- [ ] Próximo passo: diagnosticar via SQL se ele está corretamente vinculado a um `educational_group` que possui IES em `group_ies`.