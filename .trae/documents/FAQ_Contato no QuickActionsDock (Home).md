## Objetivo

* Transformar o cartão de perfil (sidebar) em área clicável que abre uma caixa flutuante premium (flyout) com opções rápidas de conta.

* Resolver acessos comuns: alterar senha (fluxo existente) e reportar semestre errado (WhatsApp com mensagem pré‑preenchida).

## Escopo e Abordagem

* Usar os componentes de UI já presentes (Radix/`Popover`) para alinhamento pelo lado direito do elemento, com fechamento ao clicar fora.

* Envolver o cartão de perfil em um `button` acessível, com `PopoverTrigger asChild` e estados de hover/focus claros.

* Criar um pequeno contexto para acionar o modal de alteração de senha a partir de qualquer parte do app.

## Implementação (Passos)

### 1) Contexto de Alteração de Senha

* Criar `PasswordDialogContext` com `{ open:boolean, setOpen(fn) }`.

* Providenciar no `Layout` (já importa `ChangePasswordDialog`) e mover o estado atual para o contexto.

* Consumir o contexto em `AppSidebar` para acionar `setOpen(true)`.

### 2) Flyout no Cartão de Perfil

* Em `AppSidebar`, envolver o cartão de perfil em `PopoverTrigger asChild` com `button`:

  * `aria-expanded`, `aria-controls`, `focus:ring`, `hover:bg-sidebar-accent/80`.

* `PopoverContent` (lado direito, `align="end"`, offset pequeno) com:

  * **Trocar a senha**: botão que chama `setOpen(true)` do contexto e fecha o popover.

  * **Semestre errado**: botão que abre `wa.me/5571993120049?text=<mensagem codificada>` em nova aba e fecha o popover.

* Responsividade: em telas muito estreitas, posicionar abaixo (`side="bottom"`) via `Popover` com `avoidCollisions`.

### 3) Visual e Animação

* Animação suave: classes de entrada `animate-in fade-in-0 slide-in-from-right-2` e saída `fade-out slide-out-to-right-2`.

* Estilo premium: `rounded-lg`, `shadow-xl`, `backdrop-blur-md` (ou `bg-card` + `shadow`), respeitando tema.

* Z‑index seguro para não sobrepor cabeçalhos; padding interno confortável.

### 4) UX

* Fecha ao clicar fora e ao clicar novamente no trigger.

* Hover claro na área clicável; foco visível e acessível.

* Não obstruir outros botões próximos (usar `sideOffset` e `collisionPadding`).

## Testes

* Unitário (Popover): abre/fecha com trigger; fecha ao clicar fora.

* Unitário (Ações):

  * “Trocar a senha” chama `setOpen(true)` do contexto.

  * “Semestre errado” abre `window.open(url)` com texto codificado correto.

* Integração (Layout + Sidebar): `ChangePasswordDialog` abre via contexto a partir do flyout.

* Responsividade: posiciona à direita em desktop e abaixo em mobile.

* Acessibilidade: trigger com `role="button"`, foco visível, navegação por teclado.

## Entregáveis

* Flyout funcional e integrado à UI (premium).

* Contexto de alteração de senha (Layout provider + consumidor no Sidebar).

* Testes unitários e de integração cobrindo fluxos.

## Observações

* Usar `window.open(url, '_blank', 'noopener,noreferrer')` para WhatsApp.

* Mensagem: "Olá, o meu semestre na plataforma Sanarflix Academy está errado." codificada via `encodeURIComponent`.

* Garantir que não há regressões do `ChangePasswordDialog` em outras áreas que já o acionam.

