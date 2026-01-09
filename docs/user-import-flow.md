# Fluxo de Importação de Usuários

Este documento descreve o processo correto de importação de usuários para a plataforma SanarFlix Academy.

## ⚠️ Problema Crítico: Mismatch auth.users x public.users

Quando usuários são importados diretamente na tabela `public.users` (via CSV, SQL direto, ou scripts), 
eles **NÃO** são automaticamente criados em `auth.users` (Supabase Authentication).

Isso causa:
- Erro 401 "Invalid login credentials" ao tentar logar
- Usuário existe no banco mas não consegue autenticar

## Fluxos de Importação

### 1. Importação Correta (Recomendado)

Usar a Edge Function `b2b-create-user` que:
1. Cria usuário em `auth.users` com senha temporária
2. Cria registro em `public.users` com IES e semestre
3. Garante que os IDs são consistentes

```typescript
// Exemplo de uso
const { data } = await supabase.functions.invoke('b2b-create-user', {
  body: {
    email: 'aluno@faculdade.edu.br',
    nome: 'Nome do Aluno',
    id_ies: 'uuid-da-ies',
    semestre: 6,
    password: 'senhaTemporaria123'
  }
});
```

### 2. Importação em Massa (CSV)

Para importação em massa, usar o script em `supabase/functions/create-test-user/`:

1. Preparar CSV com colunas: email, nome, semestre, id_ies
2. Executar o script que usa `supabase.auth.admin.createUser()`
3. Verificar logs para identificar falhas

### 3. Correção de Usuários Existentes (Sync)

Para usuários já importados incorretamente, usar a Edge Function `sync-user-auth`:

**Via Admin Portal:**
1. Acessar Portal do Admin > Usuários
2. Usar card "Sincronizar Autenticação"
3. Inserir email do usuário com problema
4. Clicar em "Sincronizar"
5. Enviar senha temporária gerada ao usuário

**Via API:**
```typescript
const { data } = await supabase.functions.invoke('sync-user-auth', {
  body: { email: 'usuario@problema.com' }
});
// Retorna: { success: true, temporaryPassword: 'abc123', message: '...' }
```

## Estrutura de Dados

### public.users
```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY,           -- DEVE corresponder a auth.users.id
  email TEXT NOT NULL,
  nome TEXT NOT NULL,
  id_ies UUID REFERENCES ies(id),
  semestre INTEGER
);
```

### auth.users (Supabase managed)
```sql
-- Gerenciado pelo Supabase Auth
-- NÃO inserir diretamente via SQL
-- Usar apenas supabase.auth.admin.createUser()
```

## Checklist de Importação

- [ ] Usuários criados via `auth.admin.createUser()` ou Edge Function
- [ ] IDs em `public.users` correspondem a `auth.users`
- [ ] Email normalizado (lowercase, sem espaços)
- [ ] IES válida existente na tabela `ies`
- [ ] Semestre válido (1-12)
- [ ] Senha temporária gerada e comunicada ao usuário

## Debugging

Se um usuário reportar que não consegue logar:

1. Verificar se existe em `public.users`:
   ```sql
   SELECT * FROM public.users WHERE email = 'usuario@email.com';
   ```

2. Verificar se existe em `auth.users` (via Dashboard > Authentication > Users)

3. Se existir em `public.users` mas não em `auth.users`:
   - Usar `sync-user-auth` para sincronizar
   - Ou criar manualmente via Dashboard

4. Se existir em ambos mas com IDs diferentes:
   - `sync-user-auth` corrige isso automaticamente
   - Atualiza o ID em `public.users` para corresponder

## Logs e Monitoramento

- Edge Function logs: Supabase Dashboard > Edge Functions > [função] > Logs
- Auth logs: Supabase Dashboard > Logs > Auth
- Postgres logs: Supabase Dashboard > Logs > Postgres
