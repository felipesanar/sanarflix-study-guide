
Diagnóstico (na fonte dos dados)

- O erro não está só no frontend: há sobrecarga duplicada de RPCs no Supabase para os mesmos nomes.
- Confirmação em banco: existem duas assinaturas para cada função institucional principal, por exemplo:
  - `get_institutional_simulados()`
  - `get_institutional_simulados(p_ies_id uuid)`
- Com PostgREST/Supabase RPC, essa combinação gera exatamente o erro:  
  “Could not choose the best candidate function…”
- O `sw.js` está amplificando o problema visual (503 e logs de `Failed to fetch`), mas não é a causa raiz da ambiguidade da RPC.
- Há também um problema de UX no hook: quando falha ao buscar simulados, o estado pode ficar em loading/skeleton sem feedback claro.

Plano de correção (implementação)

1) Corrigir a causa raiz no Supabase (migração única, canônica)
- Criar migração para remover APENAS as assinaturas legadas ambíguas, mantendo as versões com `p_ies_id` opcional:
  - `DROP FUNCTION IF EXISTS public.get_institutional_simulados();`
  - `DROP FUNCTION IF EXISTS public.get_institutional_evolution();`
  - `DROP FUNCTION IF EXISTS public.get_institutional_performance(uuid);`
  - `DROP FUNCTION IF EXISTS public.get_institutional_student_scores(uuid);`
  - `DROP FUNCTION IF EXISTS public.get_institutional_question_details(uuid, text, text, text);`
- Resultado esperado: 1 assinatura por RPC institucional, sem ambiguidade.

2) Blindar chamadas frontend para coerência total
- `src/hooks/useInstitutionalPerformanceData.ts`:
  - manter chamadas sempre explícitas com `p_ies_id` quando aplicável.
  - em falha de `get_institutional_simulados`, setar `error` e encerrar `loading` corretamente (sem loop de skeleton).
  - evitar fallback silencioso para mock quando houver sessão autenticada e erro real de RPC (para não mascarar problema de dados).
- `src/pages/DesempenhoInstitucional.tsx` (legado):
  - parar de enviar `params` vazio ambíguo; normalizar chamada para assinatura canônica.

3) Reduzir interferência do Service Worker no diagnóstico e navegação
- `public/sw.js`:
  - subir `CACHE_VERSION` (ex.: `sanarflix-v3`) para invalidar bundle antigo.
  - evitar retornar 503 genérico para cenários não críticos de fetch (principalmente requisições cross-origin/ruído), preservando comportamento de navegação SPA.
- Objetivo: impedir cache antigo de manter código desatualizado e reduzir falsos sintomas.

4) Validação de ponta a ponta (dados reais)
- Banco:
  - consultar `pg_proc` e validar que cada RPC institucional ficou com assinatura única.
- App:
  - abrir `/desempenho-institucional-v2` e `/desempenho-institucional`.
  - confirmar carregamento de simulados sem PGRST203.
  - confirmar que, sem simulados, a UI mostra estado vazio explícito (não skeleton infinito).
  - confirmar ausência de mistura não sinalizada entre dado real e hipotético.

Critérios de aceite

- Nenhum log de ambiguidade de RPC para funções institucionais.
- Simulados carregam corretamente para perfis permitidos.
- Erros reais de dados ficam visíveis e acionáveis (sem mascaramento por mock).
- Navegação não fica presa em 503 por cache antigo do SW.
