import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const path = join(process.cwd(), 'supabase/migrations/20261104185935_mentor_b2b_v2.sql');
const sql = existsSync(path) ? readFileSync(path, 'utf8') : '';
const contracts = [
  ['mentor_visao_geral_b2b', 'date, date', 'get_gestor_visao_geral'],
  ['mentor_alunos_b2b', 'date, date', 'get_gestor_alunos'],
  ['mentor_temas_turma_b2b', 'date, date', 'get_gestor_diagnostico_temas'],
  ['mentor_detalhamento_b2b', 'uuid[]', 'get_gestor_detalhamento'],
  ['mentor_questoes_b2b', 'uuid[]', 'get_gestor_questoes'],
  ['mentor_questao_respondentes_b2b', 'uuid, uuid[]', 'get_gestor_questao_respondentes'],
  ['mentor_cronograma_b2b', '', 'get_gestor_cronograma'],
  ['mentor_aluno_b2b', 'text', 'get_gestor_aluno'],
] as const;

describe('Mentor B2B V2 migration textual contract', () => {
  it('is atomic and never recreates or executes a Gestor function', () => {
    expect(sql).toMatch(/^--[^]*?\bbegin;/i);
    expect(sql.trim()).toMatch(/commit;$/i);
    expect(sql).not.toMatch(/create\s+(?:or replace\s+)?function\s+public\.get_gestor_/i);
    expect(sql).not.toMatch(/(?:perform|select)\s+public\.get_gestor_/i);
    expect(sql).not.toContain('user_has_feature');
    expect(sql).toContain("r.destino !~ '^mentor_[a-z_]+_b2b$'");
  });

  for (const [name, args, origin] of contracts) {
    it(`${name} has a documented origin and authenticated-only grants`, () => {
      expect(sql).toContain(`-- ${name}: deriva de ${origin}`);
      expect(sql).toContain(`revoke all on function public.${name}(${args}) from public;`);
      expect(sql).toContain(`revoke execute on function public.${name}(${args}) from anon;`);
      expect(sql).toContain(`grant execute on function public.${name}(${args}) to authenticated;`);
    });
  }

  it('copies current bodies once at migration time, fails closed on drift and only writes the whitelist', () => {
    expect(sql).toContain('pg_get_functiondef(v_oid)');
    expect(sql).toContain('pg_get_functiondef(v_novo_oid)');
    expect(sql).toContain('to_regprocedure(r.origem)');
    expect(sql).toContain('v_contagem <> r.populacoes');
    expect(sql).toContain('mentor_b2b_populacao_inesperada');
    expect(sql).toContain('mentor_b2b_substituicao_inesperada');
    expect(sql).toContain("format('create or replace function public.%I(%s)");
    expect(sql).toContain('execute v_ddl');
    expect(sql).toContain("stable security definer set search_path to 'public', 'pg_temp'");
    expect(sql).toContain("format('-- Deriva de %s; copia independente do Gestor.%s'");
  });

  it('injects active mentor authorization and the same resolved population into every copied body', () => {
    expect(sql).toContain('v_mentor uuid := public.mentor_ativo_id()');
    expect(sql).toContain("m.tipo = 'b2b'");
    expect(sql).toContain("RAISE EXCEPTION 'mentor_b2b_obrigatorio'");
    expect(sql).toContain('public.mentoria_vinculos v');
    expect(sql).toContain('v.mentor_id = v_mentor AND v.fim IS NULL');
    expect(sql).toContain('coalesce(v.academy_user_id, d.academy_user_id, ue.id)');
    expect(sql).toContain('d0.email_normalizado = v.email_normalizado');
    expect(sql).toContain('lower(btrim(u0.email)) = v.email_normalizado');
    expect(sql).toContain('SELECT DISTINCT u.id, u.nome, u.semestre');
    expect(sql).toContain('v_declaracoes || v_comum');
    expect(sql).toContain('v_populacao');
  });

  it('filters civil dates inclusively and preserves null as no period filter', () => {
    expect(sql).toContain('p_inicio date default null, p_fim date default null');
    expect(sql).toContain("AT TIME ZONE 'America/Sao_Paulo'");
    expect(sql).toContain('p_inicio IS NULL OR');
    expect(sql).toContain('>= p_inicio');
    expect(sql).toContain('p_fim IS NULL OR');
    expect(sql).toContain('<= p_fim');
    expect(sql).toContain('p_inicio > p_fim');
  });

  it('always derives the concept from unrounded turma proficiency and exposes D1 and P5', () => {
    for (const [limit, concept] of [[90, 5], [75, 4], [60, 3], [40, 2]]) {
      expect(sql).toContain(`100.0 * p.n_prof / p.n_tri >= ${limit} THEN ${concept}`);
    }
    expect(sql).toContain('p.n_tri = 0 THEN NULL');
    expect(sql).toContain('v_geral := false');
    expect(sql).toContain('false AS concept_oficial');
    for (const key of ['triProjetado', 'n_tri', 'n_prof', 'proficientesPct', 'faltam_para_proximo_conceito']) {
      expect(sql).toContain(`'${key}'`);
    }
    expect(sql).toContain('ceil(p.proximo_pct * p.n_tri / 100.0) - p.n_prof');
  });

  it('returns every student without the original 100-row cap and permits overlapping profiles', () => {
    expect(sql).toContain('v_size := 2147483647');
    expect(sql).toContain("'perfil', (SELECT array_remove(ARRAY[");
    expect(sql).toContain("atual BETWEEN 52 AND 59 THEN 'virada'");
    expect(sql).toContain("atual < 45 OR anterior - atual >= 5 THEN 'baixo'");
    expect(sql).toContain("atual >= 70 AND anterior >= 70 THEN 'bom'");
    expect(sql).toContain('public.mentoria_sinalizacoes');
    expect(sql).toContain('s.ciclo_id = v.id');
    expect(sql).toContain("'sinalizado_em'");
    expect(sql).toContain("'ultima_atividade'");
    expect(sql).toContain('public.mentor_turma()');
  });

  it('profiles use unrounded TRI on the two latest exams, never skip a missing latest score', () => {
    expect(sql).toContain('ORDER BY ord DESC LIMIT 1 OFFSET 1');
    expect(sql).toContain('t.student_id = o.id AND t.pai_id');
    expect(sql).not.toContain("WHERE e->>'valor' IS NOT NULL");
    expect(sql).toContain("'alunosMatriculadosNoRecorte', jsonb_array_length(v_membros)");
    expect(sql).toContain("'partial', coalesce((v_result->'meta'->>'partial')::boolean, false)");
  });

  it('themes preserve last attempts, exclude annulled questions and never invent prevalence', () => {
    expect(sql).toContain('SELECT DISTINCT ON (sf.user_id, g.pai_id)');
    expect(sql).toContain('ultima_fb AS');
    expect(sql).toContain('COALESCE(q.anulada,false) = false');
    expect(sql).toContain('t.respostas >= 30 AND t.acerto_pct < 50');
    expect(sql).toContain('LEFT JOIN public.enamed_prevalencia_tema');
    expect(sql).toContain("WHEN 'Alta' THEN 3 WHEN 'Média' THEN 2 WHEN 'Baixa' THEN 1");
    expect(sql).toContain('peso * (100 - acerto_pct)');
    expect(sql).not.toMatch(/insert\s+into\s+public\.enamed_prevalencia_tema/i);
    expect(sql).toContain('revoke all on table public.enamed_prevalencia_tema from anon, authenticated;');
  });

  it('respondents validate exams, restrict last attempts to the turma and return marked letters', () => {
    const body = sql.slice(sql.indexOf('create or replace function public.mentor_questao_respondentes_b2b'));
    expect(body).toContain('v_mentor uuid := public.mentor_ativo_id()');
    expect(body).toContain('public.mentoria_vinculos v');
    expect(body).toContain("m.tipo = 'b2b'");
    expect(body).toContain("'simulado_fora_do_escopo'");
    expect(body).toContain("'questao_fora_do_escopo'");
    expect(body).toContain('ap.simulado = t.simulado_id');
    expect(body).toContain('ap.question_id = p_questao_id');
    expect(body).toContain("'alternativa', upper(ap.resposta_usuario)");
  });

  it('drawer validates the exact active email and restricts TRI ranking to turma too', () => {
    expect(sql).toContain('public.mentor_exige_alunos(v_mentor, ARRAY[lower(btrim(p_email))])');
    expect(sql).toContain('u.id = ANY(v_alunos)');
    expect(sql).toContain('r.student_id = ANY(v_alunos)');
    expect(sql).toContain('academy_nao_resolvido');
  });

  it('questions keep open-exam protections and select all requested exams without paging loss', () => {
    expect(sql).toContain('FOR p_simulado_id IN SELECT DISTINCT unnest(p_simulados) LOOP');
    expect(sql).toContain("jsonb_build_object('simuladoId', p_simulado_id)");
    expect(sql).toContain('v_itens := v_itens ||');
    expect(sql).toContain('INTO v_aberta FROM public.simulados_admin');
    expect(sql).toContain('mentor_b2b_guard_gabarito_ausente');
  });

  const sources = [
    ['get_gestor_visao_geral', '20260809230000_gestor_visao_geral_conceito_unificado_e_populacao.sql', 3],
    ['get_gestor_alunos', '20260808205250_d158652d-085b-4d74-be37-380e37f897d4.sql', 1],
    ['get_gestor_detalhamento', '20260807061927_fbe99e6b-e3ff-48a1-9610-5f0d0d17e517.sql', 1],
    ['get_gestor_questoes', '20260811165212_bf4b69fa-60e7-4e00-987d-03131727a33d.sql', 1],
    ['get_gestor_cronograma', '20260807055809_4b67bf7a-1f94-468d-afcd-0b74eef0fd6d.sql', 1],
    ['get_gestor_aluno', '20260807061927_fbe99e6b-e3ff-48a1-9610-5f0d0d17e517.sql', 1],
  ] as const;
  for (const [name, file, count] of sources) {
    it(`${name} population and return anchors match the checked-in source offline`, () => {
      const source = readFileSync(join(process.cwd(), 'supabase/migrations', file), 'utf8');
      const body = source.match(new RegExp(`create (?:or replace )?function public\\.${name}\\([^]*?as \\$function\\$([^]*?)\\$function\\$`, 'i'))?.[1] ?? '';
      // Mesma normalização da migration: tira comentário de linha, preserva '--' dentro de literal.
      const normalized = body.replace(/('(?:[^']|'')*')|--[^\n]*/g, (_m, lit?: string) => lit ?? '').replace(/\s+/g, ' ');
      expect((normalized.match(/'/g) ?? []).length % 2).toBe(0);
      const core = normalized.match(/\bWITH (?:sims|alunos|grupo) AS \([^]*/i)?.[0] ?? '';
      const pattern = sql.match(/v_padrao_populacao text := \$rx\$([^]*?)\$rx\$/)?.[1] ?? '(?!)';
      expect(core).not.toBe('');
      expect([...core.matchAll(new RegExp(pattern, 'g'))]).toHaveLength(count);
      expect(core).toMatch(/\s+RETURN v_result;\s+END;?\s*$/i);
      const remaining = core.replace(new RegExp(pattern, 'g'), 'FROM public.users u WHERE u.id = ANY(v_alunos)');
      expect(remaining).not.toContain('u.id_ies = v_ies');
      if (name === 'get_gestor_visao_geral') {
        // The later gate patch is part of the current body, not a different calculation.
        const current = remaining
          .replace('WHEN EXISTS (SELECT 1 FROM ies_tri it WHERE it.pai_id = p.id)',
            'WHEN v_geral AND EXISTS (SELECT 1 FROM ies_tri it WHERE it.pai_id = p.id)')
          .replace('EXISTS (SELECT 1 FROM ies_tri it WHERE it.pai_id = p.id) AS concept_oficial',
            '(v_geral AND EXISTS (SELECT 1 FROM ies_tri it WHERE it.pai_id = p.id)) AS concept_oficial');
        const section = sql.slice(sql.indexOf("IF r.destino = 'mentor_visao_geral_b2b'"), sql.indexOf("ELSIF r.destino = 'mentor_alunos_b2b'"));
        const patches = [...section.matchAll(/\$rx\$([^]*?)\$rx\$/g)];
        expect(patches).toHaveLength(3);
        for (const patch of patches) expect([...current.matchAll(new RegExp(patch[1], 'g'))]).toHaveLength(1);
      }
    });
  }
});

describe('normalização dos corpos copiados do Gestor', () => {
  it('remove comentários de linha sem cortar literais que contêm --', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261104185935_mentor_b2b_v2.sql'), 'utf8');
    expect(sql).toContain(String.raw`regexp_replace(v_src, $re$('(?:[^']|'')*')|--[^\n]*$re$, '\1', 'g')`);
    const normalizar = (s: string) => s.replace(/('(?:[^']|'')*')|--[^\n]*/g, (_m, lit?: string) => lit ?? '');
    const origem = "v := 'pelo menos um registro -- inclui prova aberta'; -- comentário\nx := 1; -- outro";
    expect(normalizar(origem)).toBe("v := 'pelo menos um registro -- inclui prova aberta'; \nx := 1; ");
  });
});
