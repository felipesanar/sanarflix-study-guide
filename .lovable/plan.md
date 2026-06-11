# Plano para resolver o erro persistente em produção

## Objetivo
Descobrir por que o fluxo de atualização em lote continua falhando em `academy.sanar.com.br`, mesmo com a correção já presente no código atual do projeto.

## O que vou fazer
1. **Verificar paridade entre produção e o código atual**
   - Confirmar se o site publicado/custom domain está rodando a versão mais recente do frontend.
   - Validar se o bundle em produção já contém a proteção de sessão expirada no `BulkEmailUpdateTab`.

2. **Confirmar qual backend a produção está chamando**
   - Validar se o domínio publicado está apontando para este mesmo projeto Supabase e para a edge function `admin-bulk-update-email` correta.
   - Conferir se as chamadas do site em produção realmente chegam à função publicada.

3. **Isolar a causa real do erro genérico**
   - Se a produção estiver com frontend desatualizado, ajustar e publicar.
   - Se a produção estiver chamando outro projeto/endpoint, corrigir a configuração.
   - Se a função estiver recebendo token inválido em produção, reforçar a resposta do backend para retornar motivo explícito e facilitar o diagnóstico.

4. **Melhorar observabilidade do fluxo**
   - Adicionar sinais claros para distinguir:
     - sessão expirada
     - falta de permissão
     - função errada/endpoint errado
     - falha real por linha do CSV
   - Evitar novamente o estado de “44 falhas” com mensagem genérica quando o problema é global.

5. **Validar no ambiente publicado**
   - Testar o fluxo no domínio em produção após a correção.
   - Confirmar se o resultado muda de erro genérico para processamento correto ou para mensagem precisa de reautenticação.

## Diagnóstico atual
- O código atual da edge function `admin-bulk-update-email` **já usa o padrão correto de dois clientes** (anon + service role) para validar o usuário e executar a operação administrativa.
- O frontend atual também **já tem guarda de sessão expirada** antes de iniciar o lote.
- Porém, os logs recentes **não mostram tráfego chegando em `admin-bulk-update-email`** neste projeto, o que sugere fortemente uma destas hipóteses:
  - o site em produção está com **build antigo**;
  - o domínio publicado está usando **outra implantação/projeto**;
  - a produção está chamando **outro endpoint/configuração** diferente do código atual.

## Detalhes técnicos
- Arquivos principais envolvidos:
  - `src/components/admin/BulkEmailUpdateTab.tsx`
  - `src/services/usersService.ts`
  - `supabase/functions/admin-bulk-update-email/index.ts`
  - `src/integrations/supabase/client.ts`
- Sinal mais importante a validar agora:
  - se `academy.sanar.com.br` está servindo o frontend atualizado e apontando para `gvqvrmkizemwsasmupmo.supabase.co`.

## Resultado esperado
Ao final, a produção ficará alinhada com o código atual e o fluxo passará a:
- processar normalmente os emails, ou
- bloquear com mensagem explícita de sessão/permissão, sem mascarar tudo como falha em lote.