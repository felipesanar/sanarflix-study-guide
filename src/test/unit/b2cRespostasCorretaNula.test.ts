import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = process.cwd();
const SQL = readFileSync(
  join(raiz, 'supabase', 'migrations', '20261015120000_b2c_respostas_correta_nula.sql'),
  'utf8',
);
const INDEX_TS = readFileSync(join(raiz, 'supabase', 'functions', 'sync-simulados-b2c', 'index.ts'), 'utf8');

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
const PENDENTES = 'b2c_sync_correcoes_pendentes()';

// CTE `resp` de uma função: do "resp AS (" até o fechamento "    ),".
const cteResp = (fn: string) => {
  const m = /\bresp AS \(([\s\S]*?)\n {4}\),/.exec(corpo(fn));
  expect(m).not.toBeNull();
  return m![1];
};

describe('b2c_respostas.correta nula (migration)', () => {
  it('remove o NOT NULL de correta e documenta que NULL = resultado não liberado', () => {
    expect(SQL).toMatch(/alter table public\.b2c_respostas alter column correta drop not null;/i);
    expect(SQL).toMatch(/comment on column public\.b2c_respostas\.correta is[\s\S]*?NULL[\s\S]*?ainda não liberado/i);
  });

  it('mentor_aluno_notas: resp só considera simulado liberado e correta preenchida', () => {
    const resp = cteResp(NOTAS);
    expect(resp).toMatch(/JOIN public\.b2c_simulados sr ON sr\.id = t\.simulado_id/);
    expect(resp).toContain('sr.janela_fim IS NOT NULL');
    expect(resp).toContain(
      'now() >= greatest(coalesce(sr.resultado_liberado_em, sr.janela_fim), sr.janela_fim)',
    );
    expect(resp).toMatch(/JOIN public\.b2c_respostas r ON r\.tentativa_id = t\.id AND r\.correta IS NOT NULL/);
  });

  it('mentor_aluno_notas: notas[] segue sem o filtro de liberação (nota visível antes)', () => {
    const c = corpo(NOTAS);
    const idx = c.indexOf("'notas'");
    expect(idx).toBeGreaterThan(0);
    const trechoNotas = c.slice(idx, c.indexOf("'areas'"));
    expect(trechoNotas).not.toMatch(/libera|janela_fim|correta IS NOT NULL/);
    // a CTE tent (de onde vêm as notas) também não filtra por liberação
    const tent = /\btent AS \(([\s\S]*?)\n {4}\),/.exec(c)![1];
    expect(tent).not.toMatch(/janela_fim|resultado_liberado_em|correta/);
  });

  it('mentor_detalhamento e mentor_questao: filtram correta nula na resp (janela entre liberação e re-sync)', () => {
    expect(cteResp(DETALHAMENTO)).toMatch(/b2c_respostas r ON r\.tentativa_id = t\.id AND r\.correta IS NOT NULL/);
    expect(cteResp(QUESTAO)).toMatch(
      /b2c_respostas r ON r\.tentativa_id = t\.id AND r\.questao_id = p_questao_id AND r\.correta IS NOT NULL/,
    );
  });

  it('mentor_detalhamento e mentor_questao mantêm o gate de liberação', () => {
    expect(corpo(DETALHAMENTO)).toContain('JOIN liberados l ON l.id = t.simulado_id');
    expect(corpo(DETALHAMENTO)).toContain('SELECT sm.id FROM sim sm WHERE now() >= sm.libera_em');
    expect(corpo(QUESTAO)).toContain('IF v_q.libera_em IS NULL OR now() < v_q.libera_em THEN');
  });

  it('mantém security definer + search_path e re-declara os grants das 3 funções mentor_*', () => {
    for (const fn of [DETALHAMENTO, QUESTAO, NOTAS]) {
      expect(corpo(fn)).toMatch(/security definer\s+set search_path to 'public', 'pg_temp'/);
    }
    for (const sig of ['mentor_detalhamento(uuid[])', 'mentor_questao(uuid, uuid[])', 'mentor_aluno_notas(text)']) {
      expect(SQL).toContain(`revoke all on function public.${sig} from public;`);
      expect(SQL).toContain(`revoke execute on function public.${sig} from anon;`);
      expect(SQL).toContain(`grant execute on function public.${sig} to authenticated;`);
    }
  });

  it('b2c_sync_correcoes_pendentes: security definer, search_path vazio, só service_role', () => {
    const c = corpo(PENDENTES);
    expect(c).toMatch(/returns boolean/);
    expect(c).toMatch(/security definer/);
    expect(c).toMatch(/set search_path to ''/);
    expect(c).toContain('r.correta is null');
    expect(c).toContain('s.janela_fim is not null');
    expect(c).toContain('now() >= greatest(coalesce(s.resultado_liberado_em, s.janela_fim), s.janela_fim)');
    expect(SQL).toContain('revoke all on function public.b2c_sync_correcoes_pendentes() from public;');
    expect(SQL).toContain('revoke all on function public.b2c_sync_correcoes_pendentes() from anon;');
    expect(SQL).toContain('revoke all on function public.b2c_sync_correcoes_pendentes() from authenticated;');
    expect(SQL).toContain('grant execute on function public.b2c_sync_correcoes_pendentes() to service_role;');
    expect(SQL).not.toMatch(
      /grant execute on function public\.b2c_sync_correcoes_pendentes\(\) to (authenticated|anon|public)/i,
    );
  });
});

describe('sync-simulados-b2c/index.ts · correções pendentes', () => {
  it('chama a RPC e trata como rodada completa (igual a anteriorFalhou)', () => {
    expect(INDEX_TS).toContain('db.rpc("b2c_sync_correcoes_pendentes")');
    expect(INDEX_TS).toMatch(/anteriorFalhou \|\| correcoesPendentes/);
  });

  it('não altera a autenticação por service role', () => {
    expect(INDEX_TS).toContain('temAcessoDeServico');
    expect(INDEX_TS).toContain('b2c_sync_sou_servico');
  });
});
