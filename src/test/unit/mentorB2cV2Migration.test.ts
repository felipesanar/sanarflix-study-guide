import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = (name: string) => readFileSync(join(process.cwd(), 'supabase/migrations', name), 'utf8');
const path = join(process.cwd(), 'supabase/migrations/20261104181551_mentor_b2c_v2.sql');
const SQL = existsSync(path) ? readFileSync(path, 'utf8') : '';
const fn = (name: string, sql = SQL) => {
  const match = sql.match(new RegExp(`create (?:or replace )?function public\\.${name}\\([\\s\\S]*?\\$function\\$;`, 'i'));
  return match?.[0] ?? '';
};
const normalize = (sql: string) => sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
const keys = (sql: string, names: string[]) => names.forEach(name => expect(sql).toContain(`'${name}'`));

describe('Mentor B2C V2 migration contract', () => {
  it('exists and uses only Sao Paulo civil days, without seeded prevalence or policies', () => {
    expect(SQL.length).toBeGreaterThan(0);
    expect(SQL).not.toMatch(/current_date|create\s+policy|insert\s+into/i);
    expect(SQL).toContain("AT TIME ZONE 'America/Sao_Paulo'");
    expect(SQL).toMatch(/create table public\.enamed_prevalencia_tema\s*\(/i);
    expect(SQL).toMatch(/tema_norm text (?:not null )?unique/i);
    expect(SQL).toContain("check (prevalencia in ('Alta', 'Média', 'Baixa'))");
    expect(SQL).toMatch(/alter table public\.enamed_prevalencia_tema enable row level security/i);
    for (const column of ['id bigserial', 'grande_area text', 'especialidade text', 'tema text', 'fonte text', 'atualizado_em timestamptz']) {
      expect(SQL).toContain(column);
    }
  });

  const signatures = ['mentor_turma()', 'mentor_desempenho_turma(uuid[])', 'mentor_serie_turma(uuid[])',
    'mentor_engajamento_turma(integer)', 'mentor_temas_turma(uuid[])',
    'mentor_detalhamento(uuid[], text[])', 'mentor_aluno_notas(text)'];
  for (const signature of signatures) {
    it(`${signature} is protected and explicitly regranted`, () => {
      const body = fn(signature.split('(')[0]);
      expect(body).toMatch(/stable security definer\s+set search_path to 'public', 'pg_temp'/i);
      expect(body).toContain('v_mentor uuid := public.mentor_ativo_id()');
      expect(body).toContain('public.mentoria_vinculos v');
      expect(body).toContain('v.mentor_id = v_mentor AND v.fim IS NULL');
      expect(SQL).toContain(`revoke all on function public.${signature} from public;`);
      expect(SQL).toContain(`revoke execute on function public.${signature} from anon;`);
      expect(SQL).toContain(`grant execute on function public.${signature} to authenticated;`);
    });
  }

  it('preserves turma sources and all previous JSON keys, adds D3 and hardest target', () => {
    const turma = fn('mentor_turma');
    expect(turma).toMatch(/WHEN dias IS NULL THEN 'sem_dado'\s+WHEN dias >= 15 THEN 'sumido'\s+WHEN dias >= 8 THEN 'esfriando'\s+ELSE 'ativo'/i);
    const previous = fn('mentor_turma', migration('20261026184129_mentoria_questoes_b2b.sql'));
    const previousKeys = [...previous.matchAll(/'([a-z_0-9]+)'\s*,/g)].map(match => match[1]);
    keys(turma, previousKeys);
    for (const source of ['fato_consumo_conteudo_b2b', 'fato_resolucao_questoes_b2b', 'user_sessions']) {
      expect(turma).toContain(`public.${source}`);
    }
    keys(turma, ['meta', 'especialidade', 'instituicao', 'cortePct']);
    expect(turma).toContain('jsonb_array_elements(b.alvos)');
    expect(turma).toContain("ORDER BY (alvo->>'corte_geral')::numeric DESC NULLS LAST");
    expect(turma).toContain("'cortePct', b.corte_mais_dificil");
    expect(turma).toMatch(/CASE WHEN alvo\.valor IS NULL THEN NULL/i);
    const restored = turma.replace(/,\s+CASE WHEN alvo\.valor IS NULL THEN NULL[\s\S]*?END AS meta/, '')
      .replace(/\s+LEFT JOIN public\.b2c_alunos b[\s\S]*?\) alvo ON true/, '')
      .replace("WHEN dias >= 15 THEN 'sumido'", "WHEN dias >= 10 THEN 'sumido'")
      .replace("'meta', c.meta,", '');
    expect(normalize(restored)).toBe(normalize(previous));
  });

  it('uses participants of the last closed selected exam, not each students latest score', () => {
    const desempenho = fn('mentor_desempenho_turma');
    const metric = desempenho.slice(desempenho.indexOf("'possivel_aprovacao_pct'"), desempenho.indexOf("'acerto_medio_ultimo'"));
    expect(metric).toContain('p.acerto_pct >= b.corte_mais_dificil');
    expect(metric).toContain('nullif(count(*), 0)');
    expect(metric).toContain('count(b.corte_mais_dificil) = 0 THEN NULL');
    expect(metric).toContain('FROM por_simulado p JOIN ultimo_enc u ON u.id = p.simulado_id');
    expect(metric).not.toContain('a.situacao');
    const previous = fn('mentor_desempenho_turma', migration('20261014180751_b2c_desempenho_lista_simulados.sql'));
    const withoutMetric = (sql: string) => sql.replace(/'possivel_aprovacao_pct',[\s\S]*?'acerto_medio_ultimo'/, "'acerto_medio_ultimo'");
    expect(normalize(withoutMetric(desempenho))).toBe(normalize(withoutMetric(previous)));
  });

  it('series weights each participant once and keeps empty exams and null metrics', () => {
    const serie = fn('mentor_serie_turma');
    expect(serie).toContain('p_simulados uuid[] default null');
    expect(serie).toContain('DISTINCT ON (t.email, t.simulado_id)');
    expect(serie).toContain('ORDER BY t.email, t.simulado_id, t.finalizada_em DESC, t.id DESC');
    expect(serie).toContain('p_simulados IS NULL OR s.id = ANY(p_simulados)');
    expect(serie).toContain('round(avg(p.acerto_pct), 1)');
    expect(serie).toContain('nullif(count(*), 0)');
    expect(serie).toContain('p.acerto_pct >= b.corte_mais_dificil');
    expect(serie).toContain('ORDER BY s.sequence_number, s.id');
    keys(serie, ['simulado_id', 'sequence_number', 'titulo', 'fechado', 'participantes', 'acerto_medio', 'acima_corte_pct']);
    expect(serie).not.toMatch(/coalesce\([^\n]*(?:acerto|corte)[^\n]*,\s*0\)/i);
  });

  it('engagement reuses turma identity and activity, calendar weeks and nullable source counts', () => {
    const eng = fn('mentor_engajamento_turma');
    expect(eng).toContain('p_semanas int default 8');
    expect(eng).toContain('p_semanas IS NULL OR p_semanas < 1 OR p_semanas > 52');
    expect(eng).toContain('jsonb_to_recordset(public.mentor_turma())');
    expect(eng).toContain('generate_series(0, p_semanas - 1)');
    expect(eng).toContain("date_trunc('week'");
    expect(eng).toContain("CASE WHEN a.ultima_atividade IS NULL THEN '[]'::jsonb");
    expect(eng).toContain('CASE WHEN a.tem_dado_questoes THEN');
    expect(eng).toContain('CASE WHEN a.tem_dado_consumo THEN');
    expect(eng).toContain('f.response_date >= w.semana');
    expect(eng).toContain('f.event_date >= w.semana');
    expect(eng).toContain('count(DISTINCT f.content_id)');
    keys(eng, ['email', 'ultima_atividade', 'dias_sem_atividade', 'segmento', 'semanas', 'semana', 'questoes', 'acertos', 'conteudos']);
  });

  it('themes respect release and latest attempt, normalize like mirror, aggregate per student and exam', () => {
    const temas = fn('mentor_temas_turma');
    expect(temas).toContain('p_simulados uuid[] default null');
    expect(temas).toContain('DISTINCT ON (t.email, t.simulado_id)');
    expect(temas).toContain('s.janela_fim IS NOT NULL');
    expect(temas).toContain('greatest(coalesce(s.resultado_liberado_em, s.janela_fim), s.janela_fim)');
    expect(temas).toContain('r.correta IS NOT NULL');
    expect(temas).toContain("lower(regexp_replace(btrim(p.tema_label), '\\s+', ' ', 'g')) AS tema_key");
    expect(temas).toContain('LEFT JOIN public.enamed_prevalencia_tema pr ON pr.tema_norm = g.tema_key');
    expect(temas).toContain('GROUP BY area, esp_key, tema_key, email');
    expect(temas).toContain('HAVING 100.0 * count(*) FILTER (WHERE correta) / count(*) < 50');
    expect(temas).toContain("'critico', g.respostas >= 30");
    expect(temas).toContain("WHEN 'Alta' THEN 3 WHEN 'Média' THEN 2 WHEN 'Baixa' THEN 1");
    keys(temas, ['grande_area', 'especialidade', 'tema', 'prevalencia', 'peso', 'respostas', 'acerto_pct', 'alunos_abaixo_50', 'critico', 'serie', 'simulado_id']);
  });

  it('changes detalhamento signature without an ambiguous overload and only narrows authorized turma', () => {
    const detalhe = fn('mentor_detalhamento');
    expect(SQL).toContain('drop function public.mentor_detalhamento(uuid[]);');
    expect(detalhe).toContain('p_simulados uuid[], p_emails text[] default null');
    expect(detalhe).toContain('IF p_emails IS NOT NULL THEN');
    expect(detalhe).toContain('v_emails := public.mentor_exige_alunos(v_mentor, p_emails)');
    expect(detalhe).toContain('AND (v_emails IS NULL OR v.email_normalizado = ANY(v_emails))');
    const previous = fn('mentor_detalhamento', migration('20261015201557_b2c_respostas_correta_nula.sql'));
    const restored = detalhe.replace(', p_emails text[] default null', '')
      .replace('  v_emails text[];\n', '')
      .replace(/  IF p_emails IS NOT NULL THEN[\s\S]*?  END IF;\n/, '')
      .replace(/\s+AND \(v_emails IS NULL OR v.email_normalizado = ANY\(v_emails\)\)/, '');
    expect(normalize(restored)).toBe(normalize(previous));
  });

  it('adds absolute score counts without losing ranking, taxonomy, authorization or release guards', () => {
    const notas = fn('mentor_aluno_notas');
    expect(notas).toContain('public.mentor_exige_alunos(v_mentor, array[p_email])');
    expect(notas).toContain('t.acertos, t.respondidas,');
    expect(notas).toContain("'acertos', t.acertos, 'respondidas', t.respondidas,");
    const previous = fn('mentor_aluno_notas', migration('20261015201557_b2c_respostas_correta_nula.sql'));
    const restored = notas.replace('t.acertos, t.respondidas,', '')
      .replace("'acertos', t.acertos, 'respondidas', t.respondidas,", '');
    expect(normalize(restored)).toBe(normalize(previous));
  });
});
