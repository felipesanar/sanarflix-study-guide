import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Versão vigente da RPC: a migration de 11/08 22:14 passou admin a ver o
 * portal NOVO (decisão de produto), sobrescrevendo a de 20:23.
 */
const MIGRATION_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260811221429_fdfcae1e-c072-4772-b2f8-3a43a94cf15c.sql',
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf8').replace(/\r\n/g, '\n');
}

describe('get_gestor_portal_versao()', () => {
  it('admin vê o portal novo: retorna true sem olhar ies_features', () => {
    const sql = readMigration();
    expect(sql).toMatch(/IF public\.has_role\(v_uid, 'admin'::public\.app_role\) THEN\s*\n\s*RETURN true;/);
  });

  it('gestor_grupo resolve a lista de IES via get_accessible_ies', () => {
    const sql = readMigration();
    expect(sql).toMatch(/has_role\(v_uid, 'gestor_grupo'::public\.app_role\)[\s\S]{0,80}get_accessible_ies\(v_uid\)/);
  });

  it('usa NOT EXISTS sobre a lista de IES (bool_and), não bool_or', () => {
    const sql = readMigration();
    expect(sql).toMatch(/NOT EXISTS/i);
    expect(sql).not.toMatch(/bool_or/i);
  });

  it('ausência de linha em ies_features conta como false (COALESCE ... false)', () => {
    const sql = readMigration();
    expect(sql).toMatch(/COALESCE\(\s*\(SELECT f\.enabled FROM public\.ies_features f[\s\S]*?\),\s*false\s*\)/);
  });

  it('sem papel de gestão retorna false', () => {
    const sql = readMigration();
    expect(sql).toMatch(/ELSE\s*\n\s*RETURN false;/);
  });

  it('a chave de feature checada é gestao.portal_v2 — esta RPC é a exceção deliberada ao guard "gestao.portal_v2 nunca volta" das outras onze RPCs get_gestor_* (ver gestorMigrationsAvisosAlunoContatoContexto.test.ts), porque checar essa chave É o próprio trabalho dela', () => {
    const sql = readMigration();
    expect(sql).toMatch(/f\.feature_key = 'gestao\.portal_v2'/);
  });
});
