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

// ---------------------------------------------------------------------------
// Fase 2: pipeline parametrizado com diff (spec §5.2, P1–P4)
// ---------------------------------------------------------------------------

/** Corpo de UMA função: do CREATE até o `END $$;` que a fecha (sem comentários). */
function corpoDaFuncao(sql: string, nome: string): string {
  const inicio = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${nome}(`);
  expect(inicio, `CREATE de ${nome} ausente`).toBeGreaterThanOrEqual(0);
  const fim = sql.indexOf('END $$;', inicio);
  expect(fim, `fim de ${nome} ausente`).toBeGreaterThan(inicio);
  return sql.slice(inicio, fim + 'END $$;'.length);
}

describe('Fase 2: pipeline parametrizado com diff', () => {
  const fase2 = migrationsDaFase(2);
  const sql = fase2.map((m) => m.sql).join('\n');
  const classificacao = () => corpoDaFuncao(sql, 'eng_refresh_classificacao');
  const agregados = () => corpoDaFuncao(sql, 'eng_refresh_agregados');
  const refresh = () => corpoDaFuncao(sql, 'eng_refresh');

  it('existe exatamente uma migration da Fase 2', () => {
    expect(fase2.length).toBe(1);
  });

  it('as assinaturas novas têm o parâmetro com DEFAULT NULL', () => {
    expect(sql).toMatch(/FUNCTION public\.eng_refresh_classificacao\(p_questoes text\[\] DEFAULT NULL\)/);
    expect(sql).toMatch(/FUNCTION public\.eng_refresh_agregados\(p_desde date DEFAULT NULL\)/);
    expect(sql).toMatch(/FUNCTION public\.eng_refresh\(p_disparo text/);
  });

  it('eng_refresh_classificacao() e eng_refresh_agregados() sem parâmetro deixam de existir', () => {
    // percorre o histórico: a última ocorrência de cada assinatura () não pode ser um CREATE
    for (const nome of ['eng_refresh_classificacao', 'eng_refresh_agregados']) {
      let vivaSemParametro = false;
      for (const arquivo of migrationsOrdenadas()) {
        const texto = semComentarios(readMigration(arquivo));
        const eventos: { pos: number; vivo: boolean }[] = [];
        const reCreate = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nome}\\(\\s*\\)`, 'g');
        const reDrop = new RegExp(`DROP FUNCTION( IF EXISTS)? public\\.${nome}\\(\\s*\\)`, 'g');
        for (const m of texto.matchAll(reCreate)) eventos.push({ pos: m.index!, vivo: true });
        for (const m of texto.matchAll(reDrop)) eventos.push({ pos: m.index!, vivo: false });
        eventos.sort((a, b) => a.pos - b.pos);
        for (const e of eventos) vivaSemParametro = e.vivo;
      }
      expect(vivaSemParametro, `${nome}() ainda é a assinatura vigente`).toBe(false);
    }
  });

  it('o DROP das assinaturas antigas vem antes do CREATE das novas', () => {
    const dropClass = sql.search(/DROP FUNCTION( IF EXISTS)? public\.eng_refresh_classificacao\(\s*\)/);
    const dropAgreg = sql.search(/DROP FUNCTION( IF EXISTS)? public\.eng_refresh_agregados\(\s*\)/);
    expect(dropClass).toBeGreaterThanOrEqual(0);
    expect(dropAgreg).toBeGreaterThanOrEqual(0);
    expect(dropClass).toBeLessThan(sql.indexOf('CREATE OR REPLACE FUNCTION public.eng_refresh_classificacao('));
    expect(dropAgreg).toBeLessThan(sql.indexOf('CREATE OR REPLACE FUNCTION public.eng_refresh_agregados('));
  });

  it('REVOKE de PUBLIC, anon e authenticated para as três assinaturas novas', () => {
    const revoke = sql.match(/REVOKE ALL ON FUNCTION[\s\S]*?;/g)?.join('\n') ?? '';
    expect(revoke).toContain('public.eng_refresh_classificacao(text[])');
    expect(revoke).toContain('public.eng_refresh_agregados(date)');
    expect(revoke).toContain('public.eng_refresh(text)');
    expect(revoke).toMatch(/FROM\s+PUBLIC,\s*anon,\s*authenticated/);
  });

  it('nenhum DELETE FROM public.eng_<tabela> sem WHERE nos corpos das funções', () => {
    for (const corpo of [classificacao(), agregados(), refresh()]) {
      expect(corpo).not.toMatch(/DELETE\s+FROM\s+public\.eng_\w+(\s+\w+)?\s*;/i);
    }
  });

  it('todo DELETE em eng_* dos corpos tem WHERE', () => {
    for (const corpo of [classificacao(), agregados(), refresh()]) {
      for (const m of corpo.matchAll(/DELETE\s+FROM\s+public\.eng_\w+[\s\S]*?(RETURNING|;)/gi)) {
        expect(m[0]).toMatch(/\bWHERE\b/i);
      }
    }
  });

  it.each([
    'eng_consumo_aluno_dia_conteudo',
    'eng_questoes_aluno_dia_no',
    'eng_atividade_aluno_dia',
  ])('%s é gravada por ON CONFLICT DO UPDATE ... IS DISTINCT FROM', (tabela) => {
    const re = new RegExp(
      `INSERT INTO public\\.${tabela}[\\s\\S]*?ON CONFLICT[\\s\\S]*?DO UPDATE[\\s\\S]*?WHERE[\\s\\S]*?IS DISTINCT FROM`,
    );
    expect(agregados()).toMatch(re);
  });

  it('eng_questao_classificacao também é gravada por diff', () => {
    expect(classificacao()).toMatch(
      /INSERT INTO public\.eng_questao_classificacao[\s\S]*?ON CONFLICT[\s\S]*?DO UPDATE[\s\S]*?WHERE[\s\S]*?IS DISTINCT FROM/,
    );
  });

  it('a fonte é lida uma vez em w_resp e w_cons, filtradas por p_desde', () => {
    const a = agregados();
    expect(a).toMatch(/CREATE TEMP TABLE w_resp[\s\S]*?FROM public\.fato_resolucao_questoes_b2b[\s\S]*?p_desde IS NULL OR response_date >= p_desde/);
    expect(a).toMatch(/CREATE TEMP TABLE w_cons[\s\S]*?FROM public\.fato_consumo_conteudo_b2b[\s\S]*?p_desde IS NULL OR event_date >= p_desde/);
    // cada fato é lida exatamente uma vez no corpo todo
    expect((a.match(/FROM public\.fato_resolucao_questoes_b2b/g) ?? []).length).toBe(1);
    expect((a.match(/FROM public\.fato_consumo_conteudo_b2b/g) ?? []).length).toBe(1);
  });

  it('a atividade é gravada por último, depois de consumo e questões', () => {
    const a = agregados();
    const iCons = a.indexOf('INSERT INTO public.eng_consumo_aluno_dia_conteudo');
    const iQn = a.indexOf('INSERT INTO public.eng_questoes_aluno_dia_no');
    const iAtiv = a.indexOf('INSERT INTO public.eng_atividade_aluno_dia');
    expect(iCons).toBeGreaterThan(0);
    expect(iQn).toBeGreaterThan(iCons);
    expect(iAtiv).toBeGreaterThan(iQn);
  });

  it('as deleções ficam limitadas por p_questoes (classificação) e por p_desde (agregados)', () => {
    expect(classificacao()).toMatch(/p_questoes IS NULL OR t\.question_id = ANY \(p_questoes\)/);
    expect((agregados().match(/p_desde IS NULL OR t\.dia >= p_desde/g) ?? []).length).toBe(3);
  });

  it('as contagens de diff, a deriva e as cargas da fonte estão no retorno de eng_refresh_agregados', () => {
    const a = agregados();
    for (const chave of ['consumo_deriva', 'questoes_no_deriva', 'atividade_deriva', 'fonte_carregado_resp', 'fonte_carregado_cons']) {
      expect(a).toContain(`'${chave}'`);
    }
  });

  it('eng_refresh_classificacao devolve questoes_trocaram_folha', () => {
    expect(classificacao()).toContain("'questoes_trocaram_folha'");
  });

  it('eng_refresh usa pg_advisory_xact_lock com lock_timeout e grava o erro no log', () => {
    const r = refresh();
    expect(r).toMatch(/SET LOCAL lock_timeout\s*=\s*'10min'/);
    expect(r).toMatch(/pg_advisory_xact_lock\(hashtext\('eng_refresh'\)\)/);
    expect(r).not.toMatch(/pg_try_advisory_xact_lock/);
    expect(r).toMatch(/status = 'erro'/);
  });

  it('o log do rebuild é gravado antes do lock, para sobreviver a uma falha de lock', () => {
    const r = refresh();
    expect(r.indexOf('INSERT INTO public.eng_refresh_log')).toBeGreaterThan(0);
    expect(r.indexOf('INSERT INTO public.eng_refresh_log')).toBeLessThan(r.indexOf('pg_advisory_xact_lock'));
  });

  it("eng_refresh grava tipo 'completo' e chama as duas funções com NULL", () => {
    const r = refresh();
    expect(r).toMatch(/'rodando',\s*p_disparo,\s*'completo'/);
    expect(r).toMatch(/eng_refresh_classificacao\(NULL\)/);
    expect(r).toMatch(/eng_refresh_agregados\(NULL\)/);
  });

  it('eng_refresh sobe work_mem para o rebuild', () => {
    expect(refresh()).toMatch(/SET LOCAL work_mem\s*=\s*'64MB'/);
  });

  it('eng_refresh limpa o log incremental e o histórico do cron com mais de 7 dias, sem derrubar o rebuild', () => {
    const r = refresh();
    expect(r).toMatch(/DELETE FROM public\.eng_refresh_log WHERE tipo = 'incremental'[\s\S]*?interval '7 days'/);
    expect(r).toMatch(/DELETE FROM cron\.job_run_details[\s\S]*?interval '7 days'/);
    expect(r).toMatch(/EXCEPTION WHEN OTHERS THEN\s+NULL;/);
  });

  it('nenhum MERGE nem TRUNCATE na migration da fase', () => {
    expect(sql).not.toMatch(/\bMERGE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});
