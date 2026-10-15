import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SQL = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20261015090000_b2c_espelho_completo.sql'),
  'utf8',
);

const corpo = (assinatura: string) => {
  const i = SQL.toLowerCase().indexOf(`create or replace function public.${assinatura}`.toLowerCase());
  expect(i).toBeGreaterThanOrEqual(0);
  const resto = SQL.slice(i + 10);
  const prox = resto.search(/create or replace function/i);
  return prox < 0 ? SQL.slice(i) : SQL.slice(i, i + 10 + prox);
};

const DETALHAMENTO = 'mentor_detalhamento(p_simulados uuid[])';
const QUESTAO = 'mentor_questao(p_questao_id uuid, p_simulados uuid[] default null)';
const NOTAS = 'mentor_aluno_notas(p_email text)';

describe('Onda 3 · espelho B2C completo (migration)', () => {
  it('adiciona as colunas novas', () => {
    expect(SQL).toMatch(/alter table public\.b2c_simulados\s+add column if not exists resultado_liberado_em timestamptz/i);
    for (const c of [
      'enunciado text',
      'explicacao text',
      'imagem_url text',
      'imagem_url_2 text',
      'explicacao_imagem_url text',
      'dificuldade text',
    ]) {
      expect(SQL).toContain(`add column if not exists ${c}`);
    }
    for (const c of ['dentro_janela boolean', 'posicao int', 'participantes int', 'percentil numeric']) {
      expect(SQL).toContain(`add column if not exists ${c}`);
    }
  });

  it('b2c_alternativas: FK em cascata, unique (questao_id, label), RLS sem policy e sem grants', () => {
    expect(SQL).toMatch(/create table if not exists public\.b2c_alternativas/i);
    expect(SQL).toMatch(/questao_id uuid not null references public\.b2c_questoes\(id\) on delete cascade/i);
    expect(SQL).toMatch(/unique \(questao_id, label\)/i);
    expect(SQL).toMatch(/alter table public\.b2c_alternativas enable row level security/i);
    expect(SQL).toMatch(/revoke all on table public\.b2c_alternativas from anon, authenticated/i);
    expect(SQL).not.toMatch(/create policy/i);
  });

  it('b2c_area_mapa: RLS sem policy, revoke e comentário de proposta pendente', () => {
    expect(SQL).toMatch(/create table if not exists public\.b2c_area_mapa/i);
    expect(SQL).toMatch(/area_origem text primary key/i);
    expect(SQL).toMatch(/alter table public\.b2c_area_mapa enable row level security/i);
    expect(SQL).toMatch(/revoke all on table public\.b2c_area_mapa from anon, authenticated/i);
    expect(SQL).toMatch(/comment on table public\.b2c_area_mapa/i);
    expect(SQL).toMatch(/PROPOSTA, pendente de validação do produto/);
  });

  it('semeia exatamente as 16 linhas do mapa de áreas', () => {
    const insert = SQL.slice(SQL.indexOf('insert into public.b2c_area_mapa'), SQL.indexOf('on conflict (area_origem)'));
    const linhas = [...insert.matchAll(/^\s*\('([^']*)', '([^']*)', (null|'[^']*')\),?$/gm)].map((m) => [
      m[1],
      m[2],
      m[3] === 'null' ? null : m[3].slice(1, -1),
    ]);
    expect(linhas).toEqual([
      ['Clínica Médica', 'Clínica Médica', null],
      ['Clínica Médica / Preventiva', 'Clínica Médica', null],
      ['Pediatria', 'Pediatria', null],
      ['Ginecologia e Obstetrícia', 'Ginecologia e Obstetrícia', null],
      ['Obstetrícia', 'Ginecologia e Obstetrícia', 'Obstetrícia'],
      ['Ginecologia', 'Ginecologia e Obstetrícia', 'Ginecologia'],
      ['Cirurgia Geral', 'Cirurgia', 'Cirurgia Geral'],
      ['Cirurgia', 'Cirurgia', null],
      ['Cirurgia ', 'Cirurgia', null],
      ['Preventiva', 'Medicina Preventiva', null],
      ['Preventiva ', 'Medicina Preventiva', null],
      ['Saúde Coletiva / Preventiva', 'Medicina Preventiva', 'Saúde Coletiva'],
      ['Medicina de Família e Comunidade (MFC)', 'Medicina Preventiva', 'Medicina de Família e Comunidade'],
      ['Medicina da Família e Comunidade', 'Medicina Preventiva', 'Medicina de Família e Comunidade'],
      ['Medicina de Família e Comunidade', 'Medicina Preventiva', 'Medicina de Família e Comunidade'],
      ['Saúde Mental', 'Clínica Médica', 'Saúde Mental'],
    ]);
  });

  it('liberação: janela fechada E resultado liberado, em detalhamento e questão', () => {
    const gate = /greatest\(coalesce\(s\.resultado_liberado_em, s\.janela_fim\), s\.janela_fim\)/i;
    expect(corpo(DETALHAMENTO)).toMatch(gate);
    expect(corpo(DETALHAMENTO)).toMatch(/now\(\) >= sm\.libera_em/i);
    expect(corpo(QUESTAO)).toMatch(gate);
    expect(corpo(QUESTAO)).toMatch(/now\(\) < v_q\.libera_em/i);
  });

  it('mentor_detalhamento: bloqueados[] com simulado_id, sequence_number e libera_em; tentativas só de liberados', () => {
    const c = corpo(DETALHAMENTO);
    expect(c).toMatch(/'bloqueados'/);
    expect(c).toMatch(/'simulado_id', b\.id, 'sequence_number', b\.sequence_number, 'libera_em', b\.libera_em/);
    expect(c).toMatch(/JOIN liberados l ON l\.id = t\.simulado_id/);
    // simulado sem janela_fim (libera_em NULL) também fica bloqueado
    expect(c).toMatch(/sm\.libera_em IS NULL OR now\(\) < sm\.libera_em/);
  });

  it('mentor_detalhamento: mantém as chaves anteriores e acrescenta as novas', () => {
    const c = corpo(DETALHAMENTO);
    for (const k of [
      'areas',
      'questoes',
      'questao_id',
      'numero',
      'sequence_number',
      'grande_area',
      'tema',
      'correta_label',
      'acerto_pct',
      'respostas',
      'distribuicao',
      'emails',
      'temas',
    ]) {
      expect(c).toContain(`'${k}'`);
    }
    for (const k of ['especialidades', 'especialidade', 'dificuldade', 'enunciado_inicio', 'tem_imagem']) {
      expect(c).toContain(`'${k}'`);
    }
    expect(c).toMatch(/LEFT JOIN public\.b2c_area_mapa m ON m\.area_origem = q\.grande_area/);
    expect(c).toMatch(/coalesce\(m\.grande_area, nullif\(btrim\(q\.grande_area\), ''\), 'Sem área'\)/);
    // e-mails da alternativa correta continuam de fora
    expect(c).toMatch(/label IS NOT DISTINCT FROM correta_label THEN NULL/);
    // enunciado_inicio: whitespace colapsado e 140 caracteres
    expect(c).toMatch(/regexp_replace\(btrim\(coalesce\(qq\.enunciado, ''\)\), '\\s\+', ' ', 'g'\)/);
    expect(c).toMatch(/, 140\)/);
  });

  it('mentor_questao: guarda de mentor, simulado liberado e mensagem de bloqueio', () => {
    const c = corpo(QUESTAO);
    expect(c).toMatch(/v_mentor uuid := public\.mentor_ativo_id\(\)/i);
    expect(c).toMatch(/security definer/i);
    expect(c).toMatch(/set search_path to 'public', 'pg_temp'/i);
    expect(c).toContain("RAISE EXCEPTION 'resultado deste simulado ainda não foi liberado'");
    expect(c).toMatch(/v\.mentor_id = v_mentor AND v\.fim IS NULL/);
    // mesma regra de 'tent': tentativa mais recente por aluno
    expect(c).toMatch(/DISTINCT ON \(t\.email\)/);
    expect(c).toMatch(/ORDER BY t\.email, t\.finalizada_em DESC, t\.id DESC/);
  });

  it('mentor_questao: contrato de retorno', () => {
    const c = corpo(QUESTAO);
    for (const k of [
      'questao_id',
      'simulado_id',
      'sequence_number',
      'numero',
      'grande_area',
      'especialidade',
      'tema',
      'dificuldade',
      'enunciado',
      'imagens',
      'explicacao',
      'explicacao_imagem_url',
      'respostas',
      'acerto_pct',
      'alternativas',
      'branco',
      'label',
      'texto',
      'correta',
      'n',
      'pct',
      'emails',
    ]) {
      expect(c).toContain(`'${k}'`);
    }
    expect(c).toMatch(/array_remove\(array\[nullif\(btrim\(v_q\.imagem_url\), ''\), nullif\(btrim\(v_q\.imagem_url_2\), ''\)\], NULL\)/);
  });

  it('mentor_questao: e-mails só nas alternativas ERRADAS; alternativas sem resposta aparecem com n=0', () => {
    const c = corpo(QUESTAO);
    expect(c).toMatch(/'emails', CASE WHEN x\.correta THEN NULL ELSE coalesce\(c\.emails, '\[\]'::jsonb\) END/);
    expect(c).toMatch(/FROM alts x LEFT JOIN cont c ON c\.label = x\.label/);
    expect(c).toMatch(/'n', coalesce\(c\.n, 0\)/);
    expect(c).toMatch(/FROM public\.b2c_alternativas a/);
    // em branco: n e e-mails
    expect(c).toMatch(/'branco', jsonb_build_object\(\s*'n'/);
  });

  it('mentor_aluno_notas: notas ganham classificação e áreas ganham especialidades; resto mantido', () => {
    const c = corpo(NOTAS);
    for (const k of ['posicao', 'participantes', 'percentil', 'dentro_janela', 'especialidades', 'especialidade']) {
      expect(c).toContain(`'${k}'`);
    }
    for (const k of ['email', 'notas', 'areas', 'simulado_id', 'sequence_number', 'titulo', 'acerto_pct', 'finalizada_em', 'temas']) {
      expect(c).toContain(`'${k}'`);
    }
    expect(c).toMatch(/public\.mentor_exige_alunos\(v_mentor, array\[p_email\]\)/);
    expect(c).toMatch(/LEFT JOIN public\.b2c_area_mapa m ON m\.area_origem = q\.grande_area/);
  });

  it('hierarquia: especialidade/tema vêm do tema ("Esp > Tema", split no PRIMEIRO >), mapa só como fallback', () => {
    for (const assin of [DETALHAMENTO, QUESTAO, NOTAS]) {
      const c = corpo(assin);
      // tema colapsado e aparado
      expect(c).toMatch(/btrim\(regexp_replace\(coalesce\(q\.tema, ''\), '\\s\+', ' ', 'g'\)\) AS tc/);
      // especialidade: antes do primeiro '>'
      expect(c).toMatch(/position\('>' IN c\.tc\) > 0 THEN left\(c\.tc, position\('>' IN c\.tc\) - 1\)/);
      // tema: depois do primeiro '>'; sem '>' é o texto inteiro; vazio -> 'Sem tema'
      expect(c).toMatch(/substr\(c\.tc, position\('>' IN c\.tc\) \+ 1\) ELSE c\.tc END/);
      expect(c).toContain("'Sem tema'");
      // fallback: especialidade do mapa quando o tema não tem '>'
      expect(c).toMatch(/nullif\(btrim\(regexp_replace\(coalesce\(m\.especialidade, ''\), '\\s\+', ' ', 'g'\)\), ''\)\) AS esp_label/);
      // a grande área continua vindo do mapa
      expect(c).toMatch(/coalesce\(m\.grande_area, nullif\(btrim\(q\.grande_area\), ''\), 'Sem área'\)/);
    }
    // o mapa passa a definir só a grande área (+ fallback)
    expect(SQL).toMatch(/a coluna especialidade deste mapa só é o fallback quando o tema não tem ">"/);
  });

  it('agrupamento insensível a caixa/espaços: chave lower(collapse) e rótulo = grafia mais frequente (empate: menor)', () => {
    for (const assin of [DETALHAMENTO, NOTAS]) {
      const c = corpo(assin);
      expect(c).toMatch(/lower\(regexp_replace\(btrim\(p\.esp_label\), '\\s\+', ' ', 'g'\)\) AS esp_key/);
      expect(c).toMatch(/lower\(regexp_replace\(btrim\(p\.tema_label\), '\\s\+', ' ', 'g'\)\) AS tema_key/);
      expect(c).toMatch(/lower\(regexp_replace\(btrim\(coalesce\(nullif\(c\.tc, ''\), 'Sem tema'\)\), '\\s\+', ' ', 'g'\)\) AS full_key/);
      // um rótulo por chave: mais frequente (n DESC), empate pelo menor (ASC)
      expect(c).toMatch(/SELECT DISTINCT ON \(esp_key\) esp_key, esp_label/);
      expect(c).toMatch(/ORDER BY esp_key, n DESC, esp_label/);
      expect(c).toMatch(/DISTINCT ON \(area, esp_key, tema_key\)[\s\S]*ORDER BY area, esp_key, tema_key, n DESC, tema_label/);
      // lista plana (compat.) também junta duplicatas, com a string completa "Esp > Tema"
      expect(c).toMatch(/DISTINCT ON \(area, full_key\)[\s\S]*ORDER BY area, full_key, n DESC, tema_full/);
      // agregação pelas chaves, não pelo texto cru
      expect(c).toMatch(/FROM resp GROUP BY area, esp_key\) g/);
      expect(c).toMatch(/FROM resp GROUP BY area, esp_key, tema_key\) g/);
      expect(c).toMatch(/FROM resp GROUP BY area, full_key\) g/);
      expect(c).toMatch(/te\.esp_key IS NOT DISTINCT FROM e\.esp_key/);
    }
  });

  it('tema_curto: em questoes[] do detalhamento e em mentor_questao; tema segue completo', () => {
    const d = corpo(DETALHAMENTO);
    expect(d).toMatch(/'tema', q\.tema, 'tema_curto', q\.tema_curto/);
    expect(d).toMatch(/el\.esp_label AS especialidade, tl\.tema_label AS tema_curto, g\.tema_full AS tema/);
    const q = corpo(QUESTAO);
    expect(q).toMatch(/'tema', v_q\.tema_full,\s*'tema_curto', v_q\.tema_curto/);
    expect(q).toMatch(/p\.esp_label AS especialidade/);
  });

  it('grants: revoke de public/anon e grant só para authenticated nas três funções', () => {
    for (const assin of ['mentor_detalhamento(uuid[])', 'mentor_questao(uuid, uuid[])', 'mentor_aluno_notas(text)']) {
      expect(SQL).toContain(`revoke all on function public.${assin} from public;`);
      expect(SQL).toContain(`revoke execute on function public.${assin} from anon;`);
      expect(SQL).toContain(`grant execute on function public.${assin} to authenticated;`);
    }
    expect(SQL).not.toMatch(/grant [^;]*\bto (anon|public)\b/i);
  });
});
