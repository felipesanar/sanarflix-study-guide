
## Problema

O build publicado (`sanarflix-study-guide.lovable.app`) saiu sem as `VITE_*` injetadas (Supabase URL/anon key ausentes no bundle). Como `src/config/env.ts` faz `throw new Error(...)` quando `APP_ENV === 'production'`, o app fica em tela branca — sem fallback visual, sem indício pro usuário do que aconteceu.

Causas possíveis do build vazio:
- O `.env` gerenciado da Lovable não estava presente/atualizado no momento do publish.
- A integração Supabase precisa ser reconectada para regenerar as vars.

A correção tem duas frentes: **resiliência** (nunca mais tela branca) + **reprodução** (reconectar Supabase e republicar).

## Mudanças de código (resiliência)

### 1. `src/config/env.ts` — não derrubar o app em produção
- Remover o `throw new Error(...)` quando `APP_ENV === 'production'`.
- Em vez disso: logar o erro detalhado (`Logger.error`) e expor um marcador `env.IS_VALID = false` + manter os fallbacks atuais.
- Adicionar `IS_VALID: boolean` ao schema/`AppEnv` (default `true` no caminho feliz).

### 2. `src/main.tsx` — tela de erro amigável quando env é inválida
- Após o `runStartupDiagnostics`, importar `env` e checar `env.IS_VALID`.
- Se inválido, renderizar uma tela equivalente à de "Erro de Carregamento" já existente, com mensagem:
  - "Configuração de ambiente ausente. Atualize a página em alguns instantes ou contate o suporte."
  - Botão "Recarregar".
- Isso garante: nunca mais página em branco, sempre algo renderizado, mesmo se republicação futura sair quebrada.

### 3. (Opcional) `src/test/unit/env.test.ts`
- Manter testes atuais; adicionar nota de que `IS_VALID` é `true` no ambiente de teste (Vitest injeta envs válidas via `.env` ou mocks).

## Ações fora do código (reprodução do build válido)

Após o merge das mudanças acima:

1. **Reconectar a integração Supabase na Lovable** (botão de refresh em Settings → Integrations → Supabase) para regenerar o `.env` gerenciado com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PROJECT_ID`.
2. **Verificar no preview** (`id-preview--…lovable.app`) que o app carrega normal e que `import.meta.env.VITE_SUPABASE_URL` existe (pode-se logar uma vez).
3. **Republicar** via botão Publish para gerar novo bundle (`index-XXXX.js`) com as vars inlinadas.
4. **Validar** `sanarflix-study-guide.lovable.app` carregando a tela de login sem erro no console.

## Fora de escopo

- Não vamos mexer em outras features (Modo Prova, Calendar v2, etc.).
- Não vamos alterar `.gitignore` nem comitar `.env` (vars são injetadas pelo build da Lovable).
- Não vamos alterar `.env.example` (já está correto).

## Critério de aceite

- Mesmo com envs ausentes, o app publicado renderiza uma tela de erro amigável (não fica em branco).
- Após reconectar Supabase + republicar, `sanarflix-study-guide.lovable.app/login` carrega normalmente.
