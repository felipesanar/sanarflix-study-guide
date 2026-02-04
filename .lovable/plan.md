
# Plano de Correção: Inconsistências e Duplicações no Calendário de Estudos

## Diagnóstico Executivo

Após auditoria completa do sistema, identifiquei **3 problemas críticos** que causam a inconsistência entre previews e a duplicação de matérias:

### Problemas Encontrados

1. **Race Condition no Salvamento**
   - O `saveToDatabase` faz DELETE + INSERT não-atômico
   - Se duas requisições simultâneas ocorrem (ex: arrasto rápido), ambas podem inserir dados antes que o DELETE da outra execute
   - **Evidência:** No banco há 4 cópias de cada matéria para o mesmo usuário (`c62a7e9a-0da5-4b5b-bf45-44f559ae5d46`)

2. **Dessincronização localStorage vs Banco**
   - O hook carrega localStorage primeiro e sincroniza com banco em background (após 500ms)
   - Se dois dispositivos/abas abrem o app, cada um pode ter localStorage diferente
   - A lógica de merge prioriza dados locais, sobrescrevendo dados do servidor
   - **Evidência:** Preview Lovable e aba separada mostram dados diferentes

3. **Falta de Deduplicação ao Adicionar**
   - O `addSubject` sempre adiciona ao array sem verificar se já existe matéria no mesmo dia
   - Permite arrastar a mesma matéria múltiplas vezes para o mesmo dia

---

## Solução Proposta

### Fase 1: Correção Imediata de Dados

Executar SQL de limpeza para remover duplicatas existentes no banco:
```sql
DELETE FROM calendar_subjects 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM calendar_subjects 
  GROUP BY user_id, name, day_of_week
);
```

### Fase 2: Refatorar `useCalendarSync.ts`

#### 2.1 Adicionar Constraint UNIQUE no Banco
Criar constraint para evitar duplicatas a nível de banco:
```sql
ALTER TABLE calendar_subjects 
ADD CONSTRAINT unique_user_subject_day 
UNIQUE (user_id, name, day_of_week);
```

#### 2.2 Usar UPSERT em vez de DELETE/INSERT
Substituir a lógica de salvamento:

**Atual (problemático):**
```typescript
// DELETE todos + INSERT todos (não atômico)
await supabase.from('calendar_subjects').delete().eq('user_id', user.id);
await supabase.from('calendar_subjects').insert([...]);
```

**Novo (seguro):**
```typescript
// UPSERT atômico com chave única
await supabase.from('calendar_subjects')
  .upsert(subjects.map(...), { 
    onConflict: 'user_id,name,day_of_week',
    ignoreDuplicates: false
  });

// DELETE apenas itens removidos (comparando lista)
await supabase.from('calendar_subjects')
  .delete()
  .eq('user_id', user.id)
  .not('id', 'in', (retainedIds));
```

#### 2.3 Deduplicação no Cliente
Ao adicionar matéria, verificar se já existe:
```typescript
const addSubject = useCallback(async (subject) => {
  // Verificar se já existe no dia
  const exists = subjects.some(
    s => s.name === subject.name && s.dayOfWeek === subject.dayOfWeek
  );
  if (exists) {
    toast.info('Esta matéria já está agendada para este dia');
    return;
  }
  // ... continua salvamento
}, [subjects]);
```

#### 2.4 Priorizar Dados do Servidor
Inverter a lógica de sincronização para evitar dessincronização:
```typescript
// Se ambos têm dados: MESCLAR (não sobrescrever)
// Usar timestamp de atualização mais recente
// Ou: sempre buscar do servidor ao abrir (server-first)
```

### Fase 3: Invalidação de Cache React Query

Implementar invalidação automática ao modificar dados:
```typescript
const queryClient = useQueryClient();

// Após qualquer mutação
queryClient.invalidateQueries({ queryKey: ['calendar-subjects'] });
```

### Fase 4: Realtime Subscription para Sincronização Multi-Aba

Adicionar listener Supabase Realtime para atualizar quando dados mudam:
```typescript
useEffect(() => {
  const channel = supabase
    .channel('calendar-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'calendar_subjects',
      filter: `user_id=eq.${user.id}`
    }, (payload) => {
      // Atualizar estado local
      refetch();
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [user.id]);
```

### Fase 5: Atualizar Documentação

Atualizar `docs/calendar-data-flow.md` removendo referências a `start_time`/`end_time` e documentando nova lógica de sincronização.

---

## Resumo Técnico de Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useCalendarSync.ts` | Refatorar para UPSERT, adicionar deduplicação, implementar realtime |
| `supabase/migrations/` | Criar migration com UNIQUE constraint + limpeza de duplicatas |
| `src/pages/StudyGuide.tsx` | Nenhuma alteração (usa hook corretamente) |
| `docs/calendar-data-flow.md` | Atualizar documentação |

---

## Critérios de Sucesso

- Não há mais duplicatas no banco de dados
- Arrastar mesma matéria para mesmo dia mostra toast informativo (não duplica)
- Abrir app em duas abas mostra mesmo calendário
- Preview Lovable e aba externa mostram dados idênticos
- Nenhum erro no console
