
# Auditoria Completa Mobile — Central de Progresso + Guia de Estudos

## Resumo Executivo

Foi identificada uma série de problemas críticos na versão mobile das telas "Central de Progresso" (Dashboard) e "Guia de Estudos", incluindo:

1. **Erro de Contexto AuthProvider** (CRÍTICO): O componente `ExamTrackerCard` está sendo renderizado no mobile em situações onde o `AuthProvider` não está corretamente encapsulando a árvore de componentes.
2. **Scroll bloqueado**: Conflitos de `overflow` entre containers aninhados.
3. **Sobreposição de elementos**: Falta de `min-w-0`, gaps inadequados e elementos flex sem constraints.
4. **Responsividade inadequada**: Padding/margin inconsistentes, botões muito pequenos para touch.

---

## Diagnóstico Detalhado

### 1. Erro: `useAuth must be used within an AuthProvider`

**Localização**: `ExamTrackerCard.tsx → useUserExams.ts → useAuth()`

**Causa Raiz**:
- O `ExamTrackerCard` chama `useUserExams()` que internamente usa `useAuth()`
- No fluxo mobile, o componente `ProvasTab` (lazy-loaded via `Suspense`) renderiza o `ExamTrackerCard`
- Durante a renderização lazy, se o componente tentar acessar o contexto antes da árvore estar completa, o erro ocorre

**Análise do Fluxo**:
```
Dashboard.tsx
└── ProgressHubMobile (isMobile=true)
    └── ProvasTab (lazy loaded)
        └── ExamTrackerCard
            └── useUserExams()
                └── useAuth() ← ERRO: Contexto não encontrado
```

**Solução**: Adicionar verificação defensiva no `useUserExams` para retornar estado vazio se `useAuth` não estiver disponível, e garantir que o Suspense tenha fallback adequado.

### 2. Scroll Bloqueado no Mobile

**Causa Raiz**:
- `ProgressHubMobile` tem `overflow-y-auto` no container interno
- Layout.tsx tem `overflow-auto` no `<main>`
- Conflito de overflow entre containers aninhados bloqueia scroll nativo

**Localização**: 
- `src/components/progress-hub/mobile/ProgressHubMobile.tsx` linha 217-220
- `src/components/Layout.tsx` linha 69

### 3. Sobreposição de Elementos

**Áreas Afetadas**:
- Cards no `MobileSummaryHeader`: Grid 2 colunas sem `min-w-0` causa overflow
- `NextActionsCard` carousel: Items com largura fixa podem vazar
- Tab bar: Botões muito pequenos se aproximando do mínimo

---

## Plano de Correção por Prioridade

### P0 — Crítico (Bloqueia uso)

| ID | Problema | Arquivo | Correção |
|----|----------|---------|----------|
| P0-01 | Erro `useAuth` fora de contexto | `useUserExams.ts` | Adicionar try-catch defensivo ou verificação de contexto |
| P0-02 | Scroll bloqueado no mobile | `ProgressHubMobile.tsx` + `Layout.tsx` | Remover conflito de overflow, usar `overscroll-contain` corretamente |

### P1 — Responsividade e Layout

| ID | Problema | Arquivo | Correção |
|----|----------|---------|----------|
| P1-01 | Grid 2 colunas sem `min-w-0` | `MobileSummaryHeader.tsx` | Adicionar `min-w-0` nas células do grid |
| P1-02 | Carousel vazando largura | `AgoraTab.tsx` | Ajustar `overflow-x-clip` no container pai |
| P1-03 | Botões touch targets pequenos | `MobileTabBar.tsx`, vários | Garantir `min-h-[44px]` em todos os botões interativos |
| P1-04 | Padding inconsistente | `ProgressHubMobile.tsx`, tabs | Padronizar `px-4` e `py-4` em todas as tabs |

### P2 — Polimento Visual

| ID | Problema | Arquivo | Correção |
|----|----------|---------|----------|
| P2-01 | Cards sem sombra consistente | Diversos | Adicionar `shadow-sm` uniformemente |
| P2-02 | Transições abruptas entre tabs | `ProgressHubMobile.tsx` | Suavizar `AnimatePresence` |
| P2-03 | Exam badge cortado | `MobileSummaryHeader.tsx` | Ajustar `truncate` e `flex-shrink-0` |

---

## Detalhamento Técnico

### Correção P0-01: Erro AuthProvider

O hook `useUserExams` precisa de proteção:

```typescript
// src/hooks/useUserExams.ts
export function useUserExams() {
  // Tentar usar o contexto de autenticação de forma segura
  let authContext;
  try {
    authContext = useAuth();
  } catch {
    // Fora do contexto - retornar estado vazio
    return {
      exams: [],
      loading: false,
      error: 'Auth context not available',
      addExam: async () => ({ data: null, error: 'Not authenticated' }),
      removeExam: async () => ({ error: 'Not authenticated' }),
      updateExam: async () => ({ error: 'Not authenticated' }),
      refresh: async () => {},
    };
  }
  
  const { user } = authContext;
  // ... resto do código
}
```

Alternativamente, criar um hook wrapper seguro:

```typescript
// src/hooks/useSafeAuth.ts
export function useSafeAuth() {
  try {
    return useAuth();
  } catch {
    return { user: null, loading: false, logout: async () => {} };
  }
}
```

### Correção P0-02: Scroll Mobile

```typescript
// ProgressHubMobile.tsx - linha 214-220
<div className="min-h-screen bg-background flex flex-col">
  <div 
    ref={scrollContainerRef}
    className="flex-1 overflow-y-auto overscroll-y-contain touch-pan-y pb-28"
    // Removido: overflow-y-auto duplicado, adicionado touch-pan-y
  >
```

```typescript
// Layout.tsx - linha 69
<main className="flex-1 min-w-0 pb-24 md:pb-0">
  {/* Removido overflow-auto para evitar conflito com scroll interno */}
  {children}
</main>
```

### Correção P1-01: Grid com min-w-0

```typescript
// MobileSummaryHeader.tsx - linha 96
<div className="grid grid-cols-2 gap-3 mb-3">
  <div className="min-w-0 bg-card/50 border border-border/50 rounded-xl p-3">
    {/* Conteúdo */}
  </div>
  <div className="min-w-0 bg-card/50 border border-border/50 rounded-xl p-3">
    {/* Conteúdo */}
  </div>
</div>
```

### Correção P1-02: Carousel Container

```typescript
// AgoraTab.tsx - linha 36-42
<div className="relative overflow-x-clip">
  <div 
    className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4"
    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
  >
```

---

## Checklist de Arquivos a Modificar

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/hooks/useUserExams.ts` | Adicionar proteção de contexto |
| `src/components/progress-hub/mobile/ProgressHubMobile.tsx` | Corrigir overflow e scroll |
| `src/components/Layout.tsx` | Remover overflow conflitante do main |
| `src/components/progress-hub/mobile/MobileSummaryHeader.tsx` | Adicionar `min-w-0`, ajustar grid |
| `src/components/progress-hub/mobile/tabs/AgoraTab.tsx` | Ajustar container do carousel |
| `src/components/progress-hub/mobile/MobileTabBar.tsx` | Verificar touch targets |

---

## Testes de Validação

Após implementação, validar:

- [ ] Sem erros no console (`Error: useAuth must be used...`)
- [ ] Scroll vertical funciona em todas as telas mobile
- [ ] Não há overflow horizontal (`scrollWidth === clientWidth`)
- [ ] Todos os botões têm área de toque ≥ 44px
- [ ] Cards não sobrepõem uns aos outros
- [ ] Transição entre tabs é suave
- [ ] Breakpoints 360px, 390px, 430px, 768px funcionam

---

## Notas Adicionais

- O erro de `useAuth` é intermitente e depende do timing do lazy loading
- A estrutura de providers em `App.tsx` está correta (`AuthProvider` envolve tudo)
- O problema específico ocorre quando componentes lazy tentam acessar contexto durante o render inicial do Suspense
