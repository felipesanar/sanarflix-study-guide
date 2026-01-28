
# Plano: Corrigir Erro de Autenticação no Guia de Estudos

## Problemas Identificados

### 1. Autenticação na Edge Function (Crítico)
A Edge Function `get-study-contents` está retornando "Auth session missing!" porque os headers CORS estão incompletos. Isso impede que o header `Authorization` seja enviado corretamente pelo cliente.

**Headers atuais (incompletos)**:
```javascript
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
```

**Headers necessários**:
```javascript
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

### 2. Ausência de Dados para Semestre 0
A tabela `conteudos` da FAME possui apenas semestres 1-8 e INTERNATO. Não há registros para semestre "0".

---

## Solução Técnica

### Correção 1: Atualizar CORS Headers na Edge Function

**Arquivo**: `supabase/functions/get-study-contents/index.ts`

```typescript
// ANTES (linha 3-6)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// DEPOIS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

### Correção 2: Melhorar Tratamento de Erros no StudyContext

**Arquivo**: `src/contexts/StudyContext.tsx`

Adicionar logging mais detalhado para facilitar debug:

```typescript
const loadStudyContents = async () => {
  if (!user || !user.id_ies || typeof user.semestre !== 'number') return;

  try {
    // Verificar se há sessão ativa antes de chamar a edge function
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      console.warn('No active session, skipping study contents load');
      return;
    }
    
    const { data: response, error } = await supabase.functions.invoke('get-study-contents');
    // ... resto do código
  }
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/get-study-contents/index.ts` | Atualizar CORS headers |
| `src/contexts/StudyContext.tsx` | Adicionar verificação de sessão |

---

## Sobre os Dados do Semestre 0

Os dados de conteúdo para semestre 0 precisam ser inseridos na tabela `conteudos`. Existem duas opções:

1. **Inserir novos dados**: Adicionar registros com `semestre = '0'` para a FAME
2. **Mapear para outro semestre**: Se o semestre 0 representa "pré-medicina" ou similar, pode-se mapear para os conteúdos do 1º semestre

**Pergunta para você**: O semestre 0 deve ter conteúdos específicos ou podemos usar os conteúdos do 1º semestre?

---

## Resultado Esperado

- Edge Function aceitará requisições autenticadas corretamente
- Erros de CORS serão eliminados
- Usuários FAME com semestre 0 poderão acessar o Guia de Estudos (se houver dados)
