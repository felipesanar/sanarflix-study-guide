import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const path = join(process.cwd(), 'supabase/migrations/20261104120000_mentor_portal_v2.sql');
const SQL = existsSync(path) ? readFileSync(path, 'utf8') : '';
const functions = [...SQL.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\)\s*returns ([\s\S]*?)as \$function\$([\s\S]*?)\$function\$;/gi)];
const body = (name: string) => functions.find((f) => f[1] === name)?.[4] ?? '';
const signatures = [
  'get_mentor_contexto()', 'mentor_canais_listar()', 'mentor_canal_grupo_salvar(text)',
  'mentor_mural_salvar(uuid, text, text, text, text, text, text, text, text, text[], boolean, boolean)',
  'mentor_mural_listar(text, text)', 'mentor_mural_excluir(uuid)',
  'mentor_sessao_salvar(uuid, text, text, text, timestamptz, int, text, text, jsonb, text)',
  'mentor_sessao_excluir(uuid)', 'mentor_sessoes_listar(text)', 'mentor_convites_listar()',
  'registrar_evento_mentor(jsonb)', 'mentor_rotina_listar(date)', 'mentor_rotina_marcar_enviado(uuid)',
  'mentor_sinalizar_ies(text, text)', 'mentor_aluno(text)', 'mentor_perolas_listar()',
  'mentor_perola_salvar(text, text)', 'mentor_intervencoes_listar(date, date)',
];

describe('Portal mentor v2: fronteira de seguranca', () => {
  it('existe e implementa todas as RPCs esperadas', () => {
    expect(SQL.length).toBeGreaterThan(1000);
    for (const signature of signatures) expect(body(signature.split('(')[0])).not.toBe('');
    expect(functions.filter((f) => f[1] === 'mentor_sessao_salvar')).toHaveLength(1);
    expect(SQL).toContain('drop function public.mentor_sessao_salvar(uuid, text, text, text, timestamptz, int, text, text);');
  });
  it('tabelas novas possuem RLS sem policies ou cache de autorizacao', () => {
    for (const table of ['mentoria_canais_gerais', 'mentoria_canais', 'mentoria_rotina_envios', 'mentoria_sinalizacoes', 'mentoria_perolas']) {
      expect(SQL).toContain(`create table public.${table}`);
      expect(SQL).toContain(`alter table public.${table} enable row level security;`);
    }
    expect(SQL).not.toMatch(/create\s+policy/i);
    expect(SQL).not.toContain('mentor_acesso_cache');
  });
  for (const signature of signatures) {
    it(`${signature}: permissoes explicitas`, () => {
      expect(SQL).toContain(`revoke all on function public.${signature} from public;`);
      expect(SQL).toContain(`revoke execute on function public.${signature} from anon;`);
      expect(SQL).toContain(`grant execute on function public.${signature} to authenticated;`);
    });
  }
  it('todas as RPCs de mentor autenticam e fixam search_path', () => {
    for (const fn of functions.filter((f) => !f[1].startsWith('api_'))) {
      expect(fn[3], fn[1]).toMatch(/security definer\s+set search_path to 'public', 'pg_temp'/i);
      expect(fn[4], fn[1]).toContain('public.mentor_ativo_id()');
    }
  });
  it('API legada continua restrita ao servico, sem grant authenticated', () => {
    for (const signature of ['api_mentoria_mural(text, text, timestamptz)', 'api_mentoria_sessoes(text, text)']) {
      expect(SQL).toContain(`revoke execute on function public.${signature} from anon, authenticated;`);
      expect(SQL).not.toContain(`grant execute on function public.${signature} to authenticated;`);
    }
  });
});

describe('Portal mentor v2: contratos operacionais', () => {
  it('toggle desligado, id Flix unico e contexto aditivo sem extensao de acentos', () => {
    expect(SQL).toMatch(/portal_mentor boolean not null default false/i);
    expect(SQL).toMatch(/flix_mentor_id text unique/i);
    for (const key of ['portal_mentor', 'tribo_slug', 'modalidade', 'mentor', 'alunos_ativos', 'ies_nome']) expect(body('get_mentor_contexto')).toContain(`'${key}'`);
    expect(body('get_mentor_contexto')).toContain('translate(lower(m.turma_nome)');
  });
  it('canais validam dominio exato e retornam os tres tipos sem inventar URLs', () => {
    expect(SQL).toContain("url ~ '^https://chat\\.whatsapp\\.com/'");
    expect(body('mentor_canal_grupo_salvar')).toContain("'^https://chat\\.whatsapp\\.com/[^[:space:]]+$'");
    expect(body('mentor_canal_grupo_salvar')).toContain('validacao');
    for (const type of ['avisos', 'plantao', 'grupo_tribo']) expect(body('mentor_canais_listar')).toContain(`'${type}'`);
    expect(body('mentor_canais_listar')).toContain("'editavel'");
  });
  it('mural exclui logicamente e nao permite ressuscitar post; edicao so de publicado', () => {
    expect(body('mentor_mural_excluir')).toMatch(/SET excluida_em = now\(\)/i);
    expect(body('mentor_mural_excluir')).not.toMatch(/delete from/i);
    expect(body('mentor_mural_salvar')).toContain("editada_em = CASE WHEN v_status_antes = 'publicado' THEN now() ELSE editada_em END");
    for (const fn of ['mentor_mural_salvar', 'mentor_mural_listar', 'api_mentoria_mural']) expect(body(fn)).toContain('excluida_em IS NULL');
    expect(body('mentor_mural_listar')).toContain("'fixada', p.fixada");
    expect(body('mentor_mural_listar')).toContain("'editada_em', p.editada_em");
    expect(SQL).toMatch(/create unique index mural_posts_uma_fixada[\s\S]*?where fixada and excluida_em is null/i);
  });
  it('preserva efeitos anteriores do salvar mural e URLs https', () => {
    const fn = body('mentor_mural_salvar');
    for (const text of ['mentor_exige_alunos', 'v_novo_publicado', 'mentoria_intervencao_alunos', 'mentoria_eventos', "'mural_publicado'", "'^https://[^[:space:]]+$'"]) expect(fn).toContain(text);
  });
  it('sessao migra tipos, evita assinatura ambigua e valida pauta somente B2B', () => {
    expect(SQL).toContain("SET tipo = 'encontro_tribo' WHERE tipo = 'coletiva'");
    expect(SQL.includes('p_pauta jsonb default null')).toBe(true);
    expect(SQL).toContain('p_descricao text default null');
    expect(SQL).toContain("jsonb_typeof(p_pauta) IS DISTINCT FROM 'array'");
    expect(SQL).toContain("'tema_critico', 'mais_erradas', 'livre'");
    expect(SQL).toContain("m.tipo = 'b2b'");
    expect(SQL).toContain('jsonb_array_elements(p_pauta)');
    expect(SQL).toMatch(/check \(status in \('agendada', 'realizada'\)\)/i);
    expect(body('api_mentoria_sessoes')).not.toContain("s.tipo = 'coletiva'");
  });
  it('excluir sessao exige posse, futuro e agendada; preserva historico do card', () => {
    const fn = body('mentor_sessao_excluir');
    expect(fn).toContain('s.mentor_id = v_mentor');
    expect(fn).toContain('FOR UPDATE');
    expect(fn).toContain("v_sessao.status <> 'agendada' OR v_sessao.inicio <= now()");
    expect(fn).toContain('mentor_exige_alunos');
    expect(fn).toContain('DELETE FROM public.mentoria_sessoes');
    expect(fn).not.toContain('DELETE FROM public.mentoria_intervencoes');
  });
  it('convites leem somente liberacoes ligadas e vinculos atuais', () => {
    const fn = body('mentor_convites_listar');
    for (const text of ["'alunoEmail'", "'alunoNome'", "'mensagem'", "'desde'", 'l.ligado', 'v.fim IS NULL']) expect(fn).toContain(text);
  });
  it('eventos possuem lock por mentor, referencia e deduplicacao por tipo sem perder transicao', () => {
    const fn = body('registrar_evento_mentor');
    for (const text of ['FOR UPDATE', 'referencia_id', "origem_ref->>'id'", "origem_ref->>'kind'", 'mentor_exige_alunos', 'mentoria_eventos', "'sessao_realizada'", "'agenda_liberada'", "'mural_publicado'", "'status_alterado'", "'whatsapp'", 'IF EXISTS', "e.tipo = v_evento"]) expect(fn).toContain(text);
    expect(fn).toMatch(/UPDATE public\.mentoria_intervencoes[\s\S]*?status = 'feito'/i);
  });
  it('rotina, sinalizacoes e perolas restringem B2B e propriedade', () => {
    for (const fn of ['mentor_rotina_listar', 'mentor_rotina_marcar_enviado', 'mentor_sinalizar_ies', 'mentor_perolas_listar', 'mentor_perola_salvar']) expect(body(fn)).toContain("m.tipo = 'b2b'");
    expect(body('mentor_sinalizar_ies')).toContain('mentor_exige_alunos');
    expect(SQL).toContain('unique (mentor_id, aluno_email, ciclo_id)');
    expect(body('mentor_aluno')).toContain("'sinalizado_em'");
    expect(body('mentor_rotina_marcar_enviado')).toContain('coalesce(enviado_em, now())');
  });
  it('intervencoes mantem pesos e comentarios e adicionam historico e perfil', () => {
    const fn = body('mentor_intervencoes_listar');
    for (const text of ["'historico'", "'perfil'", "'comentarios'", "'planejadas'", "'realizadas'", 'greatest(n_alunos, 1)', 'mentoria_eventos']) expect(fn).toContain(text);
  });
  it('chamadas legadas de oito argumentos nao apagam pauta e descricao na edicao', () => {
    const fn = body('mentor_sessao_salvar');
    expect(fn.includes('pauta = coalesce(p_pauta, pauta)')).toBe(true);
    expect(fn.includes("descricao = CASE WHEN p_descricao IS NULL THEN descricao ELSE nullif(btrim(p_descricao), '') END")).toBe(true);
  });
  it('eventos de sessao validam tipo antes de criar card sem referencia local', () => {
    expect(body('registrar_evento_mentor').includes("coalesce(p_evento->>'tipo_sessao', '') NOT IN ('encontro_tribo', 'pos_simulado', 'oficina', 'individual')")).toBe(true);
  });
});
