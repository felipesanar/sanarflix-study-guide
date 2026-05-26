## Visão geral

Criar um sistema de feedback "Fale com a gente" acionável de qualquer página, com UX que faça o aluno sentir que é ouvido. Quatro categorias (bug, sugestão, nova funcionalidade, elogio), captura automática rica de contexto, screenshot opcional, e uma página pessoal "Meus feedbacks" onde o aluno acompanha o status (Recebido → Em análise → Resolvido) do que enviou.

## Experiência do aluno

**1. Acionamento global**
- FAB discreto (ícone de balão/coração) fixo no canto inferior direito, ao lado do atual `QuickActionsDock`, presente em todas as páginas autenticadas (oculto no Modo Prova).
- Atalho de teclado global `Shift + F` abre o mesmo painel.
- Microcopy do hover: "Conte pra gente".

**2. Painel de envio (Sheet lateral / Dialog premium)**
- Saudação personalizada ("Oi, {primeiro nome} — o que você quer nos contar?").
- Seleção visual de tipo via 4 cards grandes com ícones e cor própria:
  - 🐛 Reportar problema (destructive)
  - 💡 Sugerir melhoria (primary)
  - ✨ Pedir funcionalidade (accent)
  - ❤️ Elogio (success)
- Campo `Textarea` (mínimo 10, máx 2000 chars) com placeholder dinâmico por categoria e contador.
- Toggle "Anexar print" → input file (PNG/JPG, máx 5MB, 1 arquivo) com preview e botão remover.
- Linha de contexto colapsável "O que enviamos junto" mostrando URL, dispositivo, IES, semestre — transparência total, com toggle para o aluno desativar metadados se quiser.
- Botão "Enviar" com loading + animação de envio.

**3. Confirmação que emociona**
- Após envio: tela de sucesso com animação Framer Motion (check + partículas leves), frase "Recebemos, {nome}. Cada feedback é lido pela nossa equipe." e dois CTAs: "Ver meus feedbacks" e "Fechar".

**4. Página "Meus feedbacks" (`/meus-feedbacks`)**
- Acessível pelo flyout do perfil na sidebar e pelo link de confirmação.
- Lista os feedbacks do próprio usuário com badge de status colorido (Recebido / Em análise / Resolvido / Arquivado), categoria, data e trecho.
- Click → drawer com detalhes + resposta opcional da equipe + screenshot.
- Empty state caloroso convidando a enviar o primeiro.

**5. Visão admin**
- Nova aba em `/admin` chamada "Feedbacks" com tabela filtrável (categoria, status, IES, busca).
- Cada item permite mudar status e escrever resposta interna que aparece para o aluno.
- Métricas: total no mês por categoria.

## Estrutura técnica

**Banco (migration aditiva)**
- Tabela `user_feedback`:
  - `id`, `user_id`, `category` (enum: bug | suggestion | feature_request | praise), `message` (text), `screenshot_url` (text null), `status` (enum: received | in_review | resolved | archived, default received), `admin_response` (text null), `responded_by`, `responded_at`, `page_url`, `viewport`, `user_agent`, `ies_id`, `semestre`, `user_role`, `include_metadata` (bool), `created_at`, `updated_at`.
- RLS:
  - Aluno: SELECT/INSERT/UPDATE (apenas próprios; UPDATE só em registros `received` para edição rápida — opcional, podemos travar).
  - Admin: SELECT/UPDATE de tudo via `has_role(auth.uid(), 'admin')`.
- Trigger `update_updated_at`.
- Bucket de Storage `feedback-screenshots` (privado) com policies: usuário sobe em pasta `{user_id}/...`; admin lê tudo; aluno lê os próprios.

**Frontend**
- `src/components/feedback/FeedbackProvider.tsx` — Context global que controla `open/close` do sheet e expõe `openFeedback(initialCategory?)`.
- `src/components/feedback/FeedbackSheet.tsx` — UI do envio (shadcn Sheet + Framer Motion + validação Zod).
- `src/components/feedback/FeedbackFab.tsx` — FAB renderizado no `Layout` ao lado do `QuickActionsDock`.
- `src/components/feedback/FeedbackSuccess.tsx` — Tela de sucesso animada.
- `src/hooks/useFeedbackShortcut.ts` — Listener global `Shift+F` (ignora quando há input focado).
- `src/pages/MeusFeedbacks.tsx` — Página de histórico do aluno.
- `src/components/admin/FeedbackAdminTab.tsx` — Aba admin (gestão + resposta).
- Integrar `FeedbackProvider` no `App.tsx` e o `FeedbackFab` dentro de `Layout.tsx` (escondido em Modo Prova).
- Adicionar item "Meus feedbacks" no flyout de perfil da sidebar.
- Toast (sonner) de confirmação curta após envio com link "Ver status".

**Edge Function** (opcional, recomendado)
- `submit-feedback`: valida com Zod, sanitiza, faz upload do screenshot via `supabaseAdmin`, insere registro. Pattern padrão `verify_jwt = false` + verificação manual de token (segue regra do projeto).
- Alternativa simples: insert direto via supabase-js + upload no storage, sem Edge Function — começamos por aqui para reduzir superfície.

## Fora do escopo (futuro)
- Notificação por e-mail quando admin responde.
- Voto/like em sugestões de outros alunos (roadmap público).
- Categorização automática por IA.

## O que muda na navegação
- Sidebar: novo item "Meus feedbacks" no flyout do usuário.
- FAB extra no canto inferior direito junto do botão Ajuda.
- Atalho global `Shift + F`.
