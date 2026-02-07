
# Plano: Corrigir Discrepância no Card "Meu Dia" para Simulados

## Diagnóstico

O card "Meu Dia" na Home exibe "Simulado Disponível" para usuários, mas a página de Simulados mostra "Nenhum simulado encontrado".

### Causa Raiz Identificada

| Componente | Lógica de Busca | Problema |
|------------|-----------------|----------|
| **useMeuDia.ts** (linha 37-38) | `.eq('status', 'ativo')` sem filtro de datas | Retorna simulados expirados |
| **useHomeData.ts** (linha 156-158) | `.eq('status', 'ativo')` sem filtro de datas | Retorna simulados expirados |
| **simuladosApi.ts** | `.neq('status', 'encerrado')` + filtro de datas no cliente | Corretamente filtra expirados |

O simulado provavelmente tem `status: 'ativo'` mas `data_encerramento` já passou, então aparece no card mas não na página.

---

## Solução

Aplicar a mesma lógica de filtragem por datas (implementada no `simuladosApi.ts`) nos dois hooks do "Meu Dia".

---

## Arquivos a Modificar

### 1. `src/hooks/home/useMeuDia.ts`

**Modificar query (linhas 35-38):**
```typescript
// ANTES:
supabase
  .from('simulados_admin')
  .select('id, nome, status')
  .eq('status', 'ativo'),

// DEPOIS:
supabase
  .from('simulados_admin')
  .select('id, nome, status, data_liberacao, data_encerramento')
  .neq('status', 'encerrado'),
```

**Modificar função `addAvailableSimulado` (linhas 144-170):**
```typescript
const addAvailableSimulado = async (
  user: User, 
  simulados: { id: string; nome: string; data_liberacao?: string; data_encerramento?: string }[], 
  items: MeuDiaItem[]
) => {
  try {
    // NOVO: Filtrar por datas (mesma lógica de simuladosApi.ts)
    const agora = new Date();
    const simuladosDisponiveis = simulados.filter(s => {
      const liberado = !s.data_liberacao || new Date(s.data_liberacao) <= agora;
      const naoEncerrado = !s.data_encerramento || new Date(s.data_encerramento) >= agora;
      return liberado && naoEncerrado;
    });

    // Se não há simulados disponíveis após filtro de datas, não adicionar
    if (simuladosDisponiveis.length === 0) return;

    // Verificar quais o usuário já finalizou
    const { data: finalizados } = await supabase
      .from('simulados_finalizados')
      .select('simulado_id')
      .eq('user_id', user.id);

    const finalizadosIds = new Set((finalizados || []).map((r) => r.simulado_id));
    const disponiveis = simuladosDisponiveis.filter((s) => !finalizadosIds.has(s.id));
    const availableSimulado = disponiveis[0] || simuladosDisponiveis[0];

    if (availableSimulado) {
      items.push({
        id: `simulado-${availableSimulado.id}-${Date.now()}`,
        type: 'simulado',
        title: 'Simulado Disponível',
        subtitle: availableSimulado.nome || 'Simulado',
        path: '/simulados',
        icon: 'Trophy',
        color: 'from-orange-500 to-red-500',
        source: 'fallback',
      });
    }
  } catch (e) {
    console.warn('[Meu Dia] Erro ao avaliar simulados:', e);
  }
};
```

---

### 2. `src/hooks/useHomeData.ts`

**Modificar query (linhas 155-158):**
```typescript
// ANTES:
supabase
  .from('simulados_admin')
  .select('id, nome, status')
  .eq('status', 'ativo'),

// DEPOIS:
supabase
  .from('simulados_admin')
  .select('id, nome, status, data_liberacao, data_encerramento')
  .neq('status', 'encerrado'),
```

**Modificar lógica de simulados (linhas 301-330):**
```typescript
// Adicionar "Simulado Disponível" somente se houver simulado REALMENTE disponível
try {
  // NOVO: Filtrar por datas (mesma lógica de simuladosApi.ts)
  const agora = new Date();
  const simuladosDisponiveis = ((simuladoRes.data || []) as any[]).filter((s: any) => {
    const liberado = !s.data_liberacao || new Date(s.data_liberacao) <= agora;
    const naoEncerrado = !s.data_encerramento || new Date(s.data_encerramento) >= agora;
    return liberado && naoEncerrado;
  });

  // Se não há simulados disponíveis após filtro de datas, não adicionar item
  if (simuladosDisponiveis.length === 0) {
    // Não adiciona item de simulado
  } else {
    const { data: finalizados } = await supabase
      .from('simulados_finalizados')
      .select('simulado_id')
      .eq('user_id', user.id);

    const finalizadosIds = new Set((finalizados || []).map((r: any) => r.simulado_id));
    const disponiveis = simuladosDisponiveis.filter((s: any) => !finalizadosIds.has(s.id));
    let availableSimulado = disponiveis[0] || null;
    if (!availableSimulado && simuladosDisponiveis.length > 0) {
      availableSimulado = simuladosDisponiveis[0];
    }

    if (availableSimulado) {
      items.push({
        id: `simulado-${availableSimulado.id}-${Date.now()}`,
        type: 'simulado',
        title: 'Simulado Disponível',
        subtitle: availableSimulado.nome || 'Simulado',
        path: '/simulados',
        icon: 'Trophy',
        color: 'from-orange-500 to-red-500',
        source: 'fallback' as const,
      });
    }
  }
} catch (e) {
  console.warn('[Meu Dia] Erro ao avaliar simulados disponíveis:', e);
}
```

---

## Fluxo Após Correção

```text
ANTES (Problema):
┌─────────────────────────────────────────────────────────┐
│ useMeuDia.ts / useHomeData.ts                           │
│   → Busca WHERE status = 'ativo'                        │
│   → Retorna simulados expirados (data_encerramento <)   │
│   → Card mostra "Simulado Disponível" ❌                │
│                                                         │
│ simuladosApi.ts                                         │
│   → Busca WHERE status != 'encerrado'                   │
│   → Filtra por datas no cliente                         │
│   → Expirados são removidos                             │
│   → Página mostra "Nenhum simulado" ✅                  │
└─────────────────────────────────────────────────────────┘

DEPOIS (Corrigido):
┌─────────────────────────────────────────────────────────┐
│ useMeuDia.ts / useHomeData.ts                           │
│   → Busca WHERE status != 'encerrado'                   │
│   → Filtra por datas no cliente (mesma lógica)          │
│   → Expirados são removidos                             │
│   → Card NÃO mostra "Simulado Disponível" ✅            │
│                                                         │
│ simuladosApi.ts                                         │
│   → Mesma lógica, consistente                           │
│   → Página mostra "Nenhum simulado" ✅                  │
│                                                         │
│ ✅ CONSISTÊNCIA GARANTIDA                               │
└─────────────────────────────────────────────────────────┘
```

---

## Critérios de Sucesso

- O card "Meu Dia" só mostra "Simulado Disponível" se realmente houver simulados acessíveis
- Simulados com `data_encerramento` passada não aparecem no card
- Simulados com `data_liberacao` futura não aparecem no card
- Consistência entre card "Meu Dia" e página de Simulados
- Funciona para todos os usuários, não apenas um específico
