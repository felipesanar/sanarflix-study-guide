import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SQL = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20261026150000_mentoria_questoes_b2b.sql'),
  'utf8',
);
const idx = SQL.search(/create or replace function public\.mentor_aluno_questoes/i);
const TURMA = SQL.slice(0, idx);
const QUESTOES = SQL.slice(idx);

describe('Questoes B2B · mentor_turma', () => {
  it('preserva autorizacao, consumo, segmentos, chaves e ordenacao anteriores', () => {
    expect(idx).toBeGreaterThan(0);
    expect(TURMA).toMatch(/v_mentor uuid := public\.mentor_ativo_id\(\)/i);
    expect(TURMA).toContain('v.mentor_id = v_mentor AND v.fim IS NULL');
    for (const k of ['email', 'nome', 'telefone', 'semestre', 'acesso_ate', 'b2b',
      'academy_user_id', 'sanarflix_user_id', 'ultima_atividade', 'dias_sem_atividade',
      'segmento', 'conteudos_7d', 'conteudos_30d', 'tem_dado_consumo']) {
      expect(TURMA).toContain(`'${k}'`);
    }
    expect(TURMA).toContain('count(DISTINCT f.content_id)');
    expect(TURMA).toContain('f.event_date >= v_hoje - 6');
    expect(TURMA).toContain('f.event_date >= v_hoje - 29');
    expect(TURMA).toMatch(/WHEN dias IS NULL THEN 'sem_dado'/i);
    expect(TURMA).toMatch(/WHEN dias >= 10 THEN 'sumido'/i);
    expect(TURMA).toMatch(/WHEN dias >= 8 THEN 'esfriando'/i);
    expect(TURMA).toContain('ORDER BY c.dias DESC NULLS LAST, c.nome');
  });

  it('conta respostas e correcoes nas janelas de 7 e 30 dias, com nulos sem identidade', () => {
    expect(TURMA).toMatch(/LEFT JOIN LATERAL\s*\(\s*SELECT\s*CASE WHEN a\.sanarflix_user_id IS NULL THEN NULL\s*ELSE count\(\*\) FILTER/i);
    for (const [alias, condition] of [
      ['q7', 'f.response_date >= v_hoje - 6'],
      ['a7', 'f.response_date >= v_hoje - 6 AND f.acertou IS TRUE'],
      ['e7', 'f.response_date >= v_hoje - 6 AND f.acertou IS FALSE'],
      ['q30', ''], ['a30', 'f.acertou IS TRUE'], ['e30', 'f.acertou IS FALSE'],
    ]) {
      const aggregate = condition ? `count(*) FILTER (WHERE ${condition})` : 'count(*)';
      expect(TURMA).toContain(`CASE WHEN a.sanarflix_user_id IS NULL THEN NULL\n               ELSE ${aggregate} END AS ${alias}`);
    }
    expect(TURMA).toMatch(/FROM public\.fato_resolucao_questoes_b2b f\s+WHERE a\.sanarflix_user_id IS NOT NULL\s+AND f\.sanarflix_user_id = a\.sanarflix_user_id\s+AND f\.response_date >= v_hoje - 29/i);
    for (const k of ['questoes_7d', 'questoes_30d', 'tem_dado_questoes', 'respondidas', 'acertos', 'erros', 'pct_acerto']) {
      expect(TURMA).toContain(`'${k}'`);
    }
    for (const d of [7, 30]) {
      expect(TURMA).toContain(`round(100.0 * c.a${d} / nullif(c.a${d} + c.e${d}, 0), 1)`);
    }
  });

  it('inclui as tres fontes de ultima atividade e verifica existencia sem janela', () => {
    expect(TURMA).toMatch(/greatest\(\s*\(SELECT max\(f\.event_timestamp\)[\s\S]*?\(SELECT max\(s\.started_at\)[\s\S]*?\(SELECT max\(fq\.response_timestamp\) AT TIME ZONE 'UTC'[\s\S]*?fq\.response_date = \(SELECT max\(fd\.response_date\)[\s\S]*?\) AS ultima_atividade/i);
    expect(TURMA).toMatch(/a\.sanarflix_user_id IS NOT NULL AND EXISTS\s*\(\s*SELECT 1 FROM public\.fato_resolucao_questoes_b2b fx\s+WHERE fx\.sanarflix_user_id = a\.sanarflix_user_id\)\) AS tem_dado_questoes/i);
  });
});

describe('Questoes B2B · mentor_aluno_questoes', () => {
  it('usa RPC protegida com validacao e mesma resolucao de identidade', () => {
    expect(QUESTOES).toMatch(/mentor_aluno_questoes\(p_email text\)\s+returns jsonb/i);
    expect(QUESTOES).toMatch(/stable security definer\s+set search_path to 'public', 'pg_temp'/i);
    expect(QUESTOES).toContain('v_mentor uuid := public.mentor_ativo_id()');
    expect(QUESTOES).toContain("IF p_email IS NULL OR btrim(p_email) = '' THEN");
    expect(QUESTOES).toContain("RAISE EXCEPTION 'e-mail obrigatório'");
    expect(QUESTOES).toContain('v_email := (public.mentor_exige_alunos(v_mentor, array[p_email]))[1]');
    expect(QUESTOES).toContain('SELECT coalesce(v.sanarflix_user_id, d.sanarflix_user_id) INTO v_sfx');
    expect(QUESTOES).toContain("ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST");
    expect(QUESTOES).toContain('v.mentor_id = v_mentor AND v.email_normalizado = v_email AND v.fim IS NULL');
  });

  it('sem identidade retorna fonte falsa, ultima resposta nula e listas vazias', () => {
    expect(QUESTOES).toMatch(/IF v_sfx IS NULL THEN\s+RETURN jsonb_build_object\('email', v_email, 'tem_dado_questoes', false,\s*'ultima_resposta', NULL,\s*'por_semana', '\[\]'::jsonb, 'por_area', '\[\]'::jsonb\)/i);
    expect(QUESTOES).toMatch(/v_tem := EXISTS\s*\(\s*SELECT 1 FROM public\.fato_resolucao_questoes_b2b fx WHERE fx\.sanarflix_user_id = v_sfx\)/i);
    // última data pelo índice (aluno, data) antes do maior horário: não varre todas as respostas
    expect(QUESTOES).toMatch(/'ultima_resposta', \(SELECT max\(f\.response_timestamp\) AT TIME ZONE 'UTC'[\s\S]*?WHERE f\.sanarflix_user_id = v_sfx\s+AND f\.response_date = \(SELECT max\(fd\.response_date\)/i);
  });

  it('retorna oito semanas de segunda a segunda, com zeros e ordem cronologica', () => {
    expect(QUESTOES).toContain("v_segunda date := date_trunc('week', ((now() AT TIME ZONE 'America/Sao_Paulo')::date)::timestamp)::date");
    expect(QUESTOES).toContain('v_segunda - 49 + 7 * g AS semana FROM generate_series(0, 7) AS g');
    expect(QUESTOES).toContain("date_trunc('week', f.response_date::timestamp)::date AS semana");
    expect(QUESTOES).toContain('f.response_date >= v_segunda - 49');
    expect(QUESTOES).toContain('LEFT JOIN (');
    expect(QUESTOES).toContain('ORDER BY w.semana');
    for (const k of ['respondidas', 'acertos', 'erros']) {
      expect(QUESTOES).toContain(`'${k}', coalesce(s.${k}, 0)`);
    }
  });

  it('agrupa respostas dos ultimos 30 dias por area e limita seis com sem classificacao por ultimo', () => {
    expect(QUESTOES).toContain("coalesce(t.nome, 'Sem classificação') AS area");
    expect(QUESTOES).toMatch(/LEFT JOIN public\.eng_questao_classificacao c ON c\.question_id = f\.question_id/i);
    expect(QUESTOES).toMatch(/LEFT JOIN public\.eng_no_taxonomia t ON t\.no_id = c\.n1_id/i);
    expect(QUESTOES).toContain('f.response_date >= v_hoje - 29');
    expect(QUESTOES).toContain('count(*) AS respondidas');
    expect(QUESTOES).toContain('count(*) FILTER (WHERE f.acertou IS TRUE) AS acertos');
    expect(QUESTOES).toContain('count(*) FILTER (WHERE f.acertou IS FALSE) AS erros');
    expect(QUESTOES).not.toMatch(/count\(DISTINCT/i);
    expect(QUESTOES).toContain('round(100.0 * r.acertos / nullif(r.acertos + r.erros, 0), 1)');
    expect(QUESTOES).toMatch(/ORDER BY \(coalesce\(t\.nome, 'Sem classificação'\) = 'Sem classificação'\), respondidas DESC, area\s+LIMIT 6/i);
    expect(QUESTOES).toContain("ORDER BY (r.area = 'Sem classificação'), r.respondidas DESC, r.area");
  });
});

describe('Questoes B2B · fuso e permissoes', () => {
  it('usa hoje em Sao Paulo, nunca current_date nem policy de acesso direto', () => {
    for (const fn of [TURMA, QUESTOES]) {
      expect(fn).toContain("v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date");
    }
    expect(SQL).not.toMatch(/current_date/i);
    expect(SQL).not.toMatch(/create policy/i);
  });

  for (const fn of ['mentor_turma()', 'mentor_aluno_questoes(text)']) {
    it(`${fn}: revoga public e anon, concede a authenticated`, () => {
      expect(SQL).toContain(`revoke all on function public.${fn} from public;`);
      expect(SQL).toContain(`revoke execute on function public.${fn} from anon;`);
      expect(SQL).toContain(`grant execute on function public.${fn} to authenticated;`);
    });
  }
});
