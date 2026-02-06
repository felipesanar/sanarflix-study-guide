

# Plano: Corrigir Métricas de Simulados (Inícios < Conclusões)

## Problema Identificado

A contagem de **Total de Inícios (4)** aparece menor que **Total de Conclusões (6)** porque:

1. **2 finalizações sem início correspondente**: Usuários da Fame têm registros na tabela `simulados_finalizados` mas nenhum em `simulados_iniciados`
2. **1 usuário com múltiplas finalizações**: Um usuário finalizou o mesmo simulado 3 vezes (provavelmente devido a re-liberações ou bugs), mas só conta 1 início

## Solução Proposta

### Opção A: Corrigir a Query (Recomendado)
Garantir consistência lógica na exibição, fazendo **JOIN** entre as tabelas para contar apenas pares válidos (início + fim).

**Arquivo:** `src/hooks/useAnalyticsData.ts`

```typescript
// Em vez de contar separadamente:
// - COUNT(*) FROM simulados_iniciados
// - COUNT(*) FROM simulados_finalizados

// Fazer uma query que conta DISTINCTAMENTE por (user_id, simulado_id):
const totalInicios = new Set(
  iniciadosResult.data?.map(i => `${i.user_id}-${i.simulado_id}`) || []
).size;

const totalFinalizados = new Set(
  finalizadosResult.data?.map(f => `${f.user_id}-${f.simulado_id}`) || []
).size;
```

**E adicionar validação:** Finalizações só contam se existir início correspondente.

### Opção B: Corrigir os Dados no Banco (Complementar)
1. Inserir registros de início faltantes para os 2 usuários órfãos
2. Remover finalizações duplicadas (manter apenas a mais recente)

```sql
-- Inserir inícios faltantes
INSERT INTO simulados_iniciados (user_id, simulado_id, started_at)
SELECT sf.user_id, sf.simulado_id, sf.finalizado_em - INTERVAL '30 minutes'
FROM simulados_finalizados sf
WHERE NOT EXISTS (
  SELECT 1 FROM simulados_iniciados si 
  WHERE si.user_id = sf.user_id AND si.simulado_id = sf.simulado_id
);

-- Remover finalizações duplicadas (manter mais recente)
DELETE FROM simulados_finalizados sf1
WHERE EXISTS (
  SELECT 1 FROM simulados_finalizados sf2 
  WHERE sf2.user_id = sf1.user_id 
  AND sf2.simulado_id = sf1.simulado_id
  AND sf2.finalizado_em > sf1.finalizado_em
);
```

## Mudanças no Código

### 1. Atualizar fetchSimuladoMetrics

**Arquivo:** `src/hooks/useAnalyticsData.ts`

- Adicionar `user_id` ao SELECT de iniciados e finalizados
- Usar `Set` para contar pares únicos (user_id + simulado_id)
- Garantir que finalizados só contam se tiver início correspondente

### 2. Adicionar Warning de Integridade (Opcional)

Na UI, quando detectar inconsistência (finalizados > iniciados para algum simulado), exibir um ícone de warning explicativo.

## Detalhes Técnicos

```text
ANTES (Contagem simples)
┌─────────────────────┬────────────────────┐
│ simulados_iniciados │ COUNT(*) = 111     │
├─────────────────────┼────────────────────┤
│ simulados_finalizados│ COUNT(*) = 115    │
└─────────────────────┴────────────────────┘
Problema: 115 > 111 (impossível logicamente)

DEPOIS (Contagem com validação)
┌──────────────────────────────────────────┐
│ SELECT DISTINCT (user_id, simulado_id)   │
│ FROM simulados_iniciados                 │
│ = 111 pares únicos                       │
├──────────────────────────────────────────┤
│ SELECT DISTINCT (user_id, simulado_id)   │
│ FROM simulados_finalizados               │
│ WHERE EXISTS (início correspondente)     │
│ = máximo 111 pares válidos               │
└──────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useAnalyticsData.ts` | Corrigir lógica de contagem com DISTINCT e validação de pares |

## Critérios de Sucesso

- [ ] Total de Conclusões nunca ultrapassa Total de Inícios
- [ ] Métricas refletem pares únicos (user_id + simulado_id)
- [ ] Dados duplicados ou órfãos não distorcem as estatísticas

