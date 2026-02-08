
# Plano: Corrigir EmptyState e Lógica de Onboarding

## Problema Identificado

### Causa Raiz (Dados)
Existem **duas fontes de dados de progresso incompatíveis**:

| Tabela | Uso | content_id format | Onde é salvo |
|--------|-----|-------------------|--------------|
| `user_progress` | Legado (ENAMED) | `enamed_Semana 01...` (string composta) | Fluxos antigos |
| `study_progress` | Guia de Estudos atual | Texto descritivo | `useStudyProgress` hook |

A Edge Function `get-progress-hub` olha apenas para `user_progress` e tenta fazer match com `conteudos.id` (UUID), resultando em **0 matches** mesmo quando o usuário tem progresso registrado.

### Causa Raiz (UX)
O EmptyState atual é exibido baseado em `data.overview.completed === 0`, que:
1. Não funciona por causa do bug de dados acima
2. **Não é a lógica correta** — deveria ser um "welcome screen" de **onboarding único**, não um estado vazio recorrente

---

## Solução Proposta

### Opção A: Remover o EmptyState de Primeiro Acesso (Recomendado)
O usuário está certo: se o EmptyState vai continuar aparecendo quando não tem progresso, é melhor remover.

**Ação:**
- Remover a condição `if (data.overview.completed === 0 && data.overview.total > 0)` do Dashboard
- O HeroCard já mostra 0% de forma clara, não precisa de tela separada
- Manter apenas o `EmptyState` para `no_filter_results`

### Opção B: Implementar Onboarding de Primeira Vez Corretamente (Mais Complexo)
Se quiser manter o welcome screen, precisa:
1. Criar flag `has_seen_progress_hub_onboarding` no localStorage ou tabela `user_preferences`
2. Mostrar apenas UMA vez na vida
3. Ter botão "Entendi" que marca como visto

---

## Implementação (Opção A - Remover)

### Arquivo: `src/pages/Dashboard.tsx`

**Remover linhas 369-378:**
```tsx
// REMOVER ESTE BLOCO
if (data.overview.completed === 0 && data.overview.total > 0) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <EmptyState userName={data.user.nome} type="first_access" />
      </div>
    </div>
  );
}
```

**Resultado:**
- Dashboard sempre mostra o HeroCard, mesmo com 0% de progresso
- O HeroCard já comunica visualmente que o aluno está começando
- O status_message "Começando a jornada" já existe para esse caso

### Arquivo: `src/components/progress-hub/EmptyState.tsx`

**Simplificar o componente:**
- Manter apenas o tipo `no_filter_results`
- Remover o bloco `first_access` ou marcar como deprecated

---

## Fix Secundário: Corrigir Lógica de Dados (Importante para Futuro)

A Edge Function precisa ser ajustada para ler da tabela **correta** (`study_progress`), não da `user_progress` legada. Isso é uma correção separada que deve ser feita após este fix.

**Escopo do fix de dados (não incluído neste plano):**
1. Modificar `get-progress-hub` para ler de `study_progress` 
2. Ou criar view unificada que junta ambas as tabelas
3. Ou migrar dados de `user_progress` para novo formato

---

## Critérios de Aceitação

- [ ] EmptyState de "primeiro acesso" não aparece mais
- [ ] Dashboard mostra HeroCard com 0% para usuários novos
- [ ] Status badge mostra "Começando a jornada" para 0%
- [ ] EmptyState de "filtro sem resultados" continua funcionando
- [ ] Nenhuma regressão no Guia de Estudos

---

## Esforço
**S (Small)** — Apenas remoção de código

