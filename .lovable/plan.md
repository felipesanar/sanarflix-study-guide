
# Plano: Corrigir Celebração de Milestone Para Disparar Apenas em Conquistas Reais

## Problema Identificado

A celebração está aparecendo **toda vez que a página é acessada** porque:

1. O `previousMateriaProgress.current` é um `Map` vazio no primeiro render
2. Para qualquer matéria com progresso >= 25%, o código interpreta que houve um cruzamento de threshold (0 → 25+)
3. A celebração dispara incorretamente como se fosse uma conquista nova

```typescript
// Linha 93 - Problema: prevPercentage é sempre 0 no primeiro load
const prevPercentage = previousMateriaProgress.current.get(materia.materia) || 0;
```

## Solução

Implementar **persistência dos milestones já celebrados** no localStorage para:
1. Lembrar quais milestones cada matéria já celebrou
2. Só disparar celebração quando um milestone **novo** for alcançado
3. Ignorar o primeiro carregamento da página (não comparar com 0)

## Mudanças Técnicas

### 1. Criar chave de localStorage por usuário/semestre

```typescript
// Nova constante para a chave do localStorage
const getMilestoneStorageKey = (userId: string, semestre: number) => 
  `celebrated_milestones_${userId}_${semestre}`;
```

### 2. Carregar milestones já celebrados na inicialização

```typescript
// Estrutura: { "Citologia e Histologia": [25], "Embriologia": [25, 50] }
type CelebratedMilestones = Record<string, MilestoneType[]>;

const [celebratedMilestones, setCelebratedMilestones] = useState<CelebratedMilestones>(() => {
  if (!user?.id || !semestreAtivo) return {};
  try {
    const stored = localStorage.getItem(getMilestoneStorageKey(user.id, semestreAtivo));
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
});
```

### 3. Modificar a lógica de verificação de milestone

```typescript
useEffect(() => {
  if (!data || !user?.id || !semestreAtivo) return;

  const storageKey = getMilestoneStorageKey(user.id, semestreAtivo);
  let updated = false;
  const newCelebrated = { ...celebratedMilestones };

  for (const materia of data.by_materia) {
    const materiaName = materia.materia;
    const currentPercentage = materia.percentage;
    const alreadyCelebrated = newCelebrated[materiaName] || [];

    // Encontrar milestones que foram alcançados mas ainda não celebrados
    for (const threshold of MILESTONE_THRESHOLDS) {
      if (
        currentPercentage >= threshold && 
        !alreadyCelebrated.includes(threshold)
      ) {
        // Marcar como celebrado
        newCelebrated[materiaName] = [...alreadyCelebrated, threshold];
        updated = true;

        // Só mostrar celebração se não foi uma carga inicial silenciosa
        // (verificar se já havia algo salvo para esta matéria)
        if (alreadyCelebrated.length > 0 || threshold === currentPercentage) {
          showCelebration(threshold, materiaName);
          
          trackEvent({
            eventName: 'milestone_achieved',
            category: 'interaction',
            data: { milestone: threshold, materia: materiaName }
          });
        }
        
        break; // Uma celebração por vez
      }
    }
  }

  // Persistir no localStorage
  if (updated) {
    setCelebratedMilestones(newCelebrated);
    localStorage.setItem(storageKey, JSON.stringify(newCelebrated));
  }
}, [data, user?.id, semestreAtivo, celebratedMilestones, showCelebration, trackEvent]);
```

### 4. Remover a ref `previousMateriaProgress` (não mais necessária)

A lógica antiga baseada em comparação com valor anterior será substituída pela verificação de milestones já persistidos.

## Comportamento Esperado

| Cenário | Antes (Bug) | Depois (Correto) |
|---------|-------------|------------------|
| Primeira visita, matéria em 30% | ❌ Mostra "25%" | ✅ Marca como celebrado silenciosamente |
| Usuário completa aula, vai de 24% → 26% | ✅ Mostra "25%" | ✅ Mostra "25%" |
| Revisita página, matéria ainda em 30% | ❌ Mostra "25%" de novo | ✅ Não mostra nada |
| Usuário atinge 50% | ✅ Mostra "50%" | ✅ Mostra "50%" |

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Dashboard.tsx` | Substituir lógica de milestone por persistência com localStorage |

## Fluxo Visual

```text
Primeiro acesso (matéria em 30%):
┌─────────────────────────────────────────────────┐
│ 1. Carrega data da API                          │
│ 2. Verifica: 30% >= 25? SIM                     │
│ 3. Já celebrado 25%? NÃO (primeiro acesso)      │
│ 4. Marca 25% como celebrado no localStorage     │
│ 5. NÃO mostra pop-up (carga inicial silenciosa) │
└─────────────────────────────────────────────────┘

Segundo acesso (usuário completou mais, foi de 30% → 52%):
┌─────────────────────────────────────────────────┐
│ 1. Carrega data da API                          │
│ 2. Verifica: 52% >= 50? SIM                     │
│ 3. Já celebrado 50%? NÃO                        │
│ 4. Já havia algo salvo p/ matéria? SIM (25%)    │
│ 5. MOSTRA pop-up "Metade do caminho!" 🎉        │
│ 6. Marca 50% como celebrado no localStorage     │
└─────────────────────────────────────────────────┘
```

## Considerações

- A celebração só aparece quando há **progressão real** (não na carga inicial)
- Os milestones são persistidos por usuário + semestre
- Limpar localStorage reseta as celebrações (comportamento esperado)
- Funciona em qualquer página se o hook for compartilhado globalmente
