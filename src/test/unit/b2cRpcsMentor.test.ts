import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20261014220000_b2c_rpcs_mentor.sql'), 'utf8');

const corpo = (assinatura: string) => {
  const i = SQL.toLowerCase().indexOf(`create or replace function public.${assinatura}`.toLowerCase());
  expect(i).toBeGreaterThanOrEqual(0);
  const resto = SQL.slice(i + 10);
  const prox = resto.search(/create or replace function/i);
  return prox < 0 ? SQL.slice(i) : SQL.slice(i, i + 10 + prox);
};

describe('Onda 3 · RPCs de desempenho B2C', () => {
  const funcoes = [
    'mentor_desempenho_turma(p_simulados uuid[] default null)',
    'mentor_detalhamento(p_simulados uuid[])',
    'mentor_aluno_notas(p_email text)',
  ];

  it.each(funcoes)('%s é SECURITY DEFINER com mentor_ativo_id e search_path fixo', (f) => {
    const c = corpo(f);
    expect(c).toMatch(/v_mentor uuid := public\.mentor_ativo_id\(\)/i);
    expect(c).toMatch(/security definer/i);
    expect(c).toMatch(/set search_path to 'public', 'pg_temp'/i);
  });

  it('só enxerga alunos com vínculo ativo do mentor', () => {
    for (const f of funcoes) {
      const c = corpo(f);
      expect(c).toMatch(/mentoria_vinculos/i);
      expect(c).toMatch(/v\.mentor_id = v_mentor/i);
      expect(c).toMatch(/v\.fim IS NULL/i);
    }
  });

  it('mentor_aluno_notas exige que o e-mail seja da turma', () => {
    expect(corpo('mentor_aluno_notas(p_email text)')).toMatch(/public\.mentor_exige_alunos\(v_mentor, array\[p_email\]\)/i);
  });

  it('regras numéricas literais: regrediu 5, estagnado 2, próximo 3 p.p.', () => {
    const c = corpo('mentor_desempenho_turma');
    expect(c).toMatch(/penultimo - [a-z_.]*ultimo >= 5/i);
    expect(c).toMatch(/amplitude3 < 2/i);
    expect(c).toMatch(/vs >= -3/i);
    expect(c).toMatch(/'acima'/);
    expect(c).toMatch(/'proximo'/);
    expect(c).toMatch(/'longe'/);
    expect(c).toMatch(/'sem_meta'/);
    expect(c).toMatch(/'sem_simulado'/);
  });

  it('participação usa o simulado publicado mais recente com janela encerrada', () => {
    const c = corpo('mentor_desempenho_turma');
    expect(c).toMatch(/status = 'published'/i);
    expect(c).toMatch(/janela_fim < now\(\)/i);
  });

  it('não usa current_date (UTC)', () => {
    expect(SQL).not.toMatch(/current_date/i);
  });

  it('grants: revoke public/anon, grant authenticated nas três', () => {
    expect(SQL).toMatch(/revoke all on function public\.mentor_desempenho_turma\(uuid\[\]\) from public;/i);
    expect(SQL).toMatch(/revoke execute on function public\.mentor_desempenho_turma\(uuid\[\]\) from anon;/i);
    expect(SQL).toMatch(/grant execute on function public\.mentor_desempenho_turma\(uuid\[\]\) to authenticated;/i);
    expect(SQL).toMatch(/revoke all on function public\.mentor_detalhamento\(uuid\[\]\) from public;/i);
    expect(SQL).toMatch(/revoke execute on function public\.mentor_detalhamento\(uuid\[\]\) from anon;/i);
    expect(SQL).toMatch(/grant execute on function public\.mentor_detalhamento\(uuid\[\]\) to authenticated;/i);
    expect(SQL).toMatch(/revoke all on function public\.mentor_aluno_notas\(text\) from public;/i);
    expect(SQL).toMatch(/revoke execute on function public\.mentor_aluno_notas\(text\) from anon;/i);
    expect(SQL).toMatch(/grant execute on function public\.mentor_aluno_notas\(text\) to authenticated;/i);
  });

  it('detalhamento devolve distribuição e e-mails por alternativa', () => {
    const c = corpo('mentor_detalhamento');
    expect(c).toMatch(/'distribuicao'/);
    expect(c).toMatch(/'emails'/);
  });
});
