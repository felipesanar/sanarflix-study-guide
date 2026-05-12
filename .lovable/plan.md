## Problema

O card "Taxa de Adesão" usa como denominador `count(*) from users where id_ies = X`, que inclui admins, professores, gestores, atendimento e gestor_formal. No IES atual: 116 usuários totais, mas apenas 100 são alunos.

## Como identificar "aluno"

Não há role `aluno` no enum `app_role`. A convenção do projeto é: **aluno = usuário sem nenhuma linha em `user_roles`** (ou seja, sem nenhum papel administrativo/staff atribuído). Confirmado via consulta: na IES `2c458bcb-…` há 100 usuários sem entrada em `user_roles`, batendo com o número esperado pelo usuário ("100 alunos dos 116").

## Mudanças

### 1. Migration — nova RPC `get_ies_student_count`

```sql
create or replace function public.get_ies_student_count(p_ies_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.users u
  where u.id_ies = p_ies_id
    and not exists (
      select 1 from public.user_roles ur where ur.user_id = u.id
    );
$$;

grant execute on function public.get_ies_student_count(uuid) to authenticated;
```

Aditiva, sem alterar dados existentes.

### 2. `src/hooks/useInstitutionalPerformanceData.ts`

Substituir a chamada atual:
```ts
supabase.from('users').select('id', { count: 'exact', head: true }).eq('id_ies', targetIesId)
```
por:
```ts
supabase.rpc('get_ies_student_count', { p_ies_id: targetIesId })
```
e ler o valor diretamente em `totalIesUsers` (em vez de `iesUsersResult.count`).

### 3. Sem outras mudanças

- O numerador (alunos que realizaram o simulado) já vem de `score_total`/`students` da RPC de performance e não inclui staff (o cálculo de proficiência/TRI já é feito sobre quem efetivamente respondeu o simulado).
- Labels e KPIs permanecem iguais — apenas o denominador muda, então "100 dos 116" passará a exibir, ex.: "100 dos 100" (100%) na IES de teste.

## Resultado esperado

Card "Taxa de Adesão" passa a mostrar "X alunos dos Y realizaram o simulado", onde Y é a contagem de alunos reais (sem staff) da IES.