
# Plano: Suporte a Multiplas Tentativas de Simulado

## Problema Identificado

O erro `duplicate key value violates unique constraint "simulados_finalizados_user_id_simulado_id_key"` ocorre porque a tabela `simulados_finalizados` possui uma constraint:

```sql
UNIQUE(user_id, simulado_id)
```

Isso impede que um mesmo usuario tenha mais de um registro para o mesmo simulado, mesmo em tentativas diferentes.

---

## Solucao

### 1. Migracao de Banco de Dados

Criar nova migracao para:

**a) Remover a constraint unica antiga:**
```sql
ALTER TABLE public.simulados_finalizados 
DROP CONSTRAINT IF EXISTS simulados_finalizados_user_id_simulado_id_key;
```

**b) Criar nova constraint que permite multiplas tentativas:**
```sql
ALTER TABLE public.simulados_finalizados 
ADD CONSTRAINT simulados_finalizados_unique_tentativa 
UNIQUE(user_id, simulado_id, tentativa_numero);
```

**c) Adicionar indice para performance:**
```sql
CREATE INDEX IF NOT EXISTS idx_simulados_finalizados_tentativa 
ON public.simulados_finalizados(user_id, simulado_id, tentativa_numero DESC);
```

---

### 2. Ajuste na Edge Function `corrigir-simulado`

Simplificar a logica de finalizacao:

- **Sempre fazer INSERT** de um novo registro para cada tentativa
- Remover a logica condicional de UPDATE vs INSERT
- Manter a verificacao de idempotencia (se ja existe tentativa com mesmo numero, ignorar)
- Calcular `proximaTentativa` baseado no maior `tentativa_numero` existente + 1

**Fluxo atualizado:**
```text
1. Buscar maior tentativa_numero existente para user_id + simulado_id
2. Se existe tentativa E nao foi liberado_novamente:
   - Se ja existem respostas -> retornar "ja processado" (idempotencia)
3. Se existe tentativa E foi liberado_novamente:
   - Mover respostas antigas para historico
   - Marcar tentativa antiga como liberado_novamente=false
   - Calcular proximaTentativa = max(tentativa_numero) + 1
4. Se nao existe nenhuma tentativa:
   - proximaTentativa = 1
5. Sempre INSERT novo registro com tentativa_numero correto
```

---

### 3. Verificacao de Progresso (Sem Alteracao)

A funcao `verificarProgressoSimulado` em `simuladosApi.ts` ja esta preparada pois:
- Busca o registro com `order('tentativa_numero', { ascending: false })`
- Usa `limit(1)` para pegar apenas o mais recente
- Verifica `liberado_novamente` para determinar se pode fazer nova tentativa

---

## Arquivos a Modificar

1. **Nova migracao SQL** - Remove constraint antiga, adiciona nova
2. **supabase/functions/corrigir-simulado/index.ts** - Simplifica para sempre INSERT

---

## Beneficios

- Historico completo de todas as tentativas
- Cada tentativa tem seu proprio registro com:
  - `tentativa_numero` (1, 2, 3...)
  - `tempo_total_segundos`
  - `saidas_de_aba`
  - `saidas_de_fullscreen`
  - `finalizado_em`
- Consultas de desempenho podem agregar dados por tentativa
- Admin pode visualizar evolucao do aluno entre tentativas

---

## Estrutura de Dados Resultante

```text
simulados_finalizados:
+--------------------------------------+--------------------------------------+---+------------+-------+
| user_id                              | simulado_id                          | n | tempo      | saidas|
+--------------------------------------+--------------------------------------+---+------------+-------+
| abc123...                            | sim001...                            | 1 | 3600       | 2     |
| abc123...                            | sim001...                            | 2 | 3400       | 0     |
| abc123...                            | sim002...                            | 1 | 2800       | 1     |
+--------------------------------------+--------------------------------------+---+------------+-------+
```
