
# Plano: Corrigir Vazamento de Dados de Desempenho Não Liberado

## Problema Identificado

O sistema de liberação de desempenho tem uma falha de segurança/consistência onde dados de simulados com desempenho **ainda não liberado** estão sendo exibidos de três formas:

| Local | Bug | Causa Raiz |
|-------|-----|------------|
| **Visão Geral** | Conta questões e porcentagem de simulados não liberados | Função RPC `get_user_performance_aggregates` não filtra por `liberacao_desempenho` quando `p_simulado_id` é NULL |
| **Gráfico de Evolução** | Mostra barras de simulados não liberados | Função RPC `get_all_user_performance_by_area` não filtra por `liberacao_desempenho` |
| **Dropdown inconsistente** | Ao alternar de um simulado específico, aparecem simulados não liberados | Cache do sessionStorage contém simulados não liberados de chamadas anteriores |

### Simulado Afetado (exemplo encontrado)
- **Nome**: `[CLARETIANO TESTE] 2_Simulado_2026 (1)`
- **liberacao_desempenho**: `ao_encerrar`
- **data_encerramento**: `NULL` (ainda não encerrado)
- **Resultado esperado**: Desempenho NÃO deveria aparecer

---

## Solução Proposta

### Alteração 1: Função RPC `get_user_performance_aggregates`

Adicionar filtro de `liberacao_desempenho` no JOIN com `simulados_admin` para excluir dados de simulados não liberados:

```sql
-- Adicionar JOIN com simulados_admin e filtro de liberação
-- No CTE user_answers, adicionar condição que verifica:
-- 1. liberacao_desempenho = 'imediato' OU
-- 2. liberacao_desempenho = 'agendado' E data_liberacao_desempenho <= NOW() OU
-- 3. liberacao_desempenho = 'ao_encerrar' E (status = 'encerrado' OU data_encerramento <= NOW())
```

**Impacto**: A Visão Geral passará a mostrar apenas dados de simulados com desempenho efetivamente liberado.

---

### Alteração 2: Função RPC `get_all_user_performance_by_area`

Adicionar o mesmo filtro de liberação:

```sql
-- Adicionar condição WHERE que verifica:
-- 1. liberacao_desempenho = 'imediato' OU
-- 2. liberacao_desempenho = 'agendado' E data_liberacao_desempenho <= NOW() OU  
-- 3. liberacao_desempenho = 'ao_encerrar' E (status = 'encerrado' OU data_encerramento <= NOW())
```

**Impacto**: O gráfico de evolução só mostrará simulados com desempenho liberado.

---

### Alteração 3: Limpeza de Cache no Frontend

Modificar `SimuladoDesempenho.tsx` para invalidar cache quando a lista de simulados mudar (evita inconsistências no dropdown):

```typescript
// Ao detectar que simulados disponíveis mudaram,
// limpar caches antigos que podem conter dados inconsistentes
```

---

## Arquivos a Modificar

| Arquivo | Tipo | Alteração |
|---------|------|-----------|
| Migração SQL (nova) | Banco | Atualizar função `get_user_performance_aggregates` |
| Migração SQL (nova) | Banco | Atualizar função `get_all_user_performance_by_area` |
| `src/pages/SimuladoDesempenho.tsx` | Frontend | Invalidar cache quando lista de simulados mudar |

---

## Resultado Esperado

1. **Visão Geral**: Mostrará apenas questões de simulados com desempenho liberado
2. **Dropdown**: Exibirá apenas simulados com desempenho liberado (já funciona via `get_user_simulados`)
3. **Gráfico de Evolução**: Mostrará apenas barras de simulados com desempenho liberado
4. **Consistência total**: Todas as métricas, rankings e agregações respeitarão a configuração de liberação

---

## Seção Técnica

### Nova lógica de filtro (reutilizada em ambas as funções)

```sql
JOIN simulados_admin sa ON ap.simulado = sa.id
WHERE ...
  AND (
    sa.liberacao_desempenho = 'imediato'
    OR (sa.liberacao_desempenho = 'agendado' 
        AND sa.data_liberacao_desempenho IS NOT NULL 
        AND sa.data_liberacao_desempenho <= NOW())
    OR (sa.liberacao_desempenho = 'ao_encerrar' 
        AND (sa.status = 'encerrado' 
             OR (sa.data_encerramento IS NOT NULL 
                 AND sa.data_encerramento <= NOW())))
  )
```

### get_user_performance_aggregates - Versão Corrigida

```sql
CREATE OR REPLACE FUNCTION public.get_user_performance_aggregates(p_simulado_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH user_answers AS (
    SELECT 
      ap.question_id,
      ap.correct,
      q.grande_area as area_name,
      q.especialidade as specialty_name,
      q.tema as subspecialty_name,
      CASE 
        WHEN LOWER(TRIM(q.grau_dificuldade)) IN ('fácil', 'facil') THEN 'Fácil'
        WHEN LOWER(TRIM(q.grau_dificuldade)) IN ('médio', 'medio', 'moderado', 'fácil/médio') THEN 'Médio'
        WHEN LOWER(TRIM(q.grau_dificuldade)) IN ('difícil', 'dificil') THEN 'Difícil'
        ELSE COALESCE(TRIM(q.grau_dificuldade), 'Médio')
      END as difficulty
    FROM answer_progress ap
    JOIN questoes_simulado q ON ap.question_id = q.id
    JOIN simulados_admin sa ON ap.simulado = sa.id
    WHERE ap.user_id = auth.uid()
      AND (p_simulado_id IS NULL OR ap.simulado = p_simulado_id)
      -- NOVO: Filtro de liberação de desempenho
      AND (
        sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado' 
            AND sa.data_liberacao_desempenho IS NOT NULL 
            AND sa.data_liberacao_desempenho <= NOW())
        OR (sa.liberacao_desempenho = 'ao_encerrar' 
            AND (sa.status = 'encerrado' 
                 OR (sa.data_encerramento IS NOT NULL 
                     AND sa.data_encerramento <= NOW())))
      )
  )
  SELECT json_build_object(
    'overallStats', (
      SELECT json_build_object(
        'total', COUNT(*),
        'acertos', COUNT(*) FILTER (WHERE correct = true)
      )
      FROM user_answers
    ),
    'byArea', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          area_name as name,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE correct = true) as acertos
        FROM user_answers
        WHERE area_name IS NOT NULL
        GROUP BY area_name
        ORDER BY area_name
      ) t
    ),
    'bySpecialty', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          specialty_name as name,
          area_name,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE correct = true) as acertos
        FROM user_answers
        WHERE specialty_name IS NOT NULL
        GROUP BY specialty_name, area_name
        ORDER BY specialty_name
      ) t
    ),
    'bySubspecialty', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          subspecialty_name as name,
          specialty_name,
          area_name,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE correct = true) as acertos
        FROM user_answers
        WHERE subspecialty_name IS NOT NULL
        GROUP BY subspecialty_name, specialty_name, area_name
        ORDER BY subspecialty_name
      ) t
    ),
    'byDifficulty', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          difficulty as name,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE correct = true) as acertos
        FROM user_answers
        WHERE difficulty IS NOT NULL
        GROUP BY difficulty
        ORDER BY 
          CASE difficulty 
            WHEN 'Fácil' THEN 1 
            WHEN 'Médio' THEN 2 
            WHEN 'Difícil' THEN 3 
            ELSE 4 
          END
      ) t
    )
  ) INTO result;
  
  RETURN result;
END;
$$;
```

### get_all_user_performance_by_area - Versão Corrigida

```sql
CREATE OR REPLACE FUNCTION public.get_all_user_performance_by_area()
RETURNS TABLE (
  simulado_id uuid,
  simulado_nome text,
  area_name text,
  total bigint,
  acertos bigint
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.simulado as simulado_id,
    sa.nome as simulado_nome,
    q."grande_area" as area_name,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE ap.correct = true) as acertos
  FROM answer_progress ap
  JOIN questoes_simulado q ON ap.question_id = q."id"
  JOIN simulados_admin sa ON ap.simulado = sa.id
  WHERE ap.user_id = auth.uid()
    AND q."grande_area" IS NOT NULL
    -- NOVO: Filtro de liberação de desempenho
    AND (
      sa.liberacao_desempenho = 'imediato'
      OR (sa.liberacao_desempenho = 'agendado' 
          AND sa.data_liberacao_desempenho IS NOT NULL 
          AND sa.data_liberacao_desempenho <= NOW())
      OR (sa.liberacao_desempenho = 'ao_encerrar' 
          AND (sa.status = 'encerrado' 
               OR (sa.data_encerramento IS NOT NULL 
                   AND sa.data_encerramento <= NOW())))
    )
  GROUP BY ap.simulado, sa.nome, q."grande_area"
  ORDER BY ap.simulado, q."grande_area";
END;
$$;
```

### Limpeza de Cache no Frontend

```typescript
// Em SimuladoDesempenho.tsx, adicionar lógica para:
// 1. Comparar lista atual de simulados com versão anterior
// 2. Se houver diferença, limpar caches de performance antigos
// 3. Isso evita que dados em cache de simulados agora filtrados persistam
```
