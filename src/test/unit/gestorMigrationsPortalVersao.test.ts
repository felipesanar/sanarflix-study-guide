import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260811142000_get_gestor_portal_versao.sql',
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf8').replace(/\r\n/g, '\n');
}

describe('get_gestor_portal_versao()', () => {
  it('admin sempre retorna true, sem depender de ies_features', () => {
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
});
