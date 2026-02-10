
# Plano: Atualizar todas as referencias de URL para academy.sanar.com.br

## Resumo

A mudanca do dominio live para `https://academy.sanar.com.br` impacta **10 arquivos** em 4 categorias. Todas as URLs hardcoded que apontam para `sanarflix-study-guide.lovable.app` (ou `guiadeestudos.sanar.com.br`) precisam ser atualizadas para o novo dominio de producao.

## Arquivos impactados

### 1. CORS — Adicionar `academy.sanar.com.br` (2 funcoes que tem listas proprias)

| Arquivo | Problema |
|---------|----------|
| `supabase/functions/study-guide-proxy/index.ts` | Lista ALLOWED_ORIGINS nao inclui `academy.sanar.com.br` |
| `supabase/functions/enamed-proxy/index.ts` | Lista ALLOWED_ORIGINS nao inclui `academy.sanar.com.br` |

**Acao:** Adicionar `'https://academy.sanar.com.br'` ao Set de cada arquivo.

### 2. URLs de redirecionamento em e-mails e convites (5 arquivos)

| Arquivo | URL atual | Nova URL |
|---------|-----------|----------|
| `supabase/functions/b2b-create-user/index.ts` (linha 262) | `sanarflix-study-guide.lovable.app/auth/update-password` | `academy.sanar.com.br/auth/update-password` |
| `supabase/functions/custom-email-templates/index.ts` (linhas 94, 105, 116) | `preview--sanarflix-study-guide.lovable.app/reset-password`, `.../auth/update-password`, `sanarflix-study-guide.lovable.app/` | `academy.sanar.com.br/reset-password`, `.../auth/update-password`, `academy.sanar.com.br/` |
| `supabase/functions/custom-email-templates/_templates/reset-password.tsx` (linhas 38, 58) | Logo e redirect com `sanarflix-study-guide.lovable.app` | `academy.sanar.com.br` |
| `supabase/functions/custom-email-templates/_templates/invite-user.tsx` (linhas 31, 41) | Redirect e logo com `sanarflix-study-guide.lovable.app` | `academy.sanar.com.br` |
| `supabase/functions/custom-email-templates/_templates/magic-link.tsx` (linhas 38, 58) | Logo e redirect com `sanarflix-study-guide.lovable.app` | `academy.sanar.com.br` |

### 3. Links em e-mails de notificacao (1 arquivo)

| Arquivo | URL atual | Nova URL |
|---------|-----------|----------|
| `supabase/functions/notify-performance-released/index.ts` (linha 181) | `sanarflix-study-guide.lovable.app/simulados?aba=desempenho` | `academy.sanar.com.br/simulados?aba=desempenho` |

### 4. Configuracao do Supabase Auth (1 arquivo)

| Arquivo | URL atual | Nova URL |
|---------|-----------|----------|
| `supabase/config.toml` (linha 12) | `site_url = "https://sanarflix-study-guide.lovable.app"` | `site_url = "https://academy.sanar.com.br"` |

### 5. PDF (1 arquivo frontend)

| Arquivo | URL atual | Nova URL |
|---------|-----------|----------|
| `src/utils/pdfGabarito.ts` (linha 591) | `sanarflix-study-guide.lovable.app` | `academy.sanar.com.br` |

---

## Nota sobre imagens nos e-mails

Os templates de e-mail referenciam logos hospedados em `https://sanarflix-study-guide.lovable.app/lovable-uploads/...`. Essas URLs de imagem tambem serao atualizadas para `https://academy.sanar.com.br/lovable-uploads/...`, pois o novo dominio deve servir os mesmos arquivos estaticos.

## Secao tecnica

### Resumo das alteracoes por arquivo:

1. **`supabase/functions/study-guide-proxy/index.ts`** — adicionar `'https://academy.sanar.com.br'` ao Set (linha 8)
2. **`supabase/functions/enamed-proxy/index.ts`** — adicionar `'https://academy.sanar.com.br'` ao Set (linha 7)
3. **`supabase/functions/b2b-create-user/index.ts`** — substituir URL de redirect (linha 262)
4. **`supabase/functions/custom-email-templates/index.ts`** — substituir 3 URLs de redirect (linhas 94, 105, 116)
5. **`supabase/functions/custom-email-templates/_templates/reset-password.tsx`** — substituir URL do logo e redirect (linhas 38, 58)
6. **`supabase/functions/custom-email-templates/_templates/invite-user.tsx`** — substituir URL do logo e redirect (linhas 31, 41)
7. **`supabase/functions/custom-email-templates/_templates/magic-link.tsx`** — substituir URL do logo e redirect (linhas 38, 58)
8. **`supabase/functions/notify-performance-released/index.ts`** — substituir URL do botao (linha 181)
9. **`supabase/config.toml`** — atualizar `site_url` (linha 12)
10. **`src/utils/pdfGabarito.ts`** — atualizar URL no rodape do PDF (linha 591)

Apos as edicoes, todas as edge functions impactadas serao redeployadas automaticamente.
