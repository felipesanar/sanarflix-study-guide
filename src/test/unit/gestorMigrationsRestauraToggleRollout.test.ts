// src/test/unit/gestorMigrationsRestauraToggleRollout.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260811140000_gestor_restaura_console_antigo_toggle_rollout.sql',
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf8').replace(/\r\n/g, '\n');
}

describe('migration 20260811140000 - restaura toggle de rollout do console antigo', () => {
  it('restaura as 3 chaves de módulo em feature_catalog', () => {
    const sql = readMigration();
    expect(sql).toContain("'gestao.enabled'");
    expect(sql).toContain("'gestao.exportar'");
    expect(sql).toContain("'gestao.ia'");
  });

  it('libera as 3 chaves de módulo para TODAS as IES de public.ies, não uma lista fixa de ids', () => {
    const sql = readMigration();
    expect(sql).toMatch(/insert into public\.ies_features[\s\S]*?from public\.ies i/i);
    expect(sql).not.toMatch(/values\s*\(\s*'[0-9a-f-]{36}'/i);
  });

  it('cria a chave gestao.portal_v2 em feature_catalog', () => {
    const sql = readMigration();
    expect(sql).toContain("'gestao.portal_v2'");
  });

  it('NÃO insere nenhuma linha de gestao.portal_v2 em ies_features (toda IES nasce no console antigo)', () => {
    const sql = readMigration();
    const insertsDeIesFeatures = sql.match(/insert into public\.ies_features[\s\S]*?;/gi) ?? [];
    for (const bloco of insertsDeIesFeatures) {
      expect(bloco).not.toContain('gestao.portal_v2');
    }
  });

  it('não edita nenhuma migration existente (arquivo é só INSERT, sem DELETE/ALTER/DROP)', () => {
    const sql = readMigration();
    expect(sql).not.toMatch(/\b(delete|alter table|drop)\b/i);
  });
});
