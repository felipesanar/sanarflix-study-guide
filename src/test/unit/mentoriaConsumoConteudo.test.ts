import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SQL = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20261014205241_mentoria_consumo_conteudo.sql'),
  'utf8',
);
const idx = SQL.search(/function public\.mentor_aluno_conteudos/i);
const TURMA = SQL.slice(0, idx);
const CONTEUDOS = SQL.slice(idx);

describe('Consumo de conteúdo · mentor_turma', () => {
  it('exige mentor ativo', () => {
    expect(TURMA).toMatch(/function public\.mentor_turma\(\)[\s\S]*?v_mentor uuid := public\.mentor_ativo_id\(\)/i);
  });

  it('emite as chaves novas por aluno', () => {
    for (const k of ["'conteudos_7d'", "'conteudos_30d'", "'tem_dado_consumo'"]) expect(TURMA).toContain(k);
    expect(TURMA).toMatch(/'videos'[\s\S]*'documentos'[\s\S]*'total'/);
  });

  it('janelas 7d e 30d contam no dia civil de São Paulo, incluindo hoje', () => {
    expect(TURMA).toContain("v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date");
    expect(TURMA).toContain('event_date >= v_hoje - 6');
    expect(TURMA).toContain('event_date >= v_hoje - 29');
    expect(TURMA).not.toMatch(/current_date/i);
  });

  it('usa LATERAL com FILTER e EXISTS para tem_dado_consumo; conta conteúdos distintos, não eventos', () => {
    expect(TURMA).toMatch(/LEFT JOIN LATERAL[\s\S]*count\(DISTINCT f\.content_id\) FILTER/i);
    expect(TURMA).not.toMatch(/count\(\*\) FILTER/i);
    expect(TURMA).toMatch(/sanarflix_user_id IS NOT NULL AND EXISTS/i);
  });

  it('sem sanarflix_user_id as contagens são nulas', () => {
    expect(TURMA).toMatch(/CASE WHEN a\.sanarflix_user_id IS NULL THEN NULL/i);
  });

  it('regra de segmento inalterada: sumido 10+, esfriando 8 a 9, sem_dado', () => {
    expect(TURMA).toMatch(/when dias >= 10 then 'sumido'/i);
    expect(TURMA).toMatch(/when dias >= 8 then 'esfriando'/i);
    expect(TURMA).toMatch(/when dias is null then 'sem_dado'/i);
    expect(TURMA).toMatch(/ORDER BY c\.dias DESC NULLS LAST, c\.nome/);
  });

  it('mantém as chaves anteriores e a última atividade (Flix + Academy)', () => {
    for (const k of ['email', 'nome', 'telefone', 'semestre', 'acesso_ate', 'b2b', 'academy_user_id',
      'sanarflix_user_id', 'ultima_atividade', 'dias_sem_atividade', 'segmento']) {
      expect(TURMA).toContain(`'${k}'`);
    }
    expect(TURMA).toMatch(/user_sessions/i);
    expect(TURMA).toContain("(now() AT TIME ZONE 'America/Sao_Paulo')::date");
  });
});

describe('Consumo de conteúdo · mentor_aluno_conteudos', () => {
  it('exige mentor ativo e aluno do mentor', () => {
    expect(CONTEUDOS).toMatch(/v_mentor uuid := public\.mentor_ativo_id\(\)/i);
    expect(CONTEUDOS).toMatch(/public\.mentor_exige_alunos\(v_mentor, array\[p_email\]\)/i);
    expect(CONTEUDOS).toMatch(/RAISE EXCEPTION 'e-mail obrigatório'/i);
  });

  it('é SECURITY DEFINER STABLE com search_path fixo', () => {
    expect(CONTEUDOS).toMatch(/stable security definer\s+set search_path to 'public', 'pg_temp'/i);
  });

  it('emite as chaves do contrato', () => {
    for (const k of ["'email'", "'tem_dado_consumo'", "'por_semana'", "'recentes'", "'top_cursos'",
      "'semana'", "'videos'", "'documentos'", "'quando'", "'tipo'", "'conteudo'", "'curso'", "'modulo'", "'total'"]) {
      expect(CONTEUDOS).toContain(k);
    }
  });

  it('8 semanas começando na segunda (inclui semanas zeradas), mais antigas primeiro', () => {
    expect(CONTEUDOS).toContain("date_trunc('week'");
    expect(CONTEUDOS).toContain('generate_series(0, 7)');
    expect(CONTEUDOS).toMatch(/ORDER BY w\.semana/);
  });

  it('recentes = 20 conteúdos mais novos (1 por conteúdo); top_cursos = 5 em 30 dias por conteúdos distintos', () => {
    expect(CONTEUDOS).toMatch(/DISTINCT ON \(f\.content_id\)[\s\S]*?ORDER BY u\.quando DESC[\s\S]*?LIMIT 20/);
    expect(CONTEUDOS).toMatch(/count\(DISTINCT f\.content_id\) AS total/);
    expect(CONTEUDOS).toMatch(/event_date >= v_hoje - 29[\s\S]*?LIMIT 5/);
    expect(CONTEUDOS).toContain("event_timestamp AT TIME ZONE 'UTC'");
  });

  it('sem sanarflix_user_id devolve listas vazias e tem_dado_consumo false', () => {
    expect(CONTEUDOS).toMatch(/IF v_sfx IS NULL THEN[\s\S]*?'tem_dado_consumo', false[\s\S]*?'por_semana', '\[\]'::jsonb/i);
  });

  it('documenta que event_date é o dia civil de São Paulo (verificado)', () => {
    expect(SQL).toMatch(/verificado em prod/i);
  });
});

describe('Consumo de conteúdo · grants', () => {
  for (const fn of ['mentor_turma()', 'mentor_aluno_conteudos(text)']) {
    it(`${fn}: revoga public/anon e concede a authenticated`, () => {
      expect(SQL).toContain(`revoke all on function public.${fn} from public;`);
      expect(SQL).toContain(`revoke execute on function public.${fn} from anon;`);
      expect(SQL).toContain(`grant execute on function public.${fn} to authenticated;`);
    });
  }
});
