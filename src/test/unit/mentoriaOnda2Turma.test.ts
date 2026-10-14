import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'supabase', 'migrations');
const ler = (nome: string) => readFileSync(join(dir, nome), 'utf8');
const TURMA = ler('20261014200100_mentoria_onda2_rpcs_turma.sql');

describe('Onda 2 · turma', () => {
  it('as duas RPCs exigem mentor ativo', () => {
    expect(TURMA).toMatch(/function public\.mentor_turma\(\)[\s\S]*?v_mentor uuid := public\.mentor_ativo_id\(\)/i);
    expect(TURMA).toMatch(/function public\.mentor_aluno\(p_email text\)[\s\S]*?public\.mentor_exige_alunos\(v_mentor, array\[p_email\]\)/i);
  });

  it('corte único de sumido em 10 dias; esfriando 8 a 9', () => {
    expect(TURMA).toMatch(/when dias >= 10 then 'sumido'/i);
    expect(TURMA).toMatch(/when dias >= 8 then 'esfriando'/i);
    expect(TURMA).toMatch(/when dias is null then 'sem_dado'/i);
  });

  it('última atividade junta consumo do Flix e sessão no Academy', () => {
    expect(TURMA).toMatch(/fato_consumo_conteudo_b2b/i);
    expect(TURMA).toMatch(/user_sessions/i);
  });

  it('dias sem atividade contam no fuso de São Paulo, não em current_date (UTC)', () => {
    expect(TURMA).not.toMatch(/current_date/i);
    expect(TURMA).toContain("(now() AT TIME ZONE 'America/Sao_Paulo')::date");
  });
});
