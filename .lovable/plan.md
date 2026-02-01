
# Plano de Correcao do Sistema de Finalizacao de Simulados

## Resumo do Problema

109 simulados foram respondidos corretamente (tabela `answer_progress`) mas nao foram registrados na tabela `simulados_finalizados`. O 1o Simulado Claretiano 2026 e o principal afetado.

## Causas Raiz Identificadas

| Problema | Impacto | Criticidade |
|----------|---------|-------------|
| Politica RLS bloqueando INSERT | Usuarios comuns nao podem registrar finalizacao | CRITICO |
| Insercao duplicada em dois lugares | Inconsistencia e possivel conflito | ALTO |
| Campo `saidas_de_fullscreen` nao enviado | Dados incompletos no registro | MEDIO |
| sendBeacon sem autenticacao | Edge Function falha ao auto-finalizar | ALTO |

## Solucao Proposta

### 1. Corrigir Politica RLS da Tabela simulados_finalizados

Adicionar politica que permite usuarios inserirem seus proprios registros:

```sql
CREATE POLICY "Usuarios podem inserir seus proprios simulados finalizados"
  ON simulados_finalizados
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### 2. Centralizar Registro na Edge Function

Remover a insercao duplicada do frontend `simuladosApi.ts` e manter apenas na Edge Function. Isso garante que:
- A logica de finalizacao fica em um unico lugar
- O Edge Function tem controle total sobre o processo

Alem disso, atualizar a Edge Function para usar `SUPABASE_SERVICE_ROLE_KEY` em vez do token do usuario para o INSERT na tabela `simulados_finalizados`, garantindo que a operacao sempre funcione independente de RLS.

### 3. Adicionar Campo saidas_de_fullscreen

- Atualizar tipo `ResultadoSimulado` para incluir `saidas_de_fullscreen`
- Atualizar `simuladosApi.enviarResultado` para enviar este campo
- Garantir que o Edge Function processe corretamente

### 4. Melhorar Tratamento de Erros

- Adicionar logging detalhado na Edge Function
- Nao silenciar erros de insercao em `simulados_finalizados`
- Retornar erro se a finalizacao falhar

### 5. Corrigir sendBeacon

O sendBeacon nao pode enviar headers de autenticacao. Solucao: modificar a Edge Function para aceitar chamadas nao autenticadas APENAS para finalizacao automatica, validando os dados de outra forma (verificar se o user_id tem respostas para o simulado).

---

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/migrations/` | Nova politica RLS para INSERT |
| `supabase/functions/corrigir-simulado/index.ts` | Usar service_role para INSERT, tratar erros, suportar sendBeacon |
| `src/services/simuladosApi.ts` | Remover INSERT duplicado, adicionar saidas_de_fullscreen |
| `src/types/simulado.ts` | Adicionar saidas_de_fullscreen ao ResultadoSimulado |
| `src/pages/ModoProva.tsx` | Atualizar payload para incluir todos os campos |

---

## Detalhes da Implementacao

### Migracao SQL

```sql
-- Politica para usuarios inserirem seus proprios registros
CREATE POLICY "Usuarios podem inserir proprios simulados finalizados"
  ON simulados_finalizados
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Edge Function Atualizada

```typescript
// Usar service role para INSERT garantido
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// INSERT com tratamento de erro obrigatorio
const { error: finalizadoError } = await supabaseAdmin
  .from('simulados_finalizados')
  .insert({
    user_id,
    simulado_id,
    tempo_total_segundos,
    saidas_de_aba,
    saidas_de_fullscreen: saidas_de_fullscreen ?? 0,
    finalizado_em: finalizado_em || new Date().toISOString()
  });

if (finalizadoError) {
  console.error('ERRO CRITICO ao registrar finalizacao:', finalizadoError);
  throw new Error(`Falha ao registrar finalizacao: ${finalizadoError.message}`);
}
```

### Tipo ResultadoSimulado Atualizado

```typescript
export interface ResultadoSimulado {
  simulado_id: string;
  user_id: string;
  respostas: RespostaSimulado[];
  tempo_total_segundos: number;
  saidas_de_aba: number;
  saidas_de_fullscreen: number; // NOVO
  finalizado_em: string;
}
```

### simuladosApi.ts - Remover Duplicacao

```typescript
async enviarResultado(resultado: ResultadoSimulado): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error('Usuario nao autenticado');

  const { data, error } = await supabase.functions.invoke('corrigir-simulado', {
    body: {
      simulado_id: resultado.simulado_id,
      user_id: userData.user.id,
      respostas: resultado.respostas,
      tempo_total_segundos: resultado.tempo_total_segundos,
      saidas_de_aba: resultado.saidas_de_aba,
      saidas_de_fullscreen: resultado.saidas_de_fullscreen, // NOVO
      finalizado_em: resultado.finalizado_em // NOVO
    }
  });

  if (error) throw error;
  
  // REMOVIDO: Insert duplicado no frontend
  return data;
}
```

---

## Recuperacao dos Dados Perdidos

Apos a correcao, executar script para recuperar os 109 simulados faltantes:

```sql
-- Recuperar registros faltantes baseado em answer_progress
INSERT INTO simulados_finalizados (user_id, simulado_id, tempo_total_segundos, saidas_de_aba, saidas_de_fullscreen)
SELECT DISTINCT 
  ap.user_id,
  ap.simulado as simulado_id,
  0 as tempo_total_segundos,  -- Valor desconhecido
  0 as saidas_de_aba,          -- Valor desconhecido
  0 as saidas_de_fullscreen    -- Valor desconhecido
FROM answer_progress ap
LEFT JOIN simulados_finalizados sf 
  ON ap.user_id = sf.user_id AND ap.simulado = sf.simulado_id
WHERE sf.id IS NULL
ON CONFLICT (user_id, simulado_id) DO NOTHING;
```

**Nota**: Os valores de tempo e saidas serao 0 pois nao foram registrados originalmente.

---

## Validacao

1. Criar simulado de teste e finalizar normalmente
2. Verificar se registro aparece em `simulados_finalizados`
3. Verificar se `saidas_de_fullscreen` esta sendo salvo
4. Testar fechamento forcado da aba (sendBeacon)
5. Confirmar que 109 registros foram recuperados

---

## Secao Tecnica

### Fluxo de Finalizacao Corrigido

```text
Usuario clica Finalizar
        |
        v
ModoProva.tsx prepara payload completo
(simulado_id, user_id, respostas, tempo,
 saidas_de_aba, saidas_de_fullscreen, finalizado_em)
        |
        v
simuladosApi.enviarResultado()
        |
        v
Edge Function corrigir-simulado
        |
        +---> Insere respostas em answer_progress (token usuario)
        |
        +---> Insere em simulados_finalizados (service_role)
        |
        v
Retorna sucesso ou erro explicito
```

### Campos Registrados

| Campo | Fonte | Descricao |
|-------|-------|-----------|
| user_id | Auth/Payload | ID do usuario |
| simulado_id | Payload | ID do simulado |
| tempo_total_segundos | Calculado | Diferenca entre inicio e fim |
| saidas_de_aba | localStorage | Contador incrementado em visibility change |
| saidas_de_fullscreen | localStorage | Contador incrementado ao sair do fullscreen |
| finalizado_em | Payload | Timestamp exato da finalizacao |
