

# Auditoria do Dropdown de Simulados — Resultados

## Diagnóstico: Nenhum bug de código encontrado. O problema é de dados/configuração.

### Evidências da Auditoria

**Dados reais no banco** — Simulados por IES:

```text
IES "Claretiano" (6029b69d):
  1. "1° Simulado Claretiano 2026" → status=ativo, liberacao=imediato ✅ APARECE
  2. "Simulado 3 ENAMED"          → status=aguardando, liberacao=ao_encerrar ❌ FILTRADO

IES "B2B" (9f21b138):
  1. "Simulado Teste"                    → status=ativo, liberacao=imediato ✅
  2. "2º Simulado Claretiano"            → status=ativo, liberacao=imediato ✅
  3. "[CLARETIANO] 1_Simulado_2026 (4)"  → status=ativo, liberacao=imediato ✅
  4. "Teste Gabarito 2"                  → status=ativo, liberacao=imediato ✅
  5. "TESTE GABARITO"                    → status=encerrado, liberacao=imediato ✅
  6. "Teste Gabarito Simulado"           → status=encerrado, liberacao=imediato ✅
```

**Resultado**: A IES "Claretiano" realmente só tem **1 simulado elegível** no dropdown. O segundo ("Simulado 3 ENAMED") está com `status='aguardando'` e `liberacao_desempenho='ao_encerrar'`, então a RPC o exclui corretamente.

### Verificação do Código

**RPC `get_institutional_simulados`** — Filtros aplicados:
- `v_ies_id = ANY(sa.ies_ids)` — correto, filtra por IES
- `sa.status IN ('ativo', 'encerrado')` — correto, exclui 'aguardando'
- Condições de liberação de desempenho — corretas
- **Nenhum `LIMIT`** encontrado
- **Nenhum filtro por data** que restrinja artificialmente

**Hook `useInstitutionalPerformanceData.ts`** — Populamento do dropdown:
- Chama a RPC sem LIMIT
- Mapeia todos os resultados para o estado `simulados`
- Auto-seleciona o primeiro como padrão (correto)
- **Nenhuma restrição adicional no frontend**

### Causa raiz

A impressão de "faltam simulados" vem de:
1. O "Simulado 3 ENAMED" está com `status='aguardando'` — precisa ser alterado para `'ativo'` no admin
2. Os simulados com nome "Claretiano" na IES "B2B" (`9f21b138`) estão atribuídos à IES errada — deveriam estar na IES "Claretiano" (`6029b69d`)?

### Ação necessária (dados, não código)

Nenhuma alteração de código é necessária. As ações são:

1. **Se "Simulado 3 ENAMED" deve aparecer**: alterar seu status de `'aguardando'` para `'ativo'` via Portal Admin
2. **Se os simulados da IES "B2B" pertencem ao Claretiano**: atualizar o `ies_ids` desses simulados para incluir `6029b69d-a2ef-4de5-b907-91f88122bb4e`

### Resumo

| Verificação | Resultado |
|---|---|
| LIMIT 1 na query? | Não encontrado |
| Filtro por data restritivo? | Não encontrado |
| Frontend descarta resultados? | Não |
| RPC retorna todos os elegíveis? | Sim |
| Divergência backend vs UI? | Não — ambos mostram 1 simulado para Claretiano porque só 1 é elegível |

