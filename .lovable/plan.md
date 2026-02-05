
# Plano: Corrigir CORS no `corrigir-simulado` e Avisos de Acessibilidade

## Diagnóstico do Problema

O simulado não pode ser finalizado porque a Edge Function `corrigir-simulado` rejeita a requisição preflight (OPTIONS) do CORS. O navegador envia headers adicionais do SDK Supabase que não estão listados nos `corsHeaders` da função.

| Arquivo | Problema | Impacto |
|---------|----------|---------|
| `supabase/functions/corrigir-simulado/index.ts` | Headers CORS incompletos | **CRÍTICO** - Bloqueia envio de respostas |
| `src/components/simulados/ImageLightbox.tsx` | `DialogContent` sem `DialogTitle` | Aviso de acessibilidade (não-crítico) |

---

## Mudança 1: Atualizar CORS Headers em `corrigir-simulado`

**Arquivo:** `supabase/functions/corrigir-simulado/index.ts`

O SDK do Supabase envia automaticamente headers de telemetria que precisam estar no `Access-Control-Allow-Headers`:

```typescript
// Antes (linhas 3-6)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Depois - Adicionar headers do cliente Supabase
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

### Por que isso resolve?

Quando o frontend chama `supabase.functions.invoke('corrigir-simulado', ...)`, o SDK automaticamente inclui:
- `x-supabase-client-platform`: ex. "web"
- `x-supabase-client-platform-version`: versão do browser
- `x-supabase-client-runtime`: "js"
- `x-supabase-client-runtime-version`: versão do SDK

Se esses headers não estiverem explicitamente permitidos no `Access-Control-Allow-Headers`, o navegador bloqueia a requisição antes mesmo de chegar ao servidor.

---

## Mudança 2: Migrar import para npm: specifier

O import atual usa `esm.sh`, que pode causar problemas de bundling:

```typescript
// Antes (linha 1)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Depois - Usar npm: specifier para estabilidade
import { createClient } from 'npm:@supabase/supabase-js@2';
```

---

## Mudança 3: Adicionar `DialogTitle` oculto no ImageLightbox

**Arquivo:** `src/components/simulados/ImageLightbox.tsx`

Para resolver o warning de acessibilidade sem alterar o design visual:

```tsx
// Antes (linhas 239-244)
<Dialog open={open} onOpenChange={handleOpenChange}>
  <DialogContent 
    className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 border-0 bg-black flex items-center justify-center overflow-hidden group/lightbox"
    style={{ touchAction: 'none' }}
    aria-describedby={undefined}
  >

// Depois - Adicionar DialogTitle visualmente oculto
<Dialog open={open} onOpenChange={handleOpenChange}>
  <DialogContent 
    className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 border-0 bg-black flex items-center justify-center overflow-hidden group/lightbox"
    style={{ touchAction: 'none' }}
    aria-describedby={undefined}
  >
    {/* DialogTitle oculto para acessibilidade */}
    <DialogTitle className="sr-only">{alt || 'Visualização de imagem ampliada'}</DialogTitle>
```

A classe `sr-only` (screen reader only) do Tailwind oculta visualmente o título mas mantém acessível para leitores de tela.

---

## Mudança 4: Adicionar config em `config.toml`

O `corrigir-simulado` não está listado no config.toml, o que significa que usa as configurações padrão. Para maior controle:

```toml
[functions.corrigir-simulado]
verify_jwt = false
```

Nota: O JWT será validado manualmente no código via `req.headers.get('Authorization')`.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/corrigir-simulado/index.ts` | Atualizar CORS headers + migrar import |
| `src/components/simulados/ImageLightbox.tsx` | Adicionar DialogTitle oculto |
| `supabase/config.toml` | Adicionar entrada para `corrigir-simulado` |

---

## Sobre os warnings de `preventDefault`

Os avisos `Unable to preventDefault inside passive event listener invocation` são relacionados a event listeners de touch/scroll marcados como passive pelo browser. Isso NÃO afeta a funcionalidade do simulado e é um comportamento normal do navegador para otimizar performance de scroll. Esses warnings podem ser ignorados com segurança.

---

## Resultado Esperado

Após as alterações:
1. A requisição preflight (OPTIONS) será aceita pelo servidor
2. O simulado poderá ser finalizado normalmente
3. Os warnings de `DialogTitle` desaparecerão do console
4. O Edge Function será redeployed automaticamente com as correções
