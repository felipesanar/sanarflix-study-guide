
# Plano de Correção: Tag Duplicada e Toast ao Arrastar

## Problemas Identificados

### 1. Tag de Categoria Duplicada
No arquivo `src/components/calendar/DayColumnCard.tsx`, o Badge de categoria está sendo renderizado **duas vezes** no modo "full card" (quando `isCompact = false`):
- Primeira renderização: linhas 114-122 (fora do flex container)
- Segunda renderização: linhas 126-134 (dentro do flex container)

Isso causa a visualização duplicada como "GERAL / GERAL" que aparece na imagem.

### 2. Toast Excessivo ao Arrastar
Há dois toasts sendo disparados:
- `useCalendarSync.ts` linha 236: `toast.success('Matérias salvas com sucesso!')`
- `StudyGuide.tsx` linhas 250-254: `toast({ title: "Matéria adicionada"... })`

Isso resulta em duas notificações a cada vez que o usuário arrasta uma matéria.

### 3. Comportamento de Auto-Save
Atualmente, as matérias **são salvas automaticamente** ao arrastar e soltar porque:
- `onAddEvent` -> `addEventToCalendar` -> `addSubject` -> `saveSubjects` -> Upsert no banco

---

## Solução Proposta

### Correção 1: Remover Badge Duplicado

Modificar `src/components/calendar/DayColumnCard.tsx`:
- Remover o primeiro Badge (linhas 113-122) que está fora do flex container
- Manter apenas o Badge dentro do flex container

### Correção 2: Remover Toast do Hook

Modificar `src/hooks/useCalendarSync.ts`:
- Remover o `toast.success('Matérias salvas com sucesso!')` da linha 236
- Remover também o `toast.success('Matérias salvas localmente')` da linha 238
- Manter apenas o toast de erro em caso de falha
- O feedback ao usuário será dado pelo toast individual de cada ação (se desejado) ou pela UI

O salvamento automático está correto para garantir sincronização multi-aba e persistência. A remoção do toast elimina a notificação repetitiva.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/calendar/DayColumnCard.tsx` | Remover Badge duplicado (linhas 113-122) |
| `src/hooks/useCalendarSync.ts` | Remover toasts de sucesso do salvamento |
| `src/pages/StudyGuide.tsx` | Opcionalmente, remover toast de "Matéria adicionada" para experiência mais limpa |

---

## Resultado Esperado

- Cada card terá apenas UMA tag de categoria
- Nenhum toast "Matérias salvas com sucesso" ao arrastar
- Mantém toast de erro caso falhe sincronização
- Salvamento automático permanece funcionando (para sync multi-aba)
