
# Plano Completo: Central de Progresso — Evolução Premium

## 1. Diagnostico do Estado Atual

### Pontos Fortes (O que ja existe)
| Area | Implementacao | Status |
|------|---------------|--------|
| Arquitetura de Dados | Tabela `user_progress_nodes` com suporte hierarquico (aula/subtema/tema/materia) | Completo |
| RPCs | `complete_theme` e `uncomplete_theme` para conclusao em lote | Completo |
| Edge Function | `get-progress-hub` calcula overview, streak, by_materia, by_tema, evolucao semanal, next_actions | Completo |
| Hook Frontend | `useProgressHub()` com cache 15min, otimistic update, undo via toast | Completo |
| UI Hero Card | Anel de progresso, status badge, CTAs "Continuar" e "Organizar semana" | Completo |
| UI Proximos Passos | Cards com 3 tipos (today_focus, quick_win, unlock_progress) + reason explicavel | Completo |
| UI Consistencia | Streak semanal com meta 3 dias, visual de dots | Completo |
| UI Mapa Semestre | Accordions Materia → Tema com badges de status e botao "Concluir" | Completo |
| UI Evolucao | AreaChart das ultimas 8 semanas | Completo |

### Gaps Identificados (O que falta)
| Gap | Impacto | Prioridade |
|-----|---------|------------|
| Nao ha integracao com Home (card resumo + CTA) | Aluno nao ve progresso na tela inicial | P0 |
| Falta filtro por status (concluido/pendente) em mobile | UX quebrada | P1 |
| Sem modo "Pre-Prova" ou checkpoints de revisao | Aluno nao sabe o que revisar antes da prova | P1 |
| Sem deteccao de risco/atraso ("Voce esta acumulando pendencias em X") | Aluno nao recebe alertas proativos | P1 |
| Streak nao e configuravel (meta fixa em 3) | Falta personalizacao | P2 |
| Sem revisao espacada ou lembretes inteligentes avanc | Reforco de habito limitado | P2 |
| Eventos de analytics incompletos | Nao conseguimos medir impacto | P0 |
| Sem comparativo com turma (defer planejado) | Ok para V1, mas fica para V2 | P2 |

---

## 2. Personas e Jornadas do Aluno de Medicina

### Personas

**A. "O Perdido" (Semestre Caótico)**
- Contexto: Primeiro/segundo ano, plantoes imprevistos, estagio mudando rotina
- Dor: "Nao sei por onde comecar, sinto que estou atrasado em tudo"
- Necessidade: Priorizacao clara, quick wins para recuperar confianca
- O que a Central deve fazer: Destacar "Destravar" + mostrar pendencias criticas + sugerir 1 acao por dia

**B. "O Consistente"**
- Contexto: Aluno com rotina, estuda 3-4x por semana
- Dor: "Quero manter o ritmo sem burnout"
- Necessidade: Ver evolucao, metas semanais, celebracoes discretas
- O que a Central deve fazer: Exibir streak, grafico de evolucao, sugerir proximos passos baseados no calendario

**C. "O Pre-Prova"**
- Contexto: 1-2 semanas antes de prova parcial ou final
- Dor: "O que eu nao dominei ainda? O que revisar?"
- Necessidade: Modo focado, gaps claros, checklist de revisao
- O que a Central deve fazer: Filtro "Pre-Prova", mostrar temas com menor %, sugerir revisao de temas "dominados ha muito tempo"

**D. "O Em Recuperacao"**
- Contexto: Voltando apos periodo de inatividade (ferias, doenca)
- Dor: "Por onde retomar? Quanto eu perdi?"
- Necessidade: Resumo do que falta, plano de retomada sem sobrecarregar
- O que a Central deve fazer: Hero com mensagem "Hora de retomar", sugestoes de quick wins, streak zerada sem culpa

**E. "O Dominador"**
- Contexto: Mais de 70% concluido, consistente
- Dor: "Falta pouco, quero terminar"
- Necessidade: Ver o que falta, fechar gaps, celebrar vitoria
- O que a Central deve fazer: Mostrar "Faltam X aulas", destacar materias quase completas

### Jornadas Mapeadas

**Primeiro Acesso**
1. Aluno entra em `/dashboard`
2. Se nao ha progresso: exibir empty state com CTA "Comece sua jornada" → Guia
3. Se ha dados: mostrar Hero com % zero, sugerir 3 acoes iniciais
4. Tracking: `progress_hub_first_view`

**Semana de Rotina**
1. Aluno abre app (Home) → ve card resumo com streak e % geral
2. Clica "Ver progresso" → Central
3. Ve streak, meta semanal, proximos passos do dia
4. Conclui 1-2 aulas via Guia
5. Volta a Central para ver atualizacao (cache invalida)
6. Tracking: `progress_hub_view`, `click_next_action`, `mark_lesson_complete`

**Pre-Prova (1-2 semanas antes)**
1. Aluno ativa "Modo Pre-Prova" via toggle ou URL param
2. Central exibe:
   - Temas com < 50% (gaps criticos)
   - Temas 50-80% (revisar)
   - Temas > 80% (revisao rapida)
3. Sugere checklist de revisao ordenado por prioridade
4. Tracking: `preprova_mode_activated`, `preprova_tema_reviewed`

**Pos-Prova (Gaps)**
1. Aluno volta apos prova
2. Central detecta inatividade de X dias
3. Mostra "Bem-vindo de volta" + resumo do que fez antes
4. Sugere retomar de onde parou
5. Tracking: `returning_after_inactivity`

**Semana Caotica (Plantao/Estagio)**
1. Aluno mal consegue abrir app
2. Central mostra "Quick wins" de 5-10 min
3. Nao culpa por quebrar streak, mensagem gentil
4. Tracking: `quick_win_completed`

---

## 3. Ideias de Evolucao (Organizadas por Tema)

### A. Motivacao e Habito (P0-P1)
| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Card de Progresso na Home | Mini-hero com %, streak, CTA "Ver Central" | P0 |
| Meta semanal configuravel | Permitir aluno definir meta (2-5 dias) | P1 |
| Celebracao de marco | Quando atinge 25%, 50%, 75%, 100% de materia | P1 |
| Mensagens contextuais | "Voce esta on fire", "Faltam 3 dias para bater meta" | P1 |

### B. Clareza de Progresso (P0-P1)
| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Filtros em Drawer (mobile) | Disciplina + Status + Semana | P0 |
| Chips de filtro ativos | Mostrar filtros aplicados abaixo do hero | P1 |
| Subtema expansion | Expandir tema para ver subtemas com progresso individual | P1 |
| Search no Mapa do Semestre | Buscar materia/tema rapidamente | P2 |

### C. Proxima Melhor Acao (P0-P1)
| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Reason explicavel | Ja implementado, manter | P0 |
| Ordenacao por tempo | "10 min" tags para quick wins | P1 |
| Navegacao direta com highlight | Deep link ja existe, garantir highlight | P0 |

### D. Preparacao para Provas (P1)
| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Modo Pre-Prova | Toggle que reorganiza Central para foco em gaps | P1 |
| Checklist de revisao | Lista ordenada: "Revisar X", "Dominar Y" | P1 |
| Data da prova (opcional) | Countdown se aluno informar data | P2 |

### E. Alertas de Risco (P1)
| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Deteccao de acumulo | "Voce nao estudou X ha 2 semanas" | P1 |
| Badge de atencao | Badge vermelho em tema atrasado | P1 |
| Notificacao push (ReminderSettings) | Lembrete se streak quebrar | P2 |

### F. Consistencia Semanal (P1)
| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Meta configuravel | Slider 2-5 dias | P1 |
| Historico de metas atingidas | "3 semanas seguidas" | P2 |
| Integracao com ReminderSettings | Lembrete no horario preferido | P2 |

### G. Integracao Ecossistema (P0)
| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Card na Home | ProgressSummaryCard com %, streak, CTA | P0 |
| CTA no Guia apos concluir | "Ver impacto no progresso" | P1 |
| Deep link bidirecional | Central → Guia e Guia → Central | P0 |

### H. Quick Wins / Estudo Rapido (P1)
| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Tag de duracao estimada | "~10 min" em cada card | P1 |
| Filtro "Tenho 15 min" | Mostrar apenas quick wins | P2 |

### I. Revisao Espacada (P2 - Futuro)
| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Algoritmo de revisao | Sugerir revisao de temas concluidos ha X dias | P2 |
| Integracao com quizzes | Recomendar quiz de tema ja estudado | P2 |

### J. Acessibilidade (P0)
| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Focus-visible em todos CTAs | Ring de foco | P0 |
| aria-label em botoes | Descricoes acessiveis | P0 |
| prefers-reduced-motion | Desabilitar animacoes | P0 |

---

## 4. Eventos e Telemetria

### A. Eventos Provavelmente Existentes
| Evento | Categoria | Descricao |
|--------|-----------|-----------|
| `page_view` | navigation | Visualizacao de pagina |
| `content_view` | content | Abertura de aula/PDF/quiz |
| `simulado_start` | simulado | Inicio de simulado |
| `simulado_complete` | simulado | Finalizacao de simulado |
| `sanarclass_view` | sanarclass | Visualizacao de aula SanarClass |
| `error_occurred` | error | Erro capturado |

### B. Eventos que Faltam (Proposta Completa)

| event_name | Descricao | Quando Dispara | Props Obrigatorias | Exemplo Payload |
|------------|-----------|----------------|--------------------|-----------------| 
| `progress_hub_view` | Abertura da Central | Mount de Dashboard | user_id, ies_id, source | `{source: "home_card"}` |
| `progress_hub_first_view` | Primeira visita do user | Mount + sem dados previos | user_id, ies_id | `{}` |
| `click_next_action` | Clique em recomendacao | Clique em card NextAction | action_id, action_type, materia, tema | `{type:"quick_win"}` |
| `mark_lesson_complete` | Conclusao de aula | Apos salvar no DB | content_id, materia, tema, source | `{source:"guia"}` |
| `mark_lesson_undo` | Desfazer conclusao aula | Clique em "Desfazer" | content_id | `{}` |
| `mark_theme_complete` | Conclusao de tema (batch) | Apos RPC complete_theme | materia, tema, aulas_count | `{aulas_count:5}` |
| `mark_theme_undo` | Desfazer tema | Clique em "Desfazer" | materia, tema | `{}` |
| `open_from_home` | Abertura via Home card | Clique em CTA da Home | user_id | `{}` |
| `navigate_to_guide_from_hub` | Navegacao Central → Guia | Clique em qualquer CTA que leva ao Guia | target, deep_link | `{target:"/guia-estudos?materia=X"}` |
| `filter_applied` | Aplicacao de filtro | Selecao de filtro | filter_type, filter_value | `{type:"status",value:"pending"}` |
| `preprova_mode_activated` | Ativacao modo pre-prova | Toggle on | user_id | `{}` |
| `streak_goal_changed` | Mudanca de meta | Alteracao via slider | old_goal, new_goal | `{old:3,new:5}` |
| `calendar_edit_from_hub` | Edicao calendario via hub | Clique "Organizar semana" | user_id | `{}` |
| `returning_after_inactivity` | Retorno apos X dias | Login + ultima atividade > 3 dias | days_inactive | `{days:7}` |

### C. Funis e Metricas

**Funil de Ativacao**
```text
1. progress_hub_first_view
2. click_next_action (primeira vez)
3. mark_lesson_complete (primeira vez)
```

**Funil de Habito Semanal**
```text
1. progress_hub_view (domingo)
2. mark_lesson_complete (>=1 por dia)
3. streak_goal_achieved (ao atingir meta)
```

**Metricas Chave**
| Metrica | Calculo | Tabela/View |
|---------|---------|-------------|
| Ativacao D1 | % users com primeira conclusao em 24h | analytics_events |
| Retencao D7 | % users com atividade 7 dias apos cadastro | user_sessions + analytics_events |
| DAU/WAU | Usuarios ativos diarios/semanais | user_sessions |
| Streak medio | Avg(streak.current) por cohort | Derivado de user_progress |
| Conversao Recomendacao→Acao | click_next_action → mark_lesson_complete | analytics_events |

### D. Tabelas/Views para Agregacao

**View: `v_user_weekly_activity`**
```sql
CREATE VIEW v_user_weekly_activity AS
SELECT 
  user_id,
  DATE_TRUNC('week', completed_at) AS week,
  COUNT(*) AS lessons_completed,
  COUNT(DISTINCT DATE(completed_at)) AS active_days
FROM user_progress
GROUP BY user_id, DATE_TRUNC('week', completed_at);
```

**View: `v_cohort_progress`** (para comparativo futuro)
```sql
CREATE VIEW v_cohort_progress AS
SELECT 
  u.id_ies,
  u.semestre,
  COUNT(DISTINCT up.user_id) AS users_with_progress,
  AVG(completed_count)::INTEGER AS avg_completed,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY completed_count) AS p50,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY completed_count) AS p75
FROM users u
JOIN (
  SELECT user_id, COUNT(*) AS completed_count
  FROM user_progress
  GROUP BY user_id
) up ON u.id = up.user_id
WHERE (SELECT COUNT(DISTINCT up2.user_id) FROM user_progress up2 
       JOIN users u2 ON up2.user_id = u2.id 
       WHERE u2.id_ies = u.id_ies AND u2.semestre = u.semestre) >= 20
GROUP BY u.id_ies, u.semestre;
```

---

## 5. Arquitetura de Dados e Backend

### Schema Atual (Consolidado)
```text
user_progress_nodes
├── id (UUID, PK)
├── user_id (UUID, FK → auth.users)
├── node_type (ENUM: aula|subtema|tema|materia)
├── node_id (TEXT, formato: "Materia::Tema" ou "Materia::Tema::Subtema")
├── completed_at (TIMESTAMPTZ)
├── source (ENUM: manual|bulk|auto)
├── metadata (JSONB)
└── Indices: user_id, node_type, completed_at, (user_id,node_type,node_id)
```

### RPCs Existentes
- `complete_theme(p_materia, p_tema, p_subtema)`: Marca aulas + cria node
- `uncomplete_theme(p_materia, p_tema, p_subtema)`: Remove aulas + node
- `get_progress_hub_summary()`: Agregacao completa (nao usada atualmente, Edge Function faz o trabalho)

### Melhorias Propostas

**1. Nova RPC: `update_streak_goal`**
```sql
CREATE OR REPLACE FUNCTION update_streak_goal(p_goal INTEGER)
RETURNS JSON AS $$
  -- Salvar meta em user_preferences ou coluna em users
$$ LANGUAGE plpgsql;
```

**2. Nova RPC: `get_preprova_summary`**
```sql
CREATE OR REPLACE FUNCTION get_preprova_summary()
RETURNS JSON AS $$
  -- Retornar temas ordenados por gap (< 50%, 50-80%, > 80%)
  -- Incluir "ultima revisao" para cada tema
$$ LANGUAGE plpgsql;
```

**3. Edge Function: Estender `get-progress-hub`**
- Adicionar parametro `?mode=preprova` para retornar dados filtrados
- Adicionar `risk_alerts`: temas sem atividade em 14+ dias

### Estrategia de Migracao
- `useStudy()` continua funcionando (le de `user_progress`)
- `useProgressHub()` le agregados via Edge Function
- Ambos coexistem, sem quebra

### Cache e SWR
| Cache Key | TTL | Invalidacao |
|-----------|-----|-------------|
| `progress_hub_data` | 15 min | Apos complete/uncomplete |
| `study_contents_{ies}_{sem}` | 2h | Nunca (conteudo raramente muda) |
| `preprova_summary` | 10 min | Apos complete |

---

## 6. Proposta UX/UI Detalhada

### Layout Desktop (1024px+)

```text
+----------------------------------------------------------+
| HEADER: Central de Progresso | IES • Xo periodo | [sync] |
+----------------------------------------------------------+
| [======================= HERO CARD ====================] |
| | Ring 32%  | Status Badge | Streak 3/5 |  [Continuar]  | |
| |           | "Consistente" | ▪▪▪░░░░   |  [Organizar]  | |
+----------------------------------------------------------+
| [NEXT ACTIONS]    | [CONSISTENCY]     | [EVOLUTION]      |
| Card 1: Foco hoje | Dots: D S T Q Q S S| AreaChart 8sem  |
| Card 2: Quick win | Meta: 3/5         |                  |
| Card 3: Destravar | "Falta 1 dia"     |                  |
+----------------------------------------------------------+
| [==================== SEMESTER MAP ====================] |
| | [Accordion Materia 1] 45% ▪▪▪▪▪░░░░░ [Precisa atencao] |
| |   └─ Tema A: 80%                         [Concluir]   |
| |   └─ Tema B: 20%  ⚠                      [Ver] [✓]    |
| | [Accordion Materia 2] 100% ✓                          |
+----------------------------------------------------------+
```

### Layout Mobile (< 768px)

```text
+------------------------------------+
| ⬅ Central de Progresso    [sync]  |
+------------------------------------+
| +--------------------------------+ |
| |    [Ring]    |  Status Badge  | |
| |     32%      | "Consistente"  | |
| |  ▪▪▪░░░░ 3/5 |                | |
| | [Continuar] [Organizar semana]| |
| +--------------------------------+ |
+------------------------------------+
| [Filtros ▼] Drawer                |
+------------------------------------+
| O que fazer agora                 |
| +------------------------------+  |
| | Foco hoje • Anatomia         |  |
| | "Esta no seu calendario"     |  |
| | [Assistir] [PDF]             |  |
| +------------------------------+  |
+------------------------------------+
| Sua consistencia                  |
| D S T Q Q S S                     |
| ✓ ✓ ✓ · · · ·                    |
| Meta: 3/5 | "Falta 2 dias"        |
+------------------------------------+
| Mapa do Semestre                  |
| [Materia 1 ▼] 45%                |
|   Tema A 80%                     |
|   Tema B 20% ⚠ [Ver] [Concluir]  |
+------------------------------------+
```

### Componentes Novos/Modificados

| Componente | Local | Descricao |
|------------|-------|-----------|
| `ProgressSummaryCard` | `src/components/home/` | Card para Home com %, streak, CTA |
| `FiltersDrawerMobile` | `src/components/progress-hub/` | Drawer com filtros (status, materia) |
| `FilterChips` | `src/components/progress-hub/` | Chips mostrando filtros ativos |
| `RiskAlertBanner` | `src/components/progress-hub/` | Banner "Voce esta atrasado em X" |
| `PreProvaToggle` | `src/components/progress-hub/` | Switch para modo pre-prova |
| `StreakGoalSlider` | `src/components/progress-hub/` | Slider para configurar meta |

### Estados

| Estado | Componente | Visual |
|--------|------------|--------|
| Loading | ProgressHubSkeleton | Ja existe, manter |
| Erro | ErrorState card | Ja existe, manter |
| Vazio (primeiro acesso) | EmptyState com ilustracao + CTA "Comece" | Criar |
| Vazio (filtro sem resultados) | "Nenhum item corresponde" + limpar filtro | Criar |
| Syncing | Spinner no header | Ja existe |

### Motion Guidelines (Framer Motion)

```typescript
// Container stagger
containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

// Item fade up
itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } }
};

// Progress ring animate
progressRing = {
  initial: { pathLength: 0 },
  animate: { pathLength: percentage/100 },
  transition: { duration: 1, ease: 'easeOut' }
};

// Celebration confetti (opcional)
celebration = {
  scale: [1, 1.2, 1],
  transition: { duration: 0.3 }
};

// Reduced motion
@media (prefers-reduced-motion: reduce) {
  // Disable all animations
}
```

---

## 7. Roadmap por Fases

### MVP (Semana 1-2) — Ja Excelente

**Escopo**
- [x] Hero Card com ring, status, streak, CTAs
- [x] Next Actions com reason explicavel
- [x] Consistency Card com meta fixa (3 dias)
- [x] Semester Map com accordions e "Concluir tema"
- [x] Weekly Evolution chart
- [ ] Card de Progresso na Home (ProgressSummaryCard) — **PENDENTE P0**
- [ ] Eventos basicos: `progress_hub_view`, `mark_theme_complete` — **PENDENTE P0**
- [ ] Focus-visible e aria-labels — **PENDENTE P0**

**Esforco**: M
**Criterios de Aceitacao**:
- Aluno ve % geral, streak, proximos passos
- Pode concluir tema com desfazer
- Home tem card que leva a Central
- Eventos disparam corretamente

---

### V1 Avancado (Semana 3-4)

**Escopo**
- [ ] Filtros em Drawer (mobile)
- [ ] Chips de filtros ativos
- [ ] Meta semanal configuravel (slider 2-5 dias)
- [ ] Risk Alert Banner ("Voce nao estudou X em 2 semanas")
- [ ] Empty state para primeiro acesso
- [ ] Todos os eventos de tracking
- [ ] CTA no Guia apos concluir: "Ver impacto"

**Esforco**: L
**Criterios de Aceitacao**:
- Mobile tem filtros em Drawer sem UI quebrada
- Aluno pode personalizar meta
- Alertas de risco aparecem para temas sem atividade
- Tracking completo funcionando

---

### V2 "Wow" (Semana 5-6)

**Escopo**
- [ ] Modo Pre-Prova com toggle e checklist
- [ ] Celebracoes de marco (25%, 50%, 75%, 100%)
- [ ] Lembretes inteligentes (evolucao ReminderSettings)
- [ ] Revisao espacada basica (sugerir revisao de tema antigo)
- [ ] Comparativo com turma (agregado, threshold >= 20)
- [ ] Historico de metas atingidas

**Esforco**: L
**Criterios de Aceitacao**:
- Aluno pode ativar Pre-Prova e ver gaps
- Celebracoes aparecem em marcos
- Comparativo so aparece se cohort >= 20
- Revisao espacada sugere temas concluidos ha > 14 dias

---

## 8. Riscos e Mitigacao + Checklist QA

### Riscos

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| Cache desatualizado apos conclusao | Media | Alto | Invalidar cache apos complete/uncomplete + background refresh |
| Performance com muitos conteudos (>500) | Media | Medio | Paginacao no backend, virtualização no frontend |
| Conflito entre `useStudy()` e `useProgressHub()` | Baixa | Alto | Garantir que ambos leem da mesma fonte (user_progress) |
| Mobile UI quebrada com muitos filtros | Media | Alto | Drawer obrigatorio em mobile |
| Eventos perdidos (rede instavel) | Media | Medio | Queue local + retry |

### Checklist QA

**Responsividade**
- [ ] Desktop 1920x1080: layout 3 colunas ok
- [ ] Tablet 768x1024: layout 2 colunas ok
- [ ] Mobile 375x812: single column, filtros em Drawer
- [ ] Zero overflow-x em qualquer breakpoint

**Acessibilidade**
- [ ] Navegacao completa por teclado
- [ ] Focus-visible ring em todos CTAs
- [ ] aria-label em botoes iconicos
- [ ] Contraste WCAG AA em light/dark
- [ ] prefers-reduced-motion desabilita animacoes

**Performance**
- [ ] LCP < 2.5s na Central
- [ ] TTI < 3.5s
- [ ] Skeleton aparece em < 100ms
- [ ] Sem jank durante scroll/animacao

**Funcional**
- [ ] Concluir tema atualiza hero + mapa instantaneamente
- [ ] Desfazer reverte corretamente
- [ ] Deep link Central → Guia abre com highlight
- [ ] Deep link Home → Central funciona
- [ ] Filtros persistem durante sessao
- [ ] Eventos disparam em console (dev mode)

**Regressao**
- [ ] Guia de Estudos continua funcionando
- [ ] Deep links do Guia continuam funcionando
- [ ] Home continua funcionando
- [ ] Calendario continua sincronizando

