

# Controle de Liberacao de Desempenho de Simulados

## Resumo

Implementar um sistema de controle para quando o desempenho dos simulados sera liberado para os alunos visualizarem. O administrador podera escolher entre:
1. Liberar imediatamente (assim que o aluno finalizar)
2. Liberar em data/hora especifica
3. Liberar automaticamente quando o simulado encerrar

## Alteracoes no Banco de Dados

### Nova Coluna na Tabela `simulados_admin`

| Campo | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `liberacao_desempenho` | text | 'imediato' | Tipo de liberacao: 'imediato', 'agendado', 'ao_encerrar' |
| `data_liberacao_desempenho` | timestamp with time zone | null | Data/hora de liberacao (usado quando tipo = 'agendado') |

### Migracao SQL

```sql
ALTER TABLE simulados_admin 
ADD COLUMN liberacao_desempenho text NOT NULL DEFAULT 'imediato',
ADD COLUMN data_liberacao_desempenho timestamp with time zone DEFAULT null;
```

---

## Logica de Liberacao

| Tipo | Condicao para Liberar | Comportamento |
|------|----------------------|---------------|
| `imediato` | Sempre | Desempenho disponivel assim que finalizar |
| `agendado` | `NOW() >= data_liberacao_desempenho` | Desempenho liberado na data/hora especificada |
| `ao_encerrar` | `status = 'encerrado'` OU `NOW() >= data_encerramento` | Desempenho liberado quando simulado encerra |

---

## Alteracoes na Interface Admin

### Arquivo: `src/components/admin/SimuladosTab.tsx`

**1. Atualizar Estado do Formulario**

Adicionar novos campos ao `configForm`:

```typescript
const [configForm, setConfigForm] = useState({
  // ... campos existentes ...
  liberacao_desempenho: 'imediato' as 'imediato' | 'agendado' | 'ao_encerrar',
  data_liberacao_desempenho: ''
});
```

**2. Adicionar Secao no Modal de Configuracao**

Apos o campo "Duracao da Prova", adicionar nova secao:

```text
+--------------------------------------------------+
| Liberacao do Desempenho                          |
+--------------------------------------------------+
| [Selector: Liberar desempenho]                   |
|   - Imediatamente (ao finalizar)                 |
|   - Em data especifica                           |
|   - Quando encerrar o simulado                   |
|                                                  |
| (Se "Em data especifica" selecionado:)           |
| [Input datetime-local: Data de liberacao]        |
|                                                  |
| (Se "Quando encerrar" selecionado:)              |
| [Checkbox] Liberar quando o simulado encerrar    |
|   O desempenho sera liberado automaticamente     |
|   quando o status mudar para "encerrado"         |
+--------------------------------------------------+
```

**3. Atualizar Funcao `handleSaveSimulado`**

Incluir os novos campos no INSERT/UPDATE:

```typescript
{
  // ... campos existentes ...
  liberacao_desempenho: configForm.liberacao_desempenho,
  data_liberacao_desempenho: configForm.liberacao_desempenho === 'agendado' 
    ? datetimeLocalToBrazilISO(configForm.data_liberacao_desempenho)
    : null
}
```

**4. Atualizar Funcao `handleEditSimulado`**

Carregar os novos campos ao editar simulado existente.

---

## Alteracoes na API e RPC

### Arquivo: `get_user_simulados` (Funcao RPC)

Modificar para retornar apenas simulados com desempenho liberado:

```sql
CREATE OR REPLACE FUNCTION public.get_user_simulados()
RETURNS TABLE(id uuid, nome text)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT 
    ap.simulado as id,
    sa.nome
  FROM answer_progress ap
  JOIN simulados_admin sa ON ap.simulado = sa.id
  WHERE ap.user_id = auth.uid()
    AND (
      -- Liberacao imediata
      sa.liberacao_desempenho = 'imediato'
      -- Ou liberacao agendada e ja passou a data
      OR (sa.liberacao_desempenho = 'agendado' 
          AND sa.data_liberacao_desempenho IS NOT NULL 
          AND sa.data_liberacao_desempenho <= NOW())
      -- Ou liberacao ao encerrar e simulado ja encerrou
      OR (sa.liberacao_desempenho = 'ao_encerrar' 
          AND (sa.status = 'encerrado' 
               OR (sa.data_encerramento IS NOT NULL 
                   AND sa.data_encerramento <= NOW())))
    )
  ORDER BY sa.nome;
END;
$$;
```

---

## Alteracoes no Frontend do Aluno

### Arquivo: `src/components/simulados/SimuladoCard.tsx`

Modificar o estado `concluido` para verificar se o desempenho esta liberado:

| Status | Texto do Botao | Comportamento |
|--------|----------------|---------------|
| Concluido + Liberado | "Ver Desempenho" | Leva para aba de desempenho |
| Concluido + Nao Liberado | "Aguarde Liberacao" | Desabilitado, mostra quando sera liberado |

### Arquivo: `src/types/simulado.ts`

Adicionar novos campos ao tipo `Simulado`:

```typescript
export interface Simulado {
  // ... campos existentes ...
  liberacao_desempenho?: 'imediato' | 'agendado' | 'ao_encerrar';
  data_liberacao_desempenho?: string | null;
  desempenho_liberado?: boolean; // Calculado no frontend
}
```

### Arquivo: `src/components/simulados/SimuladosDisponiveis.tsx`

Atualizar `carregarSimulados` para buscar os novos campos e calcular se o desempenho esta liberado:

```typescript
const verificarDesempenhoLiberado = (sim: any): boolean => {
  if (sim.liberacao_desempenho === 'imediato') return true;
  if (sim.liberacao_desempenho === 'agendado' && sim.data_liberacao_desempenho) {
    return new Date() >= new Date(sim.data_liberacao_desempenho);
  }
  if (sim.liberacao_desempenho === 'ao_encerrar') {
    return sim.status === 'encerrado' || 
           (sim.data_encerramento && new Date() >= new Date(sim.data_encerramento));
  }
  return true; // Fallback para simulados antigos
};
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/migrations/...` | Adicionar colunas ao banco |
| `src/integrations/supabase/types.ts` | Atualizar tipos gerados |
| `src/components/admin/SimuladosTab.tsx` | Adicionar campos de configuracao |
| `src/types/simulado.ts` | Adicionar novos campos |
| `src/components/simulados/SimuladosDisponiveis.tsx` | Verificar se desempenho esta liberado |
| `src/components/simulados/SimuladoCard.tsx` | Exibir estado correto do botao |
| `src/services/simuladosApi.ts` | Buscar novos campos |

---

## Fluxo do Aluno

```text
Aluno finaliza simulado
        |
        v
Sistema verifica tipo de liberacao
        |
        +-- imediato --> Desempenho disponivel agora
        |
        +-- agendado --> Verifica se NOW() >= data_liberacao_desempenho
        |                 |
        |                 +-- Sim --> Desempenho disponivel
        |                 +-- Nao --> "Aguarde liberacao em DD/MM/AAAA HH:MM"
        |
        +-- ao_encerrar --> Verifica se simulado encerrou
                            |
                            +-- Sim --> Desempenho disponivel
                            +-- Nao --> "Aguarde o encerramento do simulado"
```

---

## Interface Visual do Admin

```text
Liberacao do Desempenho
-----------------------
( ) Liberar imediatamente
    O aluno pode ver o desempenho assim que finalizar.

( ) Liberar em data especifica
    [___________] Data e hora
    O desempenho sera liberado na data/hora definida.

( ) Liberar quando encerrar
    O desempenho sera liberado automaticamente quando
    o simulado mudar para status "encerrado".
```

---

## Compatibilidade com Simulados Existentes

- Simulados sem os novos campos terao comportamento `imediato` por default
- A migracao define `liberacao_desempenho = 'imediato'` como padrao
- Nenhum simulado existente tera seu comportamento alterado

