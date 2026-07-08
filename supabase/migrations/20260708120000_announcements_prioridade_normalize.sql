-- =============================================================================
-- announcements.prioridade — normalização de vocabulário (canônico minúsculo)
-- =============================================================================
-- ATENÇÃO: este arquivo é SÓ o SQL da migration. Este projeto Supabase NÃO é
-- gerenciado via push automático (Lovable/CLI) — a aplicação em produção deve
-- ser feita manualmente (SQL editor do Supabase ou rotina combinada com o
-- time). Este agente não tem acesso ao MCP do Supabase e não aplicou nada.
--
-- Contexto (achado de auditoria — Avisos, item 7):
--   O admin grava `prioridade` em minúsculas canônicas
--   ('baixa'|'media'|'alta'|'critica'), mas a CHECK original (migration
--   20251031015858_4c9e2a85-5a21-4b13-8e3a-a55e5fb7e9bf.sql) só permite
--   ('baixa','media','alta') — sem 'critica'. Além disso, código antigo do
--   editor (mapPriorityForDB, removido nesta mudança) gravava o legado
--   'Muito Alta'/'Alta'/'Media'/'Baixa' em produção antes da canonização.
--   Esta migration:
--     1. Remove a CHECK antiga (nome default do Postgres para constraint
--        inline é `announcements_prioridade_check`; cobrimos também, via
--        bloco dinâmico, o caso de o nome real em prod ser outro).
--     2. Faz backfill dos valores legados para o vocabulário canônico.
--     3. Recria a CHECK já com os 4 valores canônicos.
-- =============================================================================

BEGIN;

-- 1a) Remove a CHECK pelo nome default esperado (IF EXISTS — não falha se já
--     tiver outro nome ou não existir).
ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_prioridade_check;

-- 1b) Defensivo: caso o nome real em prod seja diferente do default (ex.: se
--     a constraint foi recriada manualmente em algum momento), procura
--     qualquer CHECK constraint da coluna `prioridade` e remove.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT DISTINCT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att
      ON att.attrelid = rel.oid
     AND att.attnum = ANY (con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'announcements'
      AND con.contype = 'c'
      AND att.attname = 'prioridade'
  LOOP
    EXECUTE format('ALTER TABLE public.announcements DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- 2) Backfill dos valores legados conhecidos para o vocabulário canônico.
UPDATE public.announcements SET prioridade = 'critica' WHERE prioridade = 'Muito Alta';
UPDATE public.announcements SET prioridade = 'alta'    WHERE prioridade = 'Alta';
UPDATE public.announcements SET prioridade = 'media'   WHERE prioridade IN ('Media', 'Média');
UPDATE public.announcements SET prioridade = 'baixa'   WHERE prioridade = 'Baixa';

-- Defensivo: qualquer valor fora do vocabulário canônico e não coberto acima
-- (não esperado) cai em 'media' para não travar a nova CHECK.
UPDATE public.announcements
SET prioridade = 'media'
WHERE prioridade NOT IN ('baixa', 'media', 'alta', 'critica');

-- 3) Nova CHECK com os 4 valores canônicos.
ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_prioridade_check
  CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica'));

COMMIT;
