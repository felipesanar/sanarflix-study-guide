
# Plano: Garantir Integridade de Tentativas Únicas em Simulados

## Diagnóstico Completo

### Estrutura do Banco de Dados (Correto)
- **`simulados_iniciados`**: UNIQUE constraint em `(user_id, simulado_id)` - impede duplicatas
- **`simulados_finalizados`**: UNIQUE constraint em `(user_id, simulado_id, tentativa_numero)` - permite múltiplas tentativas controladas

### Regras de Negócio Esperadas
1. Usuário só pode **iniciar** um simulado uma vez (exceto se liberado pelo admin)
2. Usuário só pode **finalizar** um simulado uma vez por tentativa
3. Se já existe par (início + finalização) para aquela tentativa, bloqueado
4. Admin pode liberar nova tentativa (`liberado_novamente = true`)

### Problemas Identificados

**1. ModoProva.tsx - NÃO verifica bloqueio de acesso**
- Usuário pode acessar `/simulados/:id/prova` diretamente via URL
- Não chama `verificarProgressoSimulado` antes de inicializar
- Risco: usuário pode entrar no modo prova mesmo já tendo finalizado

**2. trackSimuladoStart - Usa UPSERT sem verificar liberado_novamente**
- O upsert em `simulados_iniciados` atualiza `started_at` se já existir
- Não verifica se o usuário tem permissão para reiniciar
- Risco: pode "resetar" o timestamp de início mesmo sem autorização

**3. Edge Function - Faltam validações adicionais**
- Não verifica se existe registro de INÍCIO antes de aceitar finalização
- Isso explica os 2 registros órfãos (finalização sem início)

**4. SimuladosDisponiveis.tsx - Lógica de status correta**
- Verifica `simulados_finalizados` e `liberado_novamente` corretamente
- O botão é desabilitado/alterado conforme status

---

## Solução Proposta

### Fase 1: Frontend - Bloquear Acesso Não Autorizado

**Arquivo: `src/pages/ModoProva.tsx`**

Adicionar verificação no `inicializarSimulado()`:

```typescript
const inicializarSimulado = async () => {
  setLoading(true);
  try {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      navigate('/simulados');
      return;
    }

    // NOVO: Verificar se o usuário pode acessar este simulado
    const jaConcluido = await simuladosApi.verificarProgressoSimulado(user.id, simuladoId);
    if (jaConcluido) {
      toast.error('Você já finalizou este simulado');
      navigate('/simulados');
      return;
    }

    // ... resto do código existente
  } catch (error) {
    // ...
  }
};
```

### Fase 2: Tracking - Verificar Permissão Antes de Registrar Início

**Arquivo: `src/hooks/useAnalyticsTracker.ts`**

Modificar `trackSimuladoStart` para verificar se pode registrar:

```typescript
const trackSimuladoStart = useCallback(async (simuladoId: string, simuladoNome: string) => {
  if (!user?.id) return;

  try {
    // NOVO: Verificar se já existe finalização não liberada
    const { data: finalizacao } = await supabase
      .from('simulados_finalizados')
      .select('id, liberado_novamente')
      .eq('user_id', user.id)
      .eq('simulado_id', simuladoId)
      .order('tentativa_numero', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Se existe finalização e NÃO foi liberado novamente, não registrar
    if (finalizacao && !finalizacao.liberado_novamente) {
      console.log('[AnalyticsCapture] Simulado já finalizado, ignorando tracking de início');
      return;
    }

    // Continuar com o registro
    await supabase
      .from('simulados_iniciados')
      .upsert({
        user_id: user.id,
        simulado_id: simuladoId
      }, { onConflict: 'user_id,simulado_id' });
  } catch (err) {
    console.error('[AnalyticsCapture] Error tracking simulado start:', err);
  }

  trackEvent({
    eventName: 'simulado_start',
    category: 'simulado',
    data: { simuladoId, simuladoNome }
  });
}, [user?.id, trackEvent]);
```

### Fase 3: Edge Function - Validação Reforçada

**Arquivo: `supabase/functions/corrigir-simulado/index.ts`**

Adicionar verificação de início correspondente:

```typescript
// NOVO PASSO (antes do PASSO 1): Verificar se existe início para este simulado
const { data: inicioExistente, error: inicioError } = await supabaseAdmin
  .from('simulados_iniciados')
  .select('id, started_at')
  .eq('user_id', user_id)
  .eq('simulado_id', simulado_id)
  .maybeSingle();

if (inicioError) {
  console.error('[corrigir-simulado] Erro ao verificar início:', inicioError);
}

// Se não existe início, criar um retroativamente (para consistência)
if (!inicioExistente) {
  console.log('[corrigir-simulado] ATENÇÃO: Não existe registro de início. Criando retroativamente...');
  const { error: insertInicioError } = await supabaseAdmin
    .from('simulados_iniciados')
    .insert({
      user_id: user_id,
      simulado_id: simulado_id,
      started_at: new Date(Date.now() - (tempo_total_segundos * 1000)).toISOString()
    });
  
  if (insertInicioError && !insertInicioError.message.includes('duplicate')) {
    console.error('[corrigir-simulado] Erro ao criar início retroativo:', insertInicioError);
  }
}
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/ModoProva.tsx` | Adicionar verificação de `verificarProgressoSimulado` no início |
| `src/hooks/useAnalyticsTracker.ts` | Verificar finalização existente antes de registrar início |
| `supabase/functions/corrigir-simulado/index.ts` | Garantir que existe início antes de finalizar |

---

## Fluxo Após Correções

```text
FLUXO DE TENTATIVA ÚNICA:
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuário clica "Iniciar Simulado"                         │
│    ↓                                                        │
│ 2. SimuladosDisponiveis verifica finalizados               │
│    → Se concluído e !liberado_novamente: botão desabilitado │
│    ↓                                                        │
│ 3. Usuário navega para /simulados/:id/prova                 │
│    ↓                                                        │
│ 4. ModoProva.tsx verifica verificarProgressoSimulado()      │
│    → Se bloqueado: redireciona para /simulados              │
│    ↓                                                        │
│ 5. trackSimuladoStart() verifica permissão                  │
│    → Se já finalizado e !liberado: não registra             │
│    → Se ok ou liberado_novamente: upsert em iniciados       │
│    ↓                                                        │
│ 6. Usuário responde e clica "Finalizar"                     │
│    ↓                                                        │
│ 7. Edge Function corrigir-simulado verifica:                │
│    → Início existe? Se não, cria retroativamente            │
│    → Já finalizado e !liberado? Retorna already_processed   │
│    → liberado_novamente? Move antigas para histórico        │
│    ↓                                                        │
│ 8. Insere em simulados_finalizados + answer_progress        │
│    ↓                                                        │
│ 9. Limpa localStorage + redireciona                         │
└─────────────────────────────────────────────────────────────┘

FLUXO DE RE-LIBERAÇÃO (ADMIN):
┌─────────────────────────────────────────────────────────────┐
│ 1. Admin marca liberado_novamente = true                    │
│    ↓                                                        │
│ 2. Usuário vê botão "Iniciar" novamente                     │
│    ↓                                                        │
│ 3. verificarProgressoSimulado() retorna false (liberado)   │
│    ↓                                                        │
│ 4. Novo início: upsert atualiza started_at                  │
│    ↓                                                        │
│ 5. Ao finalizar:                                            │
│    → Move respostas antigas para histórico                  │
│    → Seta liberado_novamente = false no registro antigo    │
│    → Cria novo registro com tentativa_numero + 1            │
└─────────────────────────────────────────────────────────────┘
```

---

## Critérios de Sucesso

- [ ] Usuário não pode acessar ModoProva se já finalizou e não foi liberado
- [ ] trackSimuladoStart não registra se já finalizado e não liberado
- [ ] Edge Function cria início retroativo se não existir
- [ ] Admin pode liberar nova tentativa e fluxo funciona corretamente
- [ ] Múltiplas tentativas ficam registradas com tentativa_numero correto
- [ ] Zero duplicatas de início (constraint única mantida)
- [ ] Zero duplicatas de finalização na mesma tentativa (constraint única mantida)
