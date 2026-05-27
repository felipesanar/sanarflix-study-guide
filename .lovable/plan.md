## Causa raiz

O preview da Lovable está entrando em loop de reload por causa do Service Worker (`public/sw.js` + `src/utils/serviceWorker.ts`).

Sequência do loop:

1. `main.tsx` chama `registerServiceWorker()` em produção (preview da Lovable é build de produção, então registra).
2. Em `serviceWorker.ts` existe um listener:
   ```ts
   navigator.serviceWorker.addEventListener('controllerchange', () => {
     window.location.reload();
   });
   ```
3. Toda vez que o preview rebuilda (ou serve um `sw.js` diferente), um novo SW assume, dispara `controllerchange` → `reload()` → carrega de novo → novo SW assume → reload de novo. Loop infinito.

Isso explica por que aparece logo após o login (quando o app está completamente carregado e o SW termina de instalar), e por que só acontece no preview da Lovable (em produção real o `sw.js` é estável entre visitas).

## Correção

Mudanças mínimas e cirúrgicas, apenas em código de bootstrap do SW:

### 1. `src/utils/serviceWorker.ts`
- Remover o reload automático no `controllerchange`. Manter apenas o registro do SW. Atualizações passam a valer no próximo refresh natural do usuário, sem auto-reload (que é o que dispara o loop).
- Pular o registro quando o host for um domínio de preview da Lovable (`*.lovable.app` que contém `id-preview--` ou `preview--`). Isso garante que mesmo se outro caminho disparar reload, o SW não fique competindo com o bundle servido pelo preview.

### 2. `public/sw.js`
- Remover/condicionar o `self.skipWaiting()` no evento `install` para que o novo SW não tome controle automaticamente assumindo o controlador atual (o que gera o `controllerchange`). Em vez disso, o novo SW só ativa após todos os tabs serem fechados — comportamento padrão e seguro.

### Não mexer em
- AuthContext, LoginForm, rotas, edge functions, RLS — esses fluxos estão funcionando (os logs de network mostram login OK e dados sendo retornados antes do reload).

## Como o usuário desbloqueia o preview agora

Depois do deploy do fix, o usuário precisa desregistrar o SW antigo que já está em loop. Vou orientar para acessar o preview com `?reset-cache=1` (já existe um handler em `App.tsx` que limpa caches, IndexedDB e desregistra Service Workers) e isso encerra o loop em uma única recarga.

## Detalhes técnicos

Arquivos editados:
- `src/utils/serviceWorker.ts` — remover handler de `controllerchange` e adicionar guarda para hosts de preview.
- `public/sw.js` — remover `self.skipWaiting()` do `install`.

Nenhuma migração, nenhuma alteração de UI, nenhuma alteração de auth.