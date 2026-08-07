/**
 * Testes estáticos da migration `20260807023000_hardening_funcoes_de_papel.sql`
 * (Task 5 do PR 1 de simplificação de acesso, 07/08) — `get_user_roles` e
 * `get_accessible_ies` deixam de aceitar UUID de qualquer usuário sem conferir
 * se é o do chamador.
 *
 * Risco central: a edge function `supabase/functions/auth-login/index.ts`
 * chama as duas com o client `service_role`, ANTES de existir sessão —
 * `auth.uid()` é nulo naquele contexto. Uma checagem ingênua de "só o próprio
 * UUID" derrubaria o login de todo mundo. O ramo `current_user <> 'service_role'`
 * é o que evita isso, e é seguro porque `anon` não tem EXECUTE nas duas
 * (confirmado em produção em 07/08) — só `service_role` alcança o caminho de
 * `auth.uid()` nulo.
 *
 * A checagem de admin é inline (`EXISTS` sobre `user_roles`), nunca via
 * `has_role` — chamar `has_role` aqui criaria recursão, porque ela mesma é
 * usada por RLS policies que, indiretamente, dependem destas funções.
 *
 * `has_role(uuid, app_role)` fica de fora do hardening por decisão registrada
 * no cabeçalho da migration: é chamada por dezenas de RLS policies a cada
 * linha avaliada, e um `EXISTS` extra ali custaria em toda leitura do app.
 *
 * Não há harness de pgTAP neste repo — este arquivo é análise de texto sobre
 * a migration (mesmo método de `corpoDaFuncao` usado nos testes de
 * `gestorMigrations*`), não teste de execução real contra o Postgres.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const FILE = '20260807023000_hardening_funcoes_de_papel.sql';

function readMigration(filename: string): string {
  // Normaliza CRLF -> LF: numa maquina com core.autocrlf=true, o checkout
  // materializa estes .sql com \r\n, e as assercoes abaixo (indexOf/toMatch
  // com "\n" puro) nunca casariam sem isto. Ver .gitattributes (*.sql eol=lf).
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8').replace(/\r\n/g, '\n');
}

const sql = readMigration(FILE);

/** O `(` no fim nao e enfeite: sem ele, `get_accessible_ies` casaria com
 *  qualquer outra funcao cujo nome comece com o mesmo prefixo. */
const cabecalhoDe = (nome: string) => `CREATE OR REPLACE FUNCTION public.${nome}(`;

/** Corpo de UMA funcao: do seu CREATE até o dollar-quote que o fecha (lido de
 *  `AS $tag$`, nao fixado -- esta migration usa `$function$` nas duas). */
function corpoDaFuncao(texto: string, nome: string): string {
  const inicio = texto.indexOf(cabecalhoDe(nome));
  expect(inicio, `função ${nome} não encontrada em ${FILE}`).toBeGreaterThanOrEqual(0);
  const abertura = /\bAS\s+(\$[A-Za-z_]*\$)/.exec(texto.slice(inicio));
  expect(abertura, `não achei o dollar-quote que abre o corpo de ${nome}`).not.toBeNull();
  const tag = abertura![1];
  const fim = texto.indexOf(`${tag};`, inicio + abertura!.index + abertura![0].length);
  expect(fim, `função ${nome} não fecha com ${tag};`).toBeGreaterThan(inicio);
  return texto.slice(inicio, fim + tag.length + 1);
}

describe('Task 5 (07/08) — migration 20260807023000_hardening_funcoes_de_papel.sql', () => {
  it('recria as duas funcoes com CREATE OR REPLACE (nunca DROP)', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_user_roles\(/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_accessible_ies\(/);
    expect(sql).not.toMatch(/DROP FUNCTION/);
  });

  it('get_user_roles recusa UUID de terceiro', () => {
    const corpo = corpoDaFuncao(sql, 'get_user_roles');
    expect(corpo).toMatch(/_user_id IS DISTINCT FROM auth\.uid\(\)/);
    expect(corpo).toMatch(/RAISE EXCEPTION 'Access denied'/);
  });

  it('get_accessible_ies recusa UUID de terceiro', () => {
    const corpo = corpoDaFuncao(sql, 'get_accessible_ies');
    expect(corpo).toMatch(/_user IS DISTINCT FROM auth\.uid\(\)/);
    expect(corpo).toMatch(/RAISE EXCEPTION 'Access denied'/);
  });

  it('a checagem de admin e inline, nao via has_role (evita recursao)', () => {
    const corpoRoles = corpoDaFuncao(sql, 'get_user_roles');
    const corpoIes = corpoDaFuncao(sql, 'get_accessible_ies');
    expect(corpoRoles).toMatch(/FROM public\.user_roles r/);
    expect(corpoRoles).not.toMatch(/has_role\s*\(/);
    expect(corpoIes).toMatch(/FROM public\.user_roles r/);
    expect(corpoIes).not.toMatch(/has_role\s*\(/);
  });

  it('preserva o ramo de service_role, senao o login quebra', () => {
    expect(corpoDaFuncao(sql, 'get_user_roles')).toMatch(/current_user <> 'service_role'/);
    expect(corpoDaFuncao(sql, 'get_accessible_ies')).toMatch(/current_user <> 'service_role'/);
  });

  it('get_accessible_ies preserva a logica exata de UNION (propria IES + grupos)', () => {
    const corpo = corpoDaFuncao(sql, 'get_accessible_ies');
    expect(corpo).toMatch(
      /SELECT id_ies AS ies_id FROM public\.users WHERE id = _user AND id_ies IS NOT NULL/,
    );
    expect(corpo).toMatch(/UNION/);
    expect(corpo).toMatch(
      /SELECT gi\.ies_id\s+FROM public\.user_groups ug\s+JOIN public\.group_ies gi ON gi\.group_id = ug\.group_id\s+WHERE ug\.user_id = _user/,
    );
  });

  it('has_role NAO e recriada (decisao registrada no cabecalho)', () => {
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.has_role\b/);
  });

  it('anon fica sem EXECUTE; authenticated e service_role mantem', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.get_user_roles\(uuid\) FROM public, anon;/);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_user_roles\(uuid\) TO authenticated, service_role;/,
    );
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.get_accessible_ies\(uuid\) FROM public, anon;/);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_accessible_ies\(uuid\) TO authenticated, service_role;/,
    );
  });

  it('o cabecalho registra que a migration nao foi aplicada em producao', () => {
    expect(sql).toMatch(/NAO FOI APLICADA em producao/);
  });
});
