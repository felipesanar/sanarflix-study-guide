## Diagnóstico

Usuário: `aline.assessoria@uniatenas.edu.br` (id `300c810f-2f72-45d4-a7fd-d34f2ceaec5b`, IES principal: PARACATU).

Roles atuais em `user_roles`: **`gestor`** + **`gestor_grupo`** (duplicidade — esse é o problema).

Estado correto do vínculo de grupo (já configurado, não mexer):
- `user_groups`: vinculada ao grupo `UNIATENAS` (id `6d76…2cd0`) com `role = gestor_grupo`.
- `group_ies`: 6 IES vinculadas ao grupo UNIATENAS.
- `get_accessible_ies('300c…ec5b')` já retorna as 6 IES esperadas.

### Por que a role duplicada quebra o comportamento

Vários trechos do código e das RLS tratam `gestor` (single‑IES, legado) e `gestor_grupo` (multi‑IES) como caminhos distintos. Quando ambas existem ao mesmo tempo:

1. **RLS de `resultados_ies_tri` / `resultados_alunos_tri` / `simulados_admin` / `answer_progress`**: a política de `gestor` (`college_id = get_current_user_ies_id()`) e a de `gestor_grupo` (`college_id = ANY (get_accessible_ies(...))`) são ambas avaliadas. Isso por si só não bloqueia leitura, mas garante o caminho "single‑IES" continua ativo em qualquer consulta direta que filtre por `get_current_user_ies_id()`.
2. **`src/utils/accessRules.ts` → `getAccessRules`**: `isGestor(user)` retorna `true` para qualquer variante (`gestor` / `gestor_formal` / `gestor_grupo`). O ramo de gestor é executado primeiro e devolve `{...DEFAULT_RULES, desempenhoInstitucional: true}`. Como `DEFAULT_RULES.simulados = true` e nenhum ramo específico de `gestor_grupo` existe, isso já era o comportamento desejado — porém qualquer feature futura que diferencie via `isGestorFormal`/`isGestor` (sem `isGestorGrupo`) trata Aline como gestor formal de PARACATU.
3. **Hooks que ramificam por role**: `useInstitutionalPerformanceData` usa `isGestorGrupo` corretamente, mas a presença simultânea da role `gestor` faz com que partes server‑side (RPCs `get_institutional_*` e filtros derivados de `get_current_user_ies_id()`) considerem o usuário ligado a PARACATU, podendo recortar visões para uma única IES em vez das 6 do grupo.

Conclusão: a role `gestor` é resíduo do cadastro antigo e precisa ser removida para que toda a stack (frontend + RLS + RPCs) trate Aline exclusivamente como `gestor_grupo`.

## Mudança proposta

Apenas dados — **nenhuma alteração de código**.

Executar via tool `supabase--migration` (DELETE em `user_roles` exige migration; não é coberto pelo insert tool):

```sql
DELETE FROM public.user_roles
WHERE user_id = '300c810f-2f72-45d4-a7fd-d34f2ceaec5b'
  AND role = 'gestor';
```

Não mexer em:
- `user_groups` (vínculo correto com UNIATENAS já existe).
- `group_ies` (6 IES já corretas).
- `users.id_ies` (manter PARACATU como IES principal — é usada como fallback em `useInstitutionalPerformanceData` quando `filters.iesId` está vazio e está dentro do grupo, então não atrapalha).

## Verificação pós‑mudança

1. `SELECT role FROM user_roles WHERE user_id = '300c…ec5b'` deve retornar apenas `gestor_grupo`.
2. `SELECT get_accessible_ies('300c…ec5b')` deve continuar retornando as 6 IES do grupo UNIATENAS.
3. Pedir à Aline para deslogar/logar (o `AuthContext` recarrega `roles` e `accessible_ies` no login) e acessar `/desempenho-institucional-v2` — o seletor de IES deve listar as 6 instituições do grupo UNIATENAS.

## Prevenção (fora do escopo desta correção, anotar para depois)

O fluxo de criação de usuário em `src/components/admin/UsersTab.tsx` deveria garantir mutuamente exclusivas as variantes `gestor` / `gestor_formal` / `gestor_grupo` (escolher uma, remover as outras) para evitar recorrência. Pode virar uma tarefa futura.
