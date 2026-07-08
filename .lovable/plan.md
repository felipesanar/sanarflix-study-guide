
## Objetivo

Transformar o feedback num canal que:
1. **Se apresenta sozinho** — hoje é um ícone anônimo no canto; vamos deixar claro que é "Falar com a equipe".
2. **Reduz fricção** — 1 tela em vez de múltiplos passos, print automático da página, envio sem sair do contexto.
3. **Mostra o que acontece depois** — timeline visível já no drawer + toast quando a equipe responder.
4. **Se adapta ao papel** — aluno vê "Falar com a equipe" convidativo; gestor vê "Suporte" executivo no header.

Mantém a Premium Design Language do projeto (bordas 2xl, tipografia editorial, motion sutil, tokens semânticos). Só toca em arquivos de UI/apresentação — nada de schema/edge functions/trigger Slack (que já ficaram no fluxo anterior).

---

## 1. Gatilho: dock (desktop) + FAB (mobile)

**Novo componente `FeedbackDock` (substitui `FeedbackFab` no App.tsx)** — decide sozinho o layout pelo breakpoint.

**Desktop (`md+`)** — dock horizontal fixo no rodapé direito:

```text
┌─────────────────────────────────────┐
│  💬  Falar com a equipe   ·  Shift+F │   ← pill 2xl, bg card, borda sutil
└─────────────────────────────────────┘
```

- Sempre visível com label. Hover: leve elevação + borda primária.
- Badge numérico quando há resposta nova em "Meus feedbacks" (lê `user_feedback` com `admin_response is not null AND read_at is null` — só query, sem migration; se coluna `read_at` não existir, cai pro fallback de contar respostas dos últimos 7 dias).
- Some no Modo Prova (já é regra do projeto — replica o guard atual).

**Mobile (`< md`)** — FAB redondo 56px acima do bottom-nav, com:
- Ícone `MessageSquareHeart`
- Micro-label "Feedback" que aparece 3s na primeira vez que o usuário logar (localStorage `feedback_hint_seen`), depois some.
- Long-press abre direto o drawer; tap simples abre o menu.

**Menu de gatilho (popover no desktop, sheet no mobile)** — mantém a estrutura atual (feedback + FAQ + WhatsApp) mas reescrita:

```text
FALA COM A GENTE
─────────────────────────────
🐛 Reportar problema        ›   ← 4 chips de categoria já como
💡 Sugerir melhoria         ›     entrada direta (pula a tela
✨ Pedir funcionalidade      ›     "escolha uma categoria")
❤ Mandar um elogio          ›
─────────────────────────────
Central de ajuda   [buscar]
▸ Não consigo entrar…
▸ Meu semestre está errado…
─────────────────────────────
💬 Falar no WhatsApp
```

Cada chip abre o drawer já com a categoria selecionada (usa o `initialCategory` que o `FeedbackProvider` já suporta).

---

## 2. Drawer de envio: 1 passo, tudo à vista

Reescrever `FeedbackSheet` para colapsar em **uma única tela**:

```text
┌─ Reportar problema ──────────── × ┐
│ Categoria:  [🐛]  [💡]  [✨]  [❤] │  ← toggles pequenos, troca inline
│                                    │
│ ┌──────────────────────────────┐  │
│ │ Conta o que aconteceu…       │  │  ← textarea grande, autofocus,
│ │                              │  │     contador 0/1000
│ └──────────────────────────────┘  │
│                                    │
│ ▸ Adicionar print da tela         │  ← accordion fechado; abre com
│                                    │     preview + botão "capturar tela"
│                                    │     (html2canvas na página atual)
│ ┌────────────────────────────────┐│
│ │ 📄 Página: /guia/cardiologia   ││  ← info-strip fechada: mostra o que
│ │ 🖥 Viewport: 1440x900          ││     vai junto (transparência)
│ └────────────────────────────────┘│
│                                    │
│              [ Cancelar ] [Enviar]│
└────────────────────────────────────┘
```

Regras:
- Enter+Ctrl envia; Esc cancela.
- Botão "Capturar tela" tira print da página por trás do drawer (fecha drawer momentaneamente, captura, reabre com preview).
- Copy dos placeholders muda por categoria ("O que travou?" pro bug, "Qual sua ideia?" pra sugestão, etc.).
- Mobile: sheet fullscreen com sticky footer pro botão de enviar (padrão já usado no `AddExamWizardMobile`).

---

## 3. Pós-envio: timeline no próprio drawer

Ao invés de tela de sucesso + redirect, o drawer troca de estado in-place:

```text
┌─ Recebido ✓ ─────────────────── × ┐
│                                    │
│    ✓ Recebido      · agora         │  ← 3 pontos de timeline;
│    ○ Em análise    · até 3 dias    │     o atual pulsa suavemente
│    ○ Resolvido                     │
│                                    │
│  "Vamos avaliar e responder por    │
│   aqui e por email. Você recebe    │
│   um aviso quando tivermos novi-   │
│   dade."                           │
│                                    │
│  ┌──────────────────────────────┐ │
│  │ 📥 Ver meus feedbacks       →│ │
│  └──────────────────────────────┘ │
└────────────────────────────────────┘
```

Toast (sonner) quando a equipe responder — dispara via realtime na `user_feedback` do próprio usuário (subscribe leve no `FeedbackProvider`, filtrando `admin_response` que passou de `null` → não-null). Toast tem ação "Ver resposta" que abre `MeusFeedbacks` + drawer daquele item.

---

## 4. Variante gestor: Suporte enxuto no header

Detecção: `useRole()` já indica se o user é `gestor` / `gestor_formal`.

- **Some o dock/FAB.** No lugar, item **"Suporte"** no header do `GestorLayout` (ao lado do avatar), com ícone `LifeBuoy` — abre o mesmo drawer.
- Categorias adaptadas: `Dúvida sobre dado`, `Bug / erro na plataforma`, `Sugestão de indicador`, `Outro`.
- Copy institucional: "Fale com o time Sanar" no header, "Nossa equipe responde em até 1 dia útil" na timeline.
- Sem WhatsApp no menu do gestor (canal atendido por CX — mantém só email).
- Item "Meus feedbacks" vira "Meus chamados" na rota `MeusFeedbacks` quando renderizado para gestor.

---

## 5. Descoberta e onboarding leve

- **Primeira sessão do aluno**: micro-tooltip "Achou algo estranho? Fala com a gente aqui →" no dock, 5 segundos, uma vez (localStorage). Sem interromper.
- **Empty state do `MeusFeedbacks`**: adiciona 2–3 exemplos reais anonimizados ("A galera pediu X, entregamos em 3 dias") pra mostrar que a equipe responde. Fallback estático se não houver dado.
- **Categoria com exemplos**: cada chip no menu mostra em tooltip 1 exemplo curto ("Reportar problema — ex: 'a questão 3 do simulado não carrega'").

---

## Arquivos alterados

**Novos:**
- `src/components/feedback/FeedbackDock.tsx` — decide desktop/mobile, badge de resposta nova, guard Modo Prova
- `src/components/feedback/FeedbackTriggerMenu.tsx` — o popover/sheet com chips de categoria + FAQ + WhatsApp
- `src/components/feedback/FeedbackTimeline.tsx` — timeline reutilizada no drawer e em `MeusFeedbacks`
- `src/components/feedback/useFeedbackResponseToast.tsx` — subscribe realtime + toast

**Editados:**
- `src/App.tsx` — troca `<FeedbackFab />` por `<FeedbackDock />`; monta o hook de toast dentro do `FeedbackProvider`
- `src/components/feedback/FeedbackSheet.tsx` — reescrito para 1 passo + estado pós-envio com timeline; usa `useRole` para copy/categorias do gestor
- `src/components/feedback/FeedbackProvider.tsx` — adiciona flag `role` no context (aluno/gestor) pra evitar prop drilling
- `src/experiences/gestor/GestorLayout.tsx` (ou equivalente do header do gestor — confirmar no explore) — adiciona botão "Suporte"
- `src/pages/MeusFeedbacks.tsx` — copy adaptado ao papel; reusa `FeedbackTimeline` no drawer de detalhes; exemplos no empty state
- `src/components/feedback/FeedbackFab.tsx` — deletado (`rm`)

**Não muda:**
- `supabase/functions/notify-feedback-slack/*` — intacto
- Migration do trigger — intacta
- Tabela `user_feedback` — sem alteração de schema

---

## Detalhes técnicos

- Screenshot inline: usa `html2canvas` (já presente no bundle indiretamente? checar; se não, `bun add html2canvas`). Faz upload direto pro bucket `feedback-screenshots` como hoje.
- Realtime toast: `supabase.channel('user_feedback:' + user.id).on('postgres_changes', { event: 'UPDATE', filter: 'user_id=eq.<uid>' }, …)`. Só dispara quando `admin_response` passa de null → not null.
- Badge no dock: query leve com `count` e cache de 60s (React Query já usado no projeto).
- Mobile FAB posicionado com `bottom: calc(env(safe-area-inset-bottom) + var(--mobile-nav-height) + 12px)` — respeita o bottom-nav já existente.
- Motion: `framer-motion` (já é padrão), `whileHover` só no desktop, respeita `prefers-reduced-motion`.

---

## Fora de escopo

- Nenhum trigger, edge function ou migração de banco muda.
- Nada de novos campos na `user_feedback` — o `read_at` é opcional (se não existir, usa contagem de 7 dias como aproximação).
- Fluxo de admin (`FeedbacksSection`) permanece igual — o escopo é a experiência do aluno/gestor.
