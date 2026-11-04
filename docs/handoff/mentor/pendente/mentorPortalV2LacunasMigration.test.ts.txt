import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = '20261104200000_mentor_portal_v2_lacunas.sql';
const path = join(process.cwd(), 'supabase/migrations', migration);
const SQL = existsSync(path) ? readFileSync(path, 'utf8') : '';
const functions = (sql: string) => [...sql.matchAll(/create(?: or replace)? function public\.(\w+)\(([\s\S]*?)\)\s*returns ([\s\S]*?)as \$function\$([\s\S]*?)\$function\$;/gi)];
const definitions = functions(SQL);
const body = (name: string) => definitions.find((f) => f[1] === name)?.[4] ?? '';
const baseline = (file: string, name: string) => functions(readFileSync(join(process.cwd(), 'supabase/migrations', file), 'utf8')).find((f) => f[1] === name)?.[4] ?? '';
const signatures = [
  'get_mentor_contexto()',
  'mentor_intervencao_criar(text, text, text, text, text[], text, text, jsonb)',
  'mentor_convites_listar()',
  'mentor_turma()',
  'mentor_sessoes_listar(text)',
];

describe('Portal mentor v2: lacunas aditivas', () => {
  it('cria somente as cinco RPCs esperadas, em transacao e sem policies', () => {
    expect(SQL.trim()).toMatch(/^--[\s\S]*?\bbegin;/i);
    expect(SQL.trim()).toMatch(/commit;$/i);
    expect(definitions.map((f) => f[1]).sort()).toEqual(signatures.map((s) => s.split('(')[0]).sort());
    expect(SQL).not.toMatch(/create\s+policy|\bcascade\b/i);
  });

  for (const signature of signatures) {
    it(`${signature}: autenticacao e permissoes explicitas`, () => {
      const fn = definitions.find((f) => f[1] === signature.split('(')[0]);
      expect(fn?.[3]).toMatch(/^jsonb\s+language plpgsql\s+(?:stable\s+)?security definer\s+set search_path to 'public', 'pg_temp'\s*$/i);
      expect(fn?.[4]).toContain('public.mentor_ativo_id()');
      expect(SQL).toContain(`revoke all on function public.${signature} from public;`);
      expect(SQL).toContain(`revoke execute on function public.${signature} from anon;`);
      expect(SQL).toContain(`grant execute on function public.${signature} to authenticated;`);
    });
  }

  it('contexto acrescenta foto e link dentro do mentor sem perder o corpo vigente', () => {
    const fn = body('get_mentor_contexto');
    expect(fn).toContain("'link_agendamento', m.link_agendamento, 'foto_url', m.foto_url,");
    expect(fn.replace("    'link_agendamento', m.link_agendamento, 'foto_url', m.foto_url,\n", '')).toBe(baseline('20261104181315_mentor_portal_v2.sql', 'get_mentor_contexto'));
  });

  it('substitui assinatura antiga sem overload ambiguo e mantem parametros opcionais', () => {
    expect(SQL).toContain('drop function public.mentor_intervencao_criar(text, text, text, text, text[]);');
    expect(definitions.find((f) => f[1] === 'mentor_intervencao_criar')?.[2]).toMatch(/p_alunos text\[\],\s*p_perfil text default null,\s*p_origem text default 'manual',\s*p_origem_ref jsonb default null\s*$/i);
    expect(SQL).not.toContain('grant execute on function public.mentor_intervencao_criar(text, text, text, text, text[])');
  });

  it('valida perfil nullable e origem nao nula antes da escrita', () => {
    const fn = body('mentor_intervencao_criar');
    expect(fn).toContain("p_perfil IS NOT NULL AND p_perfil NOT IN ('virada', 'baixo', 'bom')");
    expect(fn).toContain("p_origem IS NULL OR p_origem NOT IN ('manual', 'agenda_liberada', 'tema_critico', 'questao', 'mural', 'sessao_criada')");
    expect(fn).toMatch(/INSERT INTO public\.mentoria_intervencoes \(mentor_id, tipo, titulo, nota, status, alvo, origem, perfil, origem_ref\)\s+VALUES \(v_mentor, p_tipo, btrim\(p_titulo\), nullif\(btrim\(p_nota\), ''\), 'a_fazer', p_alvo, p_origem, p_perfil, p_origem_ref\)/);
    expect(fn.indexOf('p_perfil IS NOT NULL')).toBeLessThan(fn.indexOf('INSERT INTO'));
    for (const text of ['public.mentor_exige_alunos(v_mentor, p_alunos)', "IF p_alvo = 'turma'", 'v.fim IS NULL', "cardinality(v_emails) <> 1", "cardinality(v_emails) = 0", 'INSERT INTO public.mentoria_intervencao_alunos', 'INSERT INTO public.mentoria_eventos', "'intervencao_criada'", "RETURN jsonb_build_object('intervencao_id', v_interv_id)"]) expect(fn).toContain(text);
  });

  it('amplia CHECK de origem preservando auto usado pelas RPCs vigentes', () => {
    expect(SQL).toMatch(/alter table public\.mentoria_intervencoes\s+drop constraint mentoria_intervencoes_origem_check,\s+add constraint mentoria_intervencoes_origem_check\s+check \(origem in \('auto', 'manual', 'agenda_liberada', 'tema_critico', 'questao', 'mural', 'sessao_criada'\)\)/i);
  });

  it('preserva integralmente o corpo anterior da intervencao alem das novas validacoes e colunas', () => {
    const original = body('mentor_intervencao_criar')
      .replace(/  IF p_perfil IS NOT NULL[\s\S]*?END IF;\n/, '')
      .replace(/  IF p_origem IS NULL[\s\S]*?END IF;\n/, '')
      .replace('alvo, origem, perfil, origem_ref)', 'alvo, origem)')
      .replace('p_alvo, p_origem, p_perfil, p_origem_ref)', "p_alvo, 'manual')");
    expect(original).toBe(baseline('20261014171927_mentoria_onda2_rpcs_acao.sql', 'mentor_intervencao_criar'));
  });

  it('convites correlacionam evento e post ao mentor, aluno e liberacao, sem multiplicar linhas', () => {
    const fn = body('mentor_convites_listar');
    for (const text of ["'publicacao_id', post.id", 'LEFT JOIN LATERAL', 'FROM public.mentoria_eventos e', 'JOIN public.mural_posts p', "p.id::text = e.payload->>'post_id'", 'p.mentor_id = l.mentor_id', 'e.mentor_id = l.mentor_id', 'e.aluno_email = l.aluno_email', "e.tipo = 'agenda_liberada'", "e.payload->>'liberacao_id' = l.id::text", 'ORDER BY e.criado_em DESC, e.id DESC', 'LIMIT 1', 'v.fim IS NULL', 'l.mentor_id = v_mentor AND l.ligado']) expect(fn).toContain(text);
    for (const key of ['id', 'alunoEmail', 'alunoNome', 'mensagem', 'desde']) expect(fn).toContain(`'${key}'`);
    expect(fn).toContain("'[]'::jsonb");
  });

  it('turma acrescenta inicio, produto por B2B e campus nulo sem regredir metricas e meta', () => {
    const fn = body('mentor_turma');
    expect(fn).toContain('v.inicio AS entrou_em,');
    expect(fn).toContain("'entrou_em', c.entrou_em, 'produto', CASE WHEN c.b2b THEN 'padrao' ELSE 'pro' END, 'campus', null,");
    const original = fn.replace('             v.inicio AS entrou_em,\n', '').replace("      'entrou_em', c.entrou_em, 'produto', CASE WHEN c.b2b THEN 'padrao' ELSE 'pro' END, 'campus', null,\n", '');
    expect(original).toBe(baseline('20261104181551_mentor_b2c_v2.sql', 'mentor_turma'));
  });

  it('sessoes adiciona filtro explicito sem acervo e preserva os filtros e payload vigentes', () => {
    const fn = body('mentor_sessoes_listar');
    expect(fn).toContain("p_quando NOT IN ('proximas', 'realizadas', 'todas', 'todas_sem_acervo')");
    expect(fn).toContain("WHEN 'todas_sem_acervo' THEN s.mentor_id = v_mentor AND s.origem <> 'arquivo_2025'");
    const original = fn.replace("'todas', 'todas_sem_acervo'", "'todas'")
      .replace('proximas, realizadas, todas ou todas_sem_acervo', 'proximas, realizadas ou todas')
      .replace("      WHEN 'todas_sem_acervo' THEN s.mentor_id = v_mentor AND s.origem <> 'arquivo_2025'\n", '');
    expect(original).toBe(baseline('20261104181315_mentor_portal_v2.sql', 'mentor_sessoes_listar'));
  });
});
