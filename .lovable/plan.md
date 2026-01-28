
# Plano: Sistema de Anulação de Questões de Simulado

## Visão Geral

Implementar funcionalidade para que administradores possam anular questões de simulados, fazendo com que a questão seja automaticamente contabilizada como correta para todos os alunos que já responderam ou que vierem a responder.

## Estrutura de Dados

### 1. Adicionar coluna `anulada` na tabela `questoes_simulado`

```sql
ALTER TABLE questoes_simulado 
ADD COLUMN anulada boolean NOT NULL DEFAULT false;
```

### 2. Atualizar a função RPC `get_questions_by_subspecialty`

Modificar para retornar o status de anulação da questão:

```sql
-- Adicionar campo 'anulada' ao retorno
RETURNS TABLE(
  ...campos existentes...,
  anulada boolean
)
-- E no SELECT:
q.anulada
```

### 3. Atualizar Edge Function `corrigir-simulado`

Modificar a lógica de correção para considerar questões anuladas como corretas:

```typescript
// Buscar gabaritos E status de anulação
const { data: questoes } = await supabase
  .from('questoes_simulado')
  .select('id, correta, anulada')  // incluir 'anulada'
  .in('id', questaoIds);

// Na correção:
correct: questao.anulada ? true : (r.resposta === gabarito)
```

## Correção Retroativa

### Edge Function para corrigir respostas já registradas

Quando uma questão for anulada, precisamos atualizar todos os registros existentes em `answer_progress`:

```typescript
// Atualizar todas as respostas dessa questão para correct = true
await supabase
  .from('answer_progress')
  .update({ correct: true })
  .eq('question_id', questaoId);
```

## Interface Administrativa

### 1. Adicionar botão "Anular Questão" no modal de visualização de questões

No componente `SimuladosTab.tsx`, adicionar um botão que:
- Exibe confirmação antes de anular
- Chama a API para atualizar a questão
- Atualiza retroativamente todas as respostas existentes

### 2. Exibir badge "ANULADA" na visualização de questões

Questões anuladas exibem badge vermelho com ícone de alerta

## Exibição para o Aluno

### 1. Modal de Revisão (`SimuladoDesempenho.tsx`)

Substituir o badge de dificuldade por badge "ANULADA" quando aplicável:

```tsx
{question.anulada ? (
  <span className="px-2 py-1 rounded-md text-xs font-semibold bg-purple-500/10 text-purple-500">
    🚫 ANULADA
  </span>
) : (
  <DifficultyBadge difficulty={question.dificuldade} />
)}
```

### 2. Contagem de acertos

No cálculo de desempenho, questões anuladas já serão contadas como corretas devido à correção retroativa

## Arquivos Afetados

| Arquivo | Modificação |
|---------|-------------|
| **Migração SQL** | Adicionar coluna `anulada` + atualizar função RPC |
| `supabase/functions/corrigir-simulado/index.ts` | Considerar `anulada` na correção |
| `src/components/admin/SimuladosTab.tsx` | Botão de anular + badge na visualização |
| `src/pages/SimuladoDesempenho.tsx` | Badge "ANULADA" no modal de revisão |

## Fluxo Completo

```text
┌─────────────────────────────────────────────────────────────────┐
│                     ADMINISTRADOR                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Acessa Portal Admin > Simulados                             │
│  2. Clica "Visualizar Questões" em um simulado                  │
│  3. Localiza a questão problemática                             │
│  4. Clica no botão "Anular Questão"                             │
│  5. Confirma no diálogo de confirmação                          │
│                                                                 │
│            ↓ Sistema executa automaticamente ↓                  │
│                                                                 │
│  a) Atualiza questoes_simulado SET anulada = true               │
│  b) Atualiza answer_progress SET correct = true                 │
│     para TODAS as respostas dessa questão                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        ALUNO                                    │
├─────────────────────────────────────────────────────────────────┤
│  • Na aba Desempenho, questão aparece como "ACERTOU"            │
│  • No modal de revisão, badge "ANULADA" substitui dificuldade   │
│  • Estatísticas refletem a questão como correta                 │
└─────────────────────────────────────────────────────────────────┘
```

## Procedimento Manual (Alternativa Imediata)

Se precisar anular uma questão AGORA, antes da implementação, execute:

```sql
-- 1. Marcar questão como anulada (substitua QUESTAO_ID pelo UUID da questão)
UPDATE questoes_simulado 
SET anulada = true 
WHERE id = 'QUESTAO_ID';

-- 2. Corrigir todas as respostas retroativamente
UPDATE answer_progress 
SET correct = true 
WHERE question_id = 'QUESTAO_ID';
```

**Nota:** A coluna `anulada` precisa ser criada primeiro via migração.

## Detalhes Técnicos

### Interface do Admin - Botão de Anular

```tsx
<Button
  variant="destructive"
  size="sm"
  onClick={() => handleAnularQuestao(questao.id)}
  disabled={questao.anulada}
>
  <Ban className="h-4 w-4 mr-2" />
  {questao.anulada ? 'Já Anulada' : 'Anular Questão'}
</Button>
```

### Badge na Revisão do Aluno

```tsx
const AnuladaBadge = () => (
  <span className="px-2 py-1 rounded-md text-xs font-semibold bg-purple-500/10 text-purple-500 flex items-center gap-1">
    <Ban className="h-3 w-3" />
    ANULADA
  </span>
);

// No header do modal:
{question.anulada ? <AnuladaBadge /> : <DifficultyBadge difficulty={question.dificuldade} />}
```

### Função de Anulação no Admin

```typescript
const handleAnularQuestao = async (questaoId: string) => {
  // 1. Atualizar a questão
  await supabase
    .from('questoes_simulado')
    .update({ anulada: true })
    .eq('id', questaoId);

  // 2. Atualizar todas as respostas para correto
  await supabase
    .from('answer_progress')
    .update({ correct: true })
    .eq('question_id', questaoId);

  toast.success('Questão anulada. Todos os alunos receberão pontuação.');
};
```
