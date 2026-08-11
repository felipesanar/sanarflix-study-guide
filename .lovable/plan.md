# Corrigir "Primeiro acesso detectado" recorrente

## O que está acontecendo (verificado)

O aviso vem da flag `must_change_password` nos metadados do usuário no Auth:

- `auth-login` calcula `needsPasswordChange = user_metadata.must_change_password === true` e o front mostra o toast "Primeiro acesso detectado" + o modal de troca de senha.
- A flag é **ligada** na criação/importação de usuários (`b2b-create-user`, `migrate_users`).
- A flag **nunca é desligada** quando o usuário troca a senha pelo modal: a edge function `update-password` só atualiza a senha e não limpa o metadado. Só o fluxo de link de e-mail (`src/pages/UpdatePassword.tsx`) limpa.

Resultado real no banco hoje: 4.811 usuários com a flag ligada, sendo 2.047 que já fizeram login pelo menos uma vez — ou seja, veem a mensagem de primeiro acesso em todo login.

## Correção

1. **Limpar a flag ao trocar a senha (raiz do bug)**
   - Em `supabase/functions/update-password/index.ts`: após atualizar a senha com sucesso, gravar `must_change_password: false` nos `user_metadata` (mesclando o metadado existente, sem sobrescrever `full_name`, `id_ies`, `semestre`).
   - Retornar erro apenas se a senha falhar; se a limpeza da flag falhar, registrar log e ainda assim responder sucesso (mas com nova tentativa no mesmo request).
2. **Garantir que o estado do app acompanhe**
   - Em `AuthContext.changePassword`, manter `setNeedsPasswordChange(false)` (já existe) e revalidar o payload de sessão para o metadado atualizado não voltar como `true` num refresh subsequente.
3. **Revisar os outros pontos que trocam senha**
   - Conferir/alinhar `src/pages/UpdatePassword.tsx` (já limpa) e qualquer fluxo de recuperação/admin que altere senha, para que todos usem a mesma limpeza da flag.
4. **Teste**
   - Teste unitário cobrindo: login com flag → modal; após troca de senha, novo login não dispara mais o toast de primeiro acesso.

## Higienização dos usuários já afetados

Com a correção acima, quem trocar a senha uma vez deixa de ver o aviso. Para os 2.047 usuários já logados que ainda estão marcados, proponho uma limpeza pontual **restrita** (migration aditiva de dados, sem DELETE): desligar `must_change_password` para usuários que já têm `last_sign_in_at` e cujo metadado foi atualizado depois do primeiro login (1.605 casos hoje) — indício de senha já definida.

Se preferir a opção mais conservadora, não fazemos backfill nenhum e o aviso se resolve na próxima troca de senha de cada pessoa. Diga qual das duas prefere; se não indicar, sigo com a limpeza restrita.

## Escopo técnico

- Arquivos: `supabase/functions/update-password/index.ts`, `src/contexts/AuthContext.tsx` (ajuste pontual), teste em `src/test/`.
- Banco: nenhuma mudança de schema; apenas o backfill opcional em `auth.users.raw_user_meta_data`.
- Nada de mudança visual nem em outras rotas.
