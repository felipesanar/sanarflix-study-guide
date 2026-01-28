
# Plano: Corrigir Carregamento para Usuários com Semestre 0

## Problema Identificado
O valor `0` em JavaScript é considerado **falsy**. Quando `user.semestre === 0`, as condições como `if (user.semestre)` avaliam como `false`, impedindo o carregamento dos dados.

### Locais Afetados
1. **`src/contexts/StudyContext.tsx`** (crítico)
   - Linha 22: `if (user && user.id_ies && user.semestre)`
   - Linha 28: `if (!user || !user.id_ies || !user.semestre) return;`

2. **`src/pages/StudyGuide.tsx`** (menor impacto)
   - Linha 369: `if (user.semestre)`

---

## Solução Técnica

### 1. Corrigir StudyContext.tsx
Alterar as verificações para usar `!== null && !== undefined` ou `typeof === 'number'`:

```typescript
// Linha 22 - ANTES
if (user && user.id_ies && user.semestre) {

// DEPOIS
if (user && user.id_ies && typeof user.semestre === 'number') {
```

```typescript
// Linha 28 - ANTES
if (!user || !user.id_ies || !user.semestre) return;

// DEPOIS
if (!user || !user.id_ies || typeof user.semestre !== 'number') return;
```

### 2. Corrigir StudyGuide.tsx
```typescript
// Linha 369 - ANTES
if (user.semestre) {

// DEPOIS
if (typeof user.semestre === 'number') {
```

---

## Arquivos a Modificar
| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| `src/contexts/StudyContext.tsx` | 22, 28 | Verificação de semestre no carregamento |
| `src/pages/StudyGuide.tsx` | 369 | Auto-seleção de semestre |

---

## Resultado Esperado
- Usuários da FAME com `semestre = 0` conseguirão carregar o Guia de Estudos
- SanarClass já funciona (só valida `id_ies`)
- Não haverá regressão para usuários com semestres > 0
