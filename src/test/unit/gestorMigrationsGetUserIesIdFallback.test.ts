// src/test/unit/gestorMigrationsGetUserIesIdFallback.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function readMigration(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8').replace(/\r\n/g, '\n');
}

function migrationsOrdenadas(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/** A migration mais recente que recria a função é a vigente. */
function vigente(nome: string): { arquivo: string; sql: string } {
  const marca = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nome}\\(`, 'i');
  const candidatos = migrationsOrdenadas()
    .map((arquivo) => ({ arquivo, sql: readMigration(arquivo) }))
    .filter(({ sql }) => marca.test(sql));
  const ultima = candidatos[candidatos.length - 1];
  if (!ultima) throw new Error(`Nenhuma migration recria ${nome}`);
  return ultima;
}

describe('get_user_ies_id() - fallback para gestor_grupo', () => {
  it('a versão vigente é a migration 20260811141000', () => {
    const { arquivo } = vigente('get_user_ies_id');
    expect(arquivo).toBe('20260811141000_get_user_ies_id_fallback_gestor_grupo.sql');
  });

  it('continua lendo users.id_ies primeiro (não quebra o caminho de gestor puro)', () => {
    const { sql } = vigente('get_user_ies_id');
    expect(sql).toMatch(/SELECT id_ies INTO user_ies_id\s+FROM public\.users\s+WHERE id = auth\.uid\(\)/i);
  });

  it('cai em get_accessible_ies quando id_ies é nulo', () => {
    const { sql } = vigente('get_user_ies_id');
    expect(sql).toMatch(/IF user_ies_id IS NULL THEN/i);
    expect(sql).toMatch(/get_accessible_ies\(auth\.uid\(\)\)\)\[1\]/);
  });

  it('mantém a assinatura sem parâmetros e RETURNS uuid', () => {
    const { sql } = vigente('get_user_ies_id');
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_user_ies_id\(\)\s*\nRETURNS uuid/i);
  });
});
