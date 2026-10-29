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
  // a versão vigente é a última definição (a Fase 3 recria funções da Fase 2)
  const inicio = sql.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${nome}(`);
  expect(inicio, `CREATE de ${nome} ausente`).toBeGreaterThanOrEqual(0);
  // o dollar-quote que abre o corpo (`$$` ou `$function$`) é o mesmo que o fecha
  const abertura = /\bAS\s+(\$[A-Za-z_]*\$)/.exec(sql.slice(inicio));
  expect(abertura, `dollar-quote de ${nome} ausente`).not.toBeNull();
  const tag = abertura![1];
  const fim = sql.indexOf(tag, inicio + abertura!.index + abertura![0].length);
  expect(fim, `fim de ${nome} ausente`).toBeGreaterThan(inicio);
  return sql.slice(inicio, fim + tag.length);
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

// ---------------------------------------------------------------------------
// Fase 3: incremental manual, sem cron (spec §5.2, P4–P6, I5)
// ---------------------------------------------------------------------------
describe('Fase 3: eng_delta_questoes e eng_refresh_incremental', () => {
  const fase3 = migrationsDaFase(3);
  const sql = fase3.map((m) => m.sql).join('\n');
  const incremental = () => corpoDaFuncao(sql, 'eng_refresh_incremental');
  const delta = () => corpoDaFuncao(sql, 'eng_delta_questoes');

  it('a Fase 3 tem duas migrations: o incremental e a leitura única da janela', () => {
    expect(fase3.length).toBe(2);
  });

  it('as assinaturas seguem a spec', () => {
    expect(sql).toMatch(/FUNCTION public\.eng_delta_questoes\(p_questoes text\[\], p_ate date, p_sinal smallint\)/);
    expect(sql).toMatch(/FUNCTION public\.eng_refresh_incremental\(\)/);
  });

  it('REVOKE de PUBLIC, anon e authenticated nas duas funções', () => {
    const revoke = sql.match(/REVOKE ALL ON FUNCTION[\s\S]*?;/g)?.join('\n') ?? '';
    expect(revoke).toContain('public.eng_delta_questoes(text[], date, smallint)');
    expect(revoke).toContain('public.eng_refresh_incremental()');
    expect(revoke).toMatch(/FROM\s+PUBLIC,\s*anon,\s*authenticated/);
  });

  it("o incremental tenta o lock sem esperar e grava 'pulado' quando não consegue", () => {
    const i = incremental();
    expect(i).toMatch(/pg_try_advisory_xact_lock\(hashtext\('eng_refresh'\)\)/);
    expect(i).not.toMatch(/PERFORM pg_advisory_xact_lock/);
    expect(i).toMatch(/'pulado'/);
    // o 'pulado' é gravado antes de qualquer cálculo
    expect(i.indexOf("'pulado'")).toBeLessThan(i.indexOf('eng_refresh_agregados'));
  });

  it('o log do incremental tem tipo incremental', () => {
    expect(incremental()).toMatch(/'rodando',\s*v_disparo,\s*'incremental'|\(status, disparo, tipo\)\s*VALUES \('rodando', v_disparo, 'incremental'\)/);
    expect(incremental()).toMatch(/'incremental'/);
  });

  it('a janela quente é eng_hoje() - 3', () => {
    expect(incremental()).toMatch(/v_desde\s*:=\s*public\.eng_hoje\(\)\s*-\s*3/);
  });

  it('o incremental não lê dim_aluno_b2b (P6)', () => {
    expect(incremental()).not.toMatch(/dim_aluno_b2b/);
    expect(delta()).not.toMatch(/dim_aluno_b2b/);
  });

  it('o incremental não chama as funções do rebuild com NULL', () => {
    const i = incremental();
    expect(i).not.toMatch(/eng_refresh_classificacao\(\s*NULL\s*\)/i);
    expect(i).not.toMatch(/eng_refresh_agregados\(\s*NULL\s*\)/i);
    expect(i).not.toMatch(/eng_refresh\(/);
  });

  it('os agregados são recalculados com a janela (v_desde)', () => {
    expect(incremental()).toMatch(/eng_refresh_agregados\(v_desde\)/);
  });

  it('só questões sem classificação entram na classificação incremental (I5)', () => {
    const i = incremental();
    expect(i).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.eng_questao_classificacao/);
    expect(i).toMatch(/eng_refresh_classificacao\(v_novas\)/);
  });

  it("a taxonomia ausente só entra se houver de-para e carga recente", () => {
    const i = incremental();
    expect(i).toMatch(/taxonomia_status <> 'ausente'/);
    expect(i).toMatch(/eng_depara_quiz_no/);
    expect(i).toMatch(/carregado_em >/);
    expect(i).toMatch(/interval '1 hour'/);
  });

  it('o delta histórico vai só até v_desde e só para o que ganhou classificação, com sinal +1', () => {
    expect(incremental()).toMatch(/eng_delta_questoes\(v_classificadas,\s*v_desde,\s*1::smallint\)/);
  });

  it('a classificação vem antes do delta e o delta antes dos agregados', () => {
    const i = incremental();
    const iClass = i.indexOf('eng_refresh_classificacao(v_novas)');
    const iDelta = i.indexOf('eng_delta_questoes(');
    const iAgreg = i.indexOf('eng_refresh_agregados(v_desde)');
    expect(iClass).toBeGreaterThan(0);
    expect(iDelta).toBeGreaterThan(iClass);
    expect(iAgreg).toBeGreaterThan(iDelta);
  });

  it('o incremental grava ok com contagens e erro com SQLSTATE', () => {
    const i = incremental();
    expect(i).toMatch(/status = 'ok'[\s\S]*?contagens/);
    expect(i).toMatch(/EXCEPTION WHEN OTHERS THEN[\s\S]*?status = 'erro'[\s\S]*?SQLSTATE/);
  });

  it('eng_delta_questoes tem o teto P5 de 20.000 respostas e devolve delta_adiado', () => {
    const d = delta();
    expect(d).toMatch(/v_teto\s+constant integer\s*:=\s*20000/);
    expect(d).toMatch(/v_n\s*>\s*v_teto/);
    expect(d).toContain("'delta_adiado', true");
    // o teto é conferido antes de qualquer escrita
    expect(d.indexOf('v_n > v_teto')).toBeLessThan(d.indexOf('INSERT INTO public.eng_questoes_aluno_dia_no'));
  });

  it('eng_delta_questoes só aceita sinal +1 ou -1', () => {
    expect(delta()).toMatch(/p_sinal NOT IN \(1, -1\)/);
  });

  it('o delta só olha dias anteriores a p_ate', () => {
    const d = delta();
    const usos = d.match(/response_date < p_ate/g) ?? [];
    expect(usos.length).toBe(2); // contagem do teto e agregação
  });

  it('o +1 soma com ON CONFLICT e o respostas_todas nunca é tocado', () => {
    const d = delta();
    expect(d).toMatch(/ON CONFLICT \(sanarflix_user_id, dia, folha_id\) DO UPDATE\s+SET questoes = t\.questoes \+ EXCLUDED\.questoes/);
    expect(d).not.toMatch(/SET[^;]*respostas_todas/);
  });

  it('o -1 apaga a linha que chegaria a zero antes de subtrair (CHECK questoes > 0)', () => {
    const d = delta();
    const iDel = d.indexOf('DELETE FROM public.eng_questoes_aluno_dia_no');
    const iSub = d.indexOf('SET questoes = t.questoes - d.questoes');
    expect(iDel).toBeGreaterThan(0);
    expect(iSub).toBeGreaterThan(iDel);
    expect(d).toMatch(/t\.questoes <= d\.questoes/);
  });

  it('cada função tem o seu par de dollar-quotes ($$ ... $$)', () => {
    const funcoes = (sql.match(/CREATE OR REPLACE FUNCTION/g) ?? []).length;
    expect(funcoes).toBe(6);
    expect((sql.match(/\$\$/g) ?? []).length).toBe(funcoes * 2);
    expect(sql).not.toMatch(/^AS \$\s*$/m);
    expect(sql).not.toMatch(/^END \$;/m);
  });

  it('a dim só é lida num IF p_desde IS NULL, fora de qualquer SELECT maior (P6: o planejamento trava a relação)', () => {
    const a = corpoDaFuncao(sql, 'eng_refresh_agregados');
    const usos = a.match(/dim_aluno_b2b/g) ?? [];
    expect(usos.length).toBe(1);
    expect(a).toMatch(/IF p_desde IS NULL THEN\s+SELECT max\(snapshot_date\) INTO v_dim FROM public\.dim_aluno_b2b;\s+END IF;/);
    expect(a).not.toMatch(/CASE WHEN p_desde IS NULL THEN \(SELECT[^)]*dim_aluno_b2b/);
  });

  it('o delta +1 confere a coerência da atividade antes de escrever e adia em vez de falhar', () => {
    const d = delta();
    expect(d).toContain("'delta_incoerentes'");
    expect(d).toMatch(/t\.respostas_todas < t\.questoes \+ d\.questoes/);
    expect(d.indexOf("'delta_incoerentes'")).toBeLessThan(d.indexOf('INSERT INTO public.eng_questoes_aluno_dia_no'));
  });

  it('a janela de respostas é lida uma vez: o incremental monta w_resp e tira as questões novas dele', () => {
    const i = incremental();
    expect(i).toMatch(/PERFORM public\.eng_monta_w_resp\(v_desde\)/);
    expect(i).toMatch(/FROM w_resp r\s+WHERE NOT EXISTS/);
    // sem uma segunda leitura da fato no incremental
    expect(i).not.toMatch(/fato_resolucao_questoes_b2b/);
    expect(i.indexOf('eng_monta_w_resp')).toBeLessThan(i.indexOf('eng_refresh_classificacao(v_novas)'));
  });

  it('eng_refresh_agregados só reaproveita o w_resp da mesma janela e consome a marca', () => {
    const a = corpoDaFuncao(sql, 'eng_refresh_agregados');
    expect(a).toMatch(/to_regclass\('pg_temp\.w_resp'\) IS NULL/);
    expect(a).toMatch(/current_setting\('eng\.w_resp_desde', true\) IS DISTINCT FROM coalesce\(p_desde::text, 'tudo'\)/);
    expect(a).toMatch(/set_config\('eng\.w_resp_desde', '', true\)/);
    // a fonte de respostas é lida só dentro de eng_monta_w_resp
    expect(a).not.toMatch(/FROM public\.fato_resolucao_questoes_b2b/);
  });

  it('eng_monta_w_resp tem a leitura estreita filtrada por p_desde e REVOKE', () => {
    const m = corpoDaFuncao(sql, 'eng_monta_w_resp');
    expect(m).toMatch(/CREATE TEMP TABLE w_resp ON COMMIT DROP[\s\S]*?p_desde IS NULL OR response_date >= p_desde/);
    expect(m).toMatch(/set_config\('eng\.w_resp_desde'/);
    const revoke = sql.match(/REVOKE ALL ON FUNCTION[\s\S]*?;/g)?.join('\n') ?? '';
    expect(revoke).toContain('public.eng_monta_w_resp(date)');
    expect(revoke).toMatch(/FROM\s+PUBLIC,\s*anon,\s*authenticated/);
  });

  it('nenhum DELETE em eng_* sem WHERE, nenhum MERGE e nenhum TRUNCATE', () => {
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.eng_\w+(\s+\w+)?\s*;/i);
    expect(sql).not.toMatch(/\bMERGE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});

// ---------------------------------------------------------------------------
// Fase 4: cron (spec §3.1 I1 e I3, Fase 4)
// ---------------------------------------------------------------------------
describe('Fase 4: jobs do pg_cron', () => {
  const fase4 = migrationsDaFase(4);
  const sql = fase4.map((m) => m.sql).join('\n');

  /** Estado final de cada job depois de aplicar todas as migrations em ordem (o último schedule vence). */
  function jobsVigentes(): Map<string, { agenda: string; comando: string }> {
    const jobs = new Map<string, { agenda: string; comando: string }>();
    for (const arquivo of migrationsOrdenadas()) {
      const texto = semComentarios(readMigration(arquivo)).replace(/--[^\n]*/g, '');
      const eventos: { pos: number; tipo: 'un' | 'sch'; nome: string; agenda?: string; comando?: string }[] = [];
      for (const m of texto.matchAll(/cron\.unschedule\(jobid\) FROM cron\.job WHERE jobname = '([^']+)'/g)) {
        eventos.push({ pos: m.index!, tipo: 'un', nome: m[1] });
      }
      for (const m of texto.matchAll(/cron\.schedule\(\s*'([^']+)',\s*'([^']+)',\s*\$\$([\s\S]*?)\$\$\s*\)/g)) {
        eventos.push({ pos: m.index!, tipo: 'sch', nome: m[1], agenda: m[2], comando: m[3] });
      }
      eventos.sort((a, b) => a.pos - b.pos);
      for (const e of eventos) {
        if (e.tipo === 'un') jobs.delete(e.nome);
        else jobs.set(e.nome, { agenda: e.agenda!, comando: e.comando! });
      }
    }
    return jobs;
  }

  it('existe exatamente uma migration da Fase 4', () => {
    expect(fase4.length).toBe(1);
  });

  it('o incremental roda a cada 5 min a partir do minuto 2, com statement_timeout e lock_timeout exatos', () => {
    const j = jobsVigentes().get('eng-refresh-incremental');
    expect(j, 'job eng-refresh-incremental ausente').toBeDefined();
    expect(j!.agenda).toBe('2-59/5 * * * *');
    expect(j!.comando).toBe("SET statement_timeout TO '90s'; SET lock_timeout TO '5s'; SELECT public.eng_refresh_incremental();");
  });

  it('o rebuild total roda 1x/dia às 06:00 UTC (03:00 BRT) com statement_timeout de 30 min', () => {
    const j = jobsVigentes().get('eng-refresh-diario');
    expect(j, 'job eng-refresh-diario ausente').toBeDefined();
    expect(j!.agenda).toBe('0 6 * * *');
    expect(j!.comando).toBe("SET statement_timeout TO '30min'; SELECT public.eng_refresh('cron');");
  });

  it('o job antigo das 09:00 UTC deixou de existir', () => {
    for (const [nome, j] of jobsVigentes()) {
      if (nome.startsWith('eng-')) expect(j.agenda, nome).not.toBe('0 9 * * *');
    }
  });

  it('o VACUUM diário roda às 06:40 UTC, num único comando, sobre as 4 tabelas', () => {
    const j = jobsVigentes().get('eng-vacuum-diario');
    expect(j, 'job eng-vacuum-diario ausente').toBeDefined();
    expect(j!.agenda).toBe('40 6 * * *');
    expect(j!.comando).toMatch(/^VACUUM \(ANALYZE\)/);
    expect(j!.comando).not.toMatch(/;/); // sem SET antes: VACUUM não roda em bloco de transação
    for (const t of [
      'eng_atividade_aluno_dia',
      'eng_questoes_aluno_dia_no',
      'eng_consumo_aluno_dia_conteudo',
      'eng_questao_classificacao',
    ]) {
      expect(j!.comando).toContain(`public.${t}`);
    }
  });

  it('cada job é removido pelo nome antes de ser agendado (idempotência)', () => {
    for (const nome of ['eng-refresh-incremental', 'eng-refresh-diario', 'eng-vacuum-diario']) {
      const iUn = sql.indexOf(`cron.unschedule(jobid) FROM cron.job WHERE jobname = '${nome}'`);
      const iSch = sql.indexOf(`cron.schedule(\n  '${nome}'`);
      expect(iUn, `${nome}: unschedule ausente`).toBeGreaterThanOrEqual(0);
      expect(iSch, `${nome}: schedule ausente`).toBeGreaterThan(iUn);
    }
  });

  it('o rebuild noturno não colide com o VACUUM e nenhum job usa TRUNCATE ou VACUUM FULL', () => {
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bVACUUM\s+FULL\b/i);
  });
});

// ---------------------------------------------------------------------------
// Fase 5: "atualizado em" honesto e RPC de versão (spec §5.4)
// ---------------------------------------------------------------------------
describe('Fase 5: eng_atualizado_em e get_gestor_engajamento_versao', () => {
  const fase5 = migrationsDaFase(5);
  const sql = fase5.map((m) => m.sql).join('\n');
  const atualizadoEm = () => corpoDaFuncao(sql, 'eng_atualizado_em');
  const rpc = () => corpoDaFuncao(sql, 'get_gestor_engajamento_versao');

  it('existe exatamente uma migration da Fase 5', () => {
    expect(fase5.length).toBe(1);
  });

  it('eng_atualizado_em devolve o MENOR entre o fim do último ok e as duas cargas de fonte da MESMA linha', () => {
    const f = atualizadoEm();
    expect(f).toMatch(/least\(\s*l\.terminado_em,\s*\(l\.contagens->>'fonte_carregado_resp'\)::timestamptz,\s*\(l\.contagens->>'fonte_carregado_cons'\)::timestamptz\)/);
    // a linha é a última ok, de qualquer tipo (sem filtro por tipo)
    expect(f).toMatch(/WHERE l\.status = 'ok'\s+ORDER BY l\.terminado_em DESC\s+LIMIT 1/);
    expect(f).not.toMatch(/\btipo\b/);
  });

  it('eng_atualizado_em não varre fonte nem agrega tabela na hora da RPC', () => {
    const f = atualizadoEm();
    expect(f).not.toMatch(/\bfato_/);
    expect(f).not.toMatch(/count\(\*\)|max\(|min\(/i);
    expect(f).toMatch(/\bSTABLE\b/);
    expect(f).toMatch(/SET search_path = public, pg_temp/);
  });

  it('eng_atualizado_em mantém o REVOKE de PUBLIC, anon e authenticated', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.eng_atualizado_em\(\)\s+FROM PUBLIC, anon, authenticated;/);
  });

  it('a RPC de versão é SECURITY DEFINER, STABLE e SET search_path TO public', () => {
    const r = rpc();
    expect(r).toMatch(/SECURITY DEFINER/);
    expect(r).toMatch(/\bSTABLE\b/);
    expect(r).toMatch(/SET search_path TO 'public'/);
  });

  it('a RPC de versão segue papel → resolução de v_ies → gestor_pode_acessar_ies', () => {
    const r = rpc();
    const iPapel = r.indexOf("has_role(v_uid,'admin'::app_role)");
    const iResolucao = r.indexOf('IES not resolved');
    const iAutorizacao = r.indexOf('gestor_pode_acessar_ies(v_ies)');
    const iRetorno = r.indexOf('RETURN jsonb_build_object(');
    expect(iPapel).toBeGreaterThan(-1);
    expect(r).toMatch(/has_role\(v_uid,'gestor'::app_role\)/);
    expect(r).toMatch(/has_role\(v_uid,'gestor_grupo'::app_role\)/);
    expect(iResolucao).toBeGreaterThan(iPapel);
    expect(iAutorizacao).toBeGreaterThan(iResolucao);
    expect(iRetorno).toBeGreaterThan(iAutorizacao);
    expect(r).toMatch(/Permission denied: cannot access this IES/);
  });

  it('a RPC de versão não tem período, não lê fatos nem aluno e devolve só a versão', () => {
    const r = rpc();
    expect(r).not.toMatch(/eng_validar_periodo/);
    expect(r).not.toMatch(/\bfato_|eng_alunos_recorte|eng_base_ativa|\bdim_aluno_b2b/);
    expect(r).not.toMatch(/'email'|'nome'/);
    expect(r).toMatch(/'data', jsonb_build_object\('atualizadoEm', public\.eng_atualizado_em\(\)\)/);
    expect(r).toMatch(/'meta',\s*public\.eng_meta\(/);
  });

  it('a RPC de versão revoga de PUBLIC e anon e concede a authenticated', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.get_gestor_engajamento_versao(uuid) FROM PUBLIC, anon;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_versao(uuid) TO authenticated;');
  });

  it('nenhum TRUNCATE e nenhum DELETE/UPDATE em tabela nesta migration', () => {
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\b(DELETE FROM|UPDATE)\s+public\./i);
  });
});

describe('Fase 5: o front liga a atualização automática', () => {
  const lerSrc = (...partes: string[]) => readFileSync(join(process.cwd(), 'src', ...partes), 'utf8').replace(/\r\n/g, '\n');
  const api = lerSrc('features', 'gestor', 'api', 'engajamento.ts');
  const layout = lerSrc('features', 'gestor', 'routes', 'engajamento', 'EngajamentoLayout.tsx');
  const tipos = lerSrc('features', 'gestor', 'api', 'types-engajamento.ts');

  it('o hook consulta a cada 2 min e só com a aba visível', () => {
    expect(api).toMatch(/INTERVALO_VERSAO_ENGAJAMENTO_MS\s*=\s*120_000/);
    expect(api).toMatch(/refetchInterval:\s*INTERVALO_VERSAO_ENGAJAMENTO_MS/);
    expect(api).toMatch(/refetchIntervalInBackground:\s*false/);
    expect(api).toContain("'get_gestor_engajamento_versao'");
  });

  it('o hook invalida o Engajamento do usuário, menos a própria chave de versão', () => {
    expect(api).toMatch(/invalidateQueries\(\{\s*queryKey:\s*\['gestor',\s*userId,\s*'engajamento'\],\s*predicate:/);
    expect(api).toMatch(/q\.queryKey\[POSICAO_BLOCO\]\s*!==\s*BLOCO_VERSAO/);
  });

  it('o layout chama useEngajamentoVersao uma vez e nenhuma outra tela o usa', () => {
    expect((layout.match(/useEngajamentoVersao\(/g) ?? []).length).toBe(1);
    const telas = ['VisaoGeral', 'Questoes', 'Conteudos'];
    for (const t of telas) {
      const arquivo = (() => {
        try {
          return lerSrc('features', 'gestor', 'routes', 'engajamento', `${t}.tsx`);
        } catch {
          return '';
        }
      })();
      expect(arquivo, t).not.toMatch(/useEngajamentoVersao/);
    }
  });

  it('o tipo VersaoEngajamento existe com a chave atualizadoEm', () => {
    expect(tipos).toMatch(/export interface VersaoEngajamento\s*\{\s*atualizadoEm: string \| null;\s*\}/);
  });
});
