/**
 * Testes estáticos do refresh incremental da camada `eng_*`.
 *
 * Spec: docs/superpowers/specs/2026-10-28-engajamento-refresh-incremental-design.md
 * (§5 desenho técnico, §6 fases e DoDs). Cada fase acrescenta casos aqui.
 *
 * Não há banco: o arquivo lê o texto das migrations da fase e prova o que não
 * pode regredir. Os testes foram escritos a partir da spec, não da migration.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

function readMigration(filename: string): string {
  // CRLF -> LF: com core.autocrlf=true o checkout materializa os .sql com \r\n.
  return readFileSync(join(MIGRATIONS_DIR, filename), 'utf8').replace(/\r\n/g, '\n');
}

const migrationsOrdenadas = () =>
  readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

/** Remove linhas que são só comentário SQL (a prosa não é executada). */
const semComentarios = (texto: string) =>
  texto
    .split('\n')
    .filter((linha) => !/^\s*--/.test(linha))
    .join('\n');

/** Migrations da fase N: `AAAAMMDDHHMMSS_eng_incremental_faseN_<assunto>.sql`. */
function migrationsDaFase(n: number): { arquivo: string; sql: string }[] {
  return migrationsOrdenadas()
    .filter((f) => new RegExp(`^\\d{14}_eng_incremental_fase${n}_.+\\.sql$`).test(f))
    .map((arquivo) => ({ arquivo, sql: semComentarios(readMigration(arquivo)) }));
}

const tabelasAgregado = [
  'eng_atividade_aluno_dia',
  'eng_questoes_aluno_dia_no',
  'eng_consumo_aluno_dia_conteudo',
];

describe('Fase 1: suporte de schema (spec §5.1)', () => {
  const fase1 = migrationsDaFase(1);
  const sql = fase1.map((m) => m.sql).join('\n');

  it('existe exatamente uma migration da Fase 1', () => {
    expect(fase1.length).toBe(1);
  });

  it.each([
    ['eng_questoes_aluno_dia_no', 'eng_questoes_aluno_dia_no_dia_idx'],
    ['eng_consumo_aluno_dia_conteudo', 'eng_consumo_aluno_dia_conteudo_dia_idx'],
  ])('cria o índice por (dia) em %s', (tabela, indice) => {
    const re = new RegExp(
      `CREATE INDEX( IF NOT EXISTS)? ${indice}\\s+ON public\\.${tabela}\\s*\\(\\s*dia\\s*\\)`,
      'i',
    );
    expect(sql).toMatch(re);
  });

  it.each(tabelasAgregado)('%s recebe fillfactor 85 e autovacuum agressivo', (tabela) => {
    const re = new RegExp(`ALTER TABLE public\\.${tabela}\\s+SET\\s*\\(([^)]*)\\)`, 'i');
    const m = sql.match(re);
    expect(m, `ALTER TABLE ${tabela} SET (...) ausente`).not.toBeNull();
    const opcoes = m![1];
    expect(opcoes).toMatch(/fillfactor\s*=\s*85/);
    expect(opcoes).toMatch(/autovacuum_vacuum_scale_factor\s*=\s*0\.02/);
    expect(opcoes).toMatch(/autovacuum_analyze_scale_factor\s*=\s*0\.02/);
  });

  it('eng_refresh_log ganha a coluna tipo com CHECK e DEFAULT completo', () => {
    expect(sql).toMatch(/ALTER TABLE public\.eng_refresh_log\s+ADD COLUMN( IF NOT EXISTS)? tipo text NOT NULL DEFAULT 'completo'/i);
    expect(sql).toMatch(/CHECK\s*\(\s*tipo IN \('completo',\s*'incremental'\)\s*\)/i);
  });

  it("o CHECK de status passa a aceitar 'pulado' e mantém os antigos", () => {
    expect(sql).toMatch(/DROP CONSTRAINT( IF EXISTS)? eng_refresh_log_status_check/i);
    const m = sql.match(/ADD CONSTRAINT eng_refresh_log_status_check\s+CHECK\s*\(\s*status IN \(([^)]*)\)\s*\)/i);
    expect(m, 'ADD CONSTRAINT eng_refresh_log_status_check ausente').not.toBeNull();
    for (const s of ['rodando', 'ok', 'erro', 'pulado']) expect(m![1]).toContain(`'${s}'`);
  });

  it('o DROP do CHECK vem antes do ADD', () => {
    expect(sql.search(/DROP CONSTRAINT( IF EXISTS)? eng_refresh_log_status_check/i)).toBeLessThan(
      sql.search(/ADD CONSTRAINT eng_refresh_log_status_check/i),
    );
  });

  it('cria o índice parcial (tipo, terminado_em DESC) WHERE status = ok', () => {
    expect(sql).toMatch(
      /CREATE INDEX( IF NOT EXISTS)? eng_refresh_log_tipo_ok_idx\s+ON public\.eng_refresh_log\s*\(\s*tipo,\s*terminado_em DESC\s*\)\s*WHERE status = 'ok'/i,
    );
  });

  it('nenhuma migration da fase tem TRUNCATE nem VACUUM FULL', () => {
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bVACUUM\s+FULL\b/i);
  });
});
