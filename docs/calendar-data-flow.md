# Fluxo de Dados do Calendário

Este documento explica como os dados do calendário são salvos e recuperados no sistema.

## 📊 Estrutura de Dados

### Tabelas no Banco de Dados

#### 1. `calendar_subjects`
Armazena as matérias configuradas pelo usuário no calendário semanal.

**Campos:**
- `id` (UUID): Identificador único
- `user_id` (UUID): ID do usuário
- `name` (text): Nome da matéria
- `color` (text): Cor da matéria (hex)
- `day_of_week` (integer): Dia da semana (0-6, onde 0 = Domingo)
- `created_at` (timestamp): Data de criação
- `updated_at` (timestamp): Data de atualização

**Constraint UNIQUE:** `(user_id, name, day_of_week)` - garante que não há duplicatas

**Usado em:** 
- Card "O Que Estudar Hoje" na Home
- **Guia de Estudos** (`/guia-estudos`) - modo calendário

#### 2. `calendar_arrangements`
Armazena os rearranjos personalizados do cronograma ENAMED (quando o usuário move itens no modo de edição).

**Campos:**
- `id` (UUID): Identificador único
- `user_id` (UUID): ID do usuário
- `item_key` (text): Chave única do item do cronograma
- `week` (text): Semana (ex: "Semana 1")
- `day` (text): Dia da semana (ex: "Segunda")
- `position` (integer): Posição do item no dia
- `created_at` (timestamp): Data de criação
- `updated_at` (timestamp): Data de atualização

**Usado em:** Cronograma ENAMED (modo de edição premium)

## 🔄 Fluxo de Salvamento

### 1. Calendar Subjects (Calendário Pessoal)

**Hook Responsável:** `src/hooks/useCalendarSync.ts`

**Arquitetura: SERVER-FIRST**
O sistema prioriza dados do servidor como fonte de verdade, com localStorage apenas como cache.

**Fluxo de Inicialização:**
1. Se usuário autenticado: buscar dados do servidor (Supabase)
2. Atualizar estado React e localStorage
3. Se não autenticado: usar localStorage como fallback

**Fluxo de Salvamento (UPSERT Atômico):**
```typescript
// 1. Update otimista (UI + localStorage)
setSubjects(newSubjects);
saveToLocalStorage(newSubjects);

// 2. UPSERT no banco (atômico, evita race conditions)
await supabase.from('calendar_subjects')
  .upsert(subjects, { 
    onConflict: 'user_id,name,day_of_week',
    ignoreDuplicates: false 
  });

// 3. DELETE de itens removidos
await supabase.from('calendar_subjects')
  .delete()
  .in('id', idsToDelete);
```

**Deduplicação no Cliente:**
```typescript
const addSubject = async (subject) => {
  const exists = subjects.some(
    s => s.name === subject.name && s.dayOfWeek === subject.dayOfWeek
  );
  if (exists) {
    toast.info('Esta matéria já está agendada para este dia');
    return;
  }
  // ... continua salvamento
};
```

**Sincronização Multi-Aba (Realtime):**
```typescript
supabase
  .channel('calendar-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'calendar_subjects',
    filter: `user_id=eq.${user.id}`
  }, () => {
    // Recarregar dados do servidor
    refetch();
  })
  .subscribe();
```

**Onde é usado:**
- **Guia de Estudos** (`/guia-estudos`) - modo calendário (arrastar matérias para dias)
- Card "Meu Dia" na Home (busca matérias do dia)

### 2. Calendar Arrangements (Rearranjos do Cronograma)

**Edge Function Responsável:** `supabase/functions/save-calendar-arrangement/index.ts`

**Fluxo:**
1. **Modo de Edição:**
   - Usuário arrasta e solta itens no calendário
   - Alterações ficam em estado temporário (`tempCalendarEvents`)

2. **Salvamento:**
   ```typescript
   handleSaveChanges()
   ```
   - Envia arranjos para edge function
   - Edge function deleta arranjos anteriores
   - Insere novos arranjos em batch

3. **Recuperação:**
   - Ao carregar CalendarView, busca arranjos salvos
   - Aplica arranjos aos items do cronograma
   - Mantém posicionamento personalizado

## 📍 Card "Meu Dia" - Hierarquia de Fontes

O card "Meu Dia" na Home exibe as atividades do dia seguindo esta ordem de prioridade:

### 1. **Calendário Pessoal** (Prioridade Alta)
- Fonte: Tabela `calendar_subjects`
- Badge: 🟢 "Meu Calendário" (verde)
- Busca matérias agendadas para o dia da semana atual
- Para cada matéria, sugere uma aula não concluída do Guia de Estudos

### 2. **Rearranjos Personalizados** (Fallback Secundário)
- Fonte: Tabela `calendar_arrangements`
- Usado quando não há dados em `calendar_subjects`
- Mantém compatibilidade com versões anteriores

### 3. **Cronograma ENAMED** (Fallback Terciário)
- Fonte: API Externa (cronogramaEnamedApi)
- Badge: 🟣 "Cronograma ENAMED" (roxo)
- Filtra por data atual (formato DD/MM)
- Para cada item, busca aulas do Guia de Estudos relacionadas
- Fallback: Se não encontrar por data, usa semana atual
- Fallback final: Primeiros 3 itens do cronograma

### 4. **Intensivo e Simulado** (Fallback Final)
- Exibidos apenas quando não há matérias do dia
- Sem badge de origem

## 🎯 Indicadores Visuais de Origem

Cada item no "Meu Dia" mostra sua origem através de badges:

- **Verde (Meu Calendário):** 
  - Ícone: CalendarCheck
  - Matéria agendada pelo usuário no calendário pessoal
  - Dados mais confiáveis e personalizados

- **Roxo (Cronograma ENAMED):** 
  - Ícone: FileText
  - Matéria do cronograma institucional
  - Usado quando não há configuração pessoal

- **Sem badge:**
  - Intensivo ou Simulado (fallback geral)

## 🔍 Como Verificar os Dados

### Verificar Calendar Subjects
```sql
SELECT * FROM calendar_subjects 
WHERE user_id = '[USER_ID]' 
ORDER BY day_of_week, name;
```

### Verificar Calendar Arrangements
```sql
SELECT * FROM calendar_arrangements 
WHERE user_id = '[USER_ID]' 
ORDER BY week, day, position;
```

### Verificar no Console do Navegador
```javascript
// Dados salvos no localStorage
localStorage.getItem('user_calendar_subjects')
```

## 🐛 Troubleshooting

### "Meu Dia" não mostra minhas matérias do calendário

1. **Verificar se há dados salvos:**
   ```sql
   SELECT * FROM calendar_subjects WHERE user_id = '[USER_ID]';
   ```

2. **Verificar logs do console:**
   - Procurar por: `🔍 [Meu Dia] Calendar subjects encontrados:`
   - Deve mostrar quantidade > 0 se houver matérias

3. **Verificar dia da semana:**
   - Log: `🔍 [Meu Dia] Dia da semana (GMT-3):`
   - Deve corresponder ao dia atual em Brasília

### Matérias não estão sendo salvas

1. **Verificar autenticação:**
   - Hook `useCalendarSync` requer usuário autenticado

2. **Verificar RLS policies:**
   - Usuário deve ter permissão de INSERT em `calendar_subjects`

3. **Verificar console:**
   - Erros de rede ou banco de dados aparecerão no console

### Duplicatas aparecem no calendário

1. **Verificar constraint UNIQUE:**
   ```sql
   SELECT constraint_name FROM information_schema.table_constraints 
   WHERE table_name = 'calendar_subjects' AND constraint_type = 'UNIQUE';
   ```
   - Deve retornar `unique_user_subject_day`

2. **Limpar duplicatas manualmente:**
   ```sql
   DELETE FROM calendar_subjects cs1
   WHERE EXISTS (
     SELECT 1 FROM calendar_subjects cs2
     WHERE cs2.user_id = cs1.user_id
       AND cs2.name = cs1.name
       AND cs2.day_of_week = cs1.day_of_week
       AND cs2.created_at < cs1.created_at
   );
   ```

### Calendário diferente em abas diferentes

1. **Verificar Realtime subscription:**
   - Console deve mostrar conexão ao canal `calendar-changes-[user_id]`

2. **Forçar refresh:**
   - Usar `refresh()` do hook para recarregar do servidor

## 📝 Notas Técnicas

- **Timezone:** Todo o sistema usa fuso de Brasília (America/Sao_Paulo)
- **Cache:** localStorage serve como cache local (sincronizado com servidor)
- **Fonte de Verdade:** Supabase é a fonte de verdade (SERVER-FIRST)
- **Sincronização:** Realtime subscription mantém abas sincronizadas
- **Otimização:** Updates são otimistas (UI atualiza antes de confirmar no servidor)
- **Rollback:** Em caso de erro, dados são revertidos para estado do servidor
