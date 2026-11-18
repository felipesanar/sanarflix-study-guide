# Mensagem correta para acesso expirado no login

## Causa (confirmada no código)
O servidor de login já identifica a conta expirada. Ele responde com o código `ACCESS_EXPIRED` e a mensagem "Seu acesso expirou. Procure sua instituição."

A falha está na tela de login, que não consegue ler essa resposta. Na versão atual da biblioteca do Supabase, o detalhe do erro chega em `error.context`, que é um objeto `Response`. A tela tenta lê-lo como texto (`context.body` do tipo string), não encontra nada e mostra a mensagem padrão "Email ou senha inválidos".

O mesmo problema afeta a outra mensagem específica que o servidor envia, "Perfil não encontrado. Contate o suporte.", que hoje também nunca aparece.

## Mudanças
1. **Leitura do erro na tela de login:** ler a resposta do servidor corretamente com `await error.context.json()`, protegido por try/catch, e guardar a mensagem e o código.
2. **Acesso expirado:** quando o código for `ACCESS_EXPIRED`, mostrar o título "Acesso expirado" e o texto **"Seu período de acesso expirou. Entre em contato com sua IES."** O aviso fica um pouco mais tempo na tela.
3. **Servidor de login:** alinhar a mensagem dele ao mesmo texto, para que fique igual em todo lugar.
4. **Demais casos sem mudança:** senha errada continua mostrando "Email ou senha inválidos".

## Testes
Teste unitário da função que extrai a mensagem do erro, com três casos:
- resposta com `ACCESS_EXPIRED` mostra a mensagem de expiração;
- resposta 401 com "Email ou senha inválidos" mantém essa mensagem;
- resposta sem conteúdo legível usa a mensagem padrão.

## Detalhes técnicos
- Extrair um helper `readEdgeError(error)` em `src/services/authService.ts` ou num utilitário próprio. Ele retorna `{ message, code }`, lendo de um `Response` (`.clone().json()`) ou de uma string, para manter a compatibilidade.
- `src/contexts/AuthContext.tsx`, no `login`: usar o helper, tratar `code === 'ACCESS_EXPIRED'` antes dos demais casos e manter o resto do fluxo.
- `supabase/functions/auth-login/index.ts`: atualizar `ACCESS_EXPIRED_MESSAGE`.
