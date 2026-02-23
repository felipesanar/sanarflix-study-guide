
Objetivo
- Corrigir definitivamente o domínio dos links de convite/reset para que sempre usem `https://academy.sanar.com.br` (e nunca `https://guiadeestudos.sanar.com.br`), identificando exatamente onde o parâmetro é criado e repassado.

Diagnóstico confirmado (onde o link é definido e passado)
1. Geração do link
- `supabase/functions/b2b-create-user/index.ts`
  - `generateLink({ type: 'recovery', options: { redirectTo: 'https://academy.sanar.com.br/auth/update-password' } })`
  - lê `linkData.properties.action_link`
- `supabase/functions/sync-user-auth/index.ts`
  - mesmo padrão (`generateLink` + `action_link`)
- `supabase/functions/b2c-signup/index.ts`
  - também usa `generateLink` + `action_link`

2. Passagem do link para e-mail
- Nos 3 fluxos acima, o valor vai para:
  - `payload.confirmationUrl` em `triggerNovuEvent(...)`
  - evento `welcome-academy-email` no Novu
- Ou seja: o link que o usuário recebe no botão e no “link direto” vem de `confirmationUrl` enviado por essas Edge Functions.

3. Motivo de continuar errado mesmo com replace simples
- A normalização atual troca hostname apenas em casos específicos, mas o problema pode vir de formatos diferentes do `action_link` retornado pelo Supabase.
- Além disso, o fluxo está dependente de `action_link` pronto (que pode refletir configuração de Auth legada), em vez de construir URL canônica de forma determinística.
- `b2c-signup` ainda não normaliza `action_link`, criando inconsistência entre fluxos.

Plano de correção (implementação)
1) Tornar a geração do link canônica e determinística
- Criar helper compartilhado (ex.: `supabase/functions/_shared/auth-links.ts`) para:
  - receber `linkData.properties` do `generateLink`
  - priorizar construção de URL via `token_hash/hashed_token`:
    - formato: `${SUPABASE_URL}/auth/v1/verify?token=<token_hash>&type=recovery&redirect_to=<academy_url_encoded>`
  - fallback para `action_link` somente se token_hash não vier
  - normalizar:
    - hostname legado no topo da URL
    - `redirect_to` dentro da querystring (inclusive URL-encoded)
    - origem final sempre `https://academy.sanar.com.br`
- Resultado: independente de como o Supabase devolver `action_link`, o `confirmationUrl` final enviado ao Novu ficará correto.

2) Aplicar helper nos 3 fluxos que enviam `welcome-academy-email`
- `supabase/functions/b2b-create-user/index.ts`
- `supabase/functions/sync-user-auth/index.ts`
- `supabase/functions/b2c-signup/index.ts`
- Remover duplicação de `normalizeActionLink` local e usar helper único para evitar regressão.

3) Hardening da normalização
- Aceitar variações de domínio legado:
  - `guiadeestudos.sanar.com.br`
  - com/sem `www`
  - com protocolo diferente
- Forçar path de destino por fluxo:
  - convite/primeiro acesso: `/auth/update-password`
  - reset de senha: `/reset-password` (onde aplicável)

4) Observabilidade para depuração rápida
- Logar (sem expor tokens):
  - origem do link (`action_link` vs `token_hash`)
  - hostname final de `confirmationUrl`
  - redirect_to final
- Isso permite provar em produção que o link enviado está canônico.

5) Verificação de configuração no Supabase Auth (complementar e necessária)
- Validar no Dashboard:
  - Site URL: `https://academy.sanar.com.br`
  - Redirect URLs: incluir `https://academy.sanar.com.br/**`
  - remover legado `guiadeestudos.sanar.com.br` das allowlists (se existir)
- Mesmo com código robusto, configuração legada pode reintroduzir comportamento inesperado em outros fluxos nativos.

Validação (E2E)
1. Reenviar convite por `b2b-create-user` (resend_email=true)
- Confirmar no e-mail:
  - botão abre fluxo em `academy.sanar.com.br`
  - “link direto” também resolve para `academy.sanar.com.br`
2. Testar `sync-user-auth` com usuário novo
- mesmo comportamento esperado
3. Testar `b2c-signup`
- validar consistência entre todos os cadastros
4. Testar fluxo “Esqueci a senha” no Login
- confirmar domínio final correto
5. Testar link expirado
- erro (`otp_expired`) deve aparecer em `academy.sanar.com.br`, não no legado

Observações importantes
- Links antigos já enviados continuarão apontando para o domínio antigo; é necessário gerar novos convites após a correção.
- Não há necessidade de migração de banco/RLS para este ajuste; escopo é Edge Functions + configuração Auth.
