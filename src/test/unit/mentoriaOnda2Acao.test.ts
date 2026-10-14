import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SQL = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '20261014200200_mentoria_onda2_rpcs_acao.sql'),
  'utf8',
);

/** Corpo de uma função: do `create or replace function public.<nome>(` até a próxima. */
function corpo(nome: string): string {
  const partes = SQL.split(/create or replace function /i).slice(1);
  const achada = partes.find((p) => p.startsWith(`public.${nome}(`));
  if (!achada) throw new Error(`função ${nome} não encontrada`);
  return achada;
}

const FUNCOES = [
  'mentor_mural_salvar', 'mentor_mural_listar', 'mentor_tags',
  'mentor_sessao_salvar', 'mentor_sessao_marcar_feita', 'mentor_sessoes_listar',
  'mentor_definir_link_agendamento', 'mentor_agenda_liberar', 'mentor_agenda_desligar',
  'mentor_intervencao_criar', 'mentor_intervencao_atualizar', 'mentor_intervencao_comentar',
  'mentor_intervencoes_listar',
];

const COM_EMAIL = [
  'mentor_mural_salvar', 'mentor_mural_listar', 'mentor_sessao_salvar',
  'mentor_agenda_liberar', 'mentor_agenda_desligar', 'mentor_intervencao_criar',
];

describe('Onda 2 · RPCs de ação', () => {
  it.each(FUNCOES)('%s abre com mentor_ativo_id() no DECLARE', (f) => {
    expect(corpo(f)).toMatch(/v_mentor uuid := public\.mentor_ativo_id\(\)/);
  });

  it.each(FUNCOES)('%s é security definer, search_path fixo e tem os grants', (f) => {
    expect(corpo(f)).toMatch(/security definer/i);
    expect(corpo(f)).toMatch(/set search_path to 'public', 'pg_temp'/i);
    expect(SQL).toContain(`revoke all on function public.${f}(`);
    expect(SQL).toMatch(new RegExp('revoke execute on function public[.]' + f + '[(][^)]*[)] from anon', 'i'));
    expect(SQL).toMatch(new RegExp('grant execute on function public[.]' + f + '[(][^)]*[)] to authenticated', 'i'));
  });

  it.each(COM_EMAIL)('%s passa e-mails por mentor_exige_alunos', (f) => {
    expect(corpo(f)).toMatch(/public\.mentor_exige_alunos\(v_mentor,/);
  });

  it('mentor_agenda_liberar tem as duas mensagens de erro exatas', () => {
    const c = corpo('mentor_agenda_liberar');
    expect(c).toContain("RAISE EXCEPTION 'mensagem obrigatória'");
    expect(c).toContain("RAISE EXCEPTION 'cadastre o link do Google Agenda antes de liberar'");
  });

  it('mentor_agenda_liberar desliga a ligada antes de inserir e cria post Pra você + card por aluno', () => {
    const c = corpo('mentor_agenda_liberar');
    expect(c).toMatch(/SET ligado = false[\s\S]*INSERT INTO public\.mentoria_agenda_liberacoes/);
    expect(c).toContain("'liberacao_agenda'");
    expect(c).toContain("'selecionados'");
    expect(c).toContain("'reuniao_individual'");
    expect(c).toContain("'agenda_liberada'");
  });

  it('mentor_agenda_desligar: nulo = todos, com evento', () => {
    const c = corpo('mentor_agenda_desligar');
    expect(c).toMatch(/p_emails IS NULL OR/);
    expect(c).toContain("'agenda_desligada'");
  });

  it('mentor_mural_salvar registra card mensagem_mural feito quando p_registrar_intervencao', () => {
    const c = corpo('mentor_mural_salvar');
    expect(c).toMatch(/IF p_registrar_intervencao THEN[\s\S]*INSERT INTO public\.mentoria_intervencoes[\s\S]*'mensagem_mural'/);
    expect(c).toContain("'mural_publicado'");
    expect(c).toContain("'feito'");
    expect(c).toMatch(/coalesce\(publicado_em, now\(\)\)/);
  });

  it('mentor_mural_salvar: selecionados exige ao menos um e a lista é substituída', () => {
    const c = corpo('mentor_mural_salvar');
    expect(c).toContain('selecione ao menos um destinatário');
    expect(c).toMatch(/DELETE FROM public\.mural_destinatarios/);
  });

  it('mentor_sessao_salvar: coletiva cria post sessao_coletiva e card coletivo; individual cria card individual', () => {
    const c = corpo('mentor_sessao_salvar');
    expect(c).toContain("'sessao_coletiva'");
    expect(c).toContain("'Sessão coletiva: '");
    expect(c).toContain("'reuniao_coletiva'");
    expect(c).toContain("'reuniao_individual'");
    expect(c).toContain("'sessao_criada'");
    expect(c).toMatch(/jsonb_build_object\('kind', 'sessao', 'id', v_sessao_id\)/);
  });

  it('mentor_sessao_marcar_feita leva o card ligado para feito e registra o evento', () => {
    const c = corpo('mentor_sessao_marcar_feita');
    expect(c).toContain("'realizada'");
    expect(c).toMatch(/origem_ref->>'id' = p_id::text/);
    expect(c).toContain("'sessao_realizada'");
  });

  it('mentor_intervencoes_listar tem a expressão de peso do medidor', () => {
    expect(corpo('mentor_intervencoes_listar')).toMatch(
      /case when alvo = 'turma' or tipo = 'mensagem_mural' then 1 else greatest\(n_alunos, ?1\) end/i,
    );
    expect(corpo('mentor_intervencoes_listar')).toContain('America/Sao_Paulo');
  });

  it('mentor_intervencao_atualizar grava concluido_em e evento por mudança de status', () => {
    const c = corpo('mentor_intervencao_atualizar');
    expect(c).toContain('concluido_em');
    expect(c).toContain("'intervencao_status'");
  });

  it('mentor_tags devolve as sugestões fixas', () => {
    const c = corpo('mentor_tags');
    for (const t of ['Desempenho', 'Aviso', 'Fique por dentro']) expect(c).toContain(`'${t}'`);
  });

  it('objetos de outro mentor viram "não encontrado"', () => {
    expect(corpo('mentor_mural_salvar')).toContain('post não encontrado');
    expect(corpo('mentor_sessao_salvar')).toContain('sessão não encontrada');
    expect(corpo('mentor_sessao_marcar_feita')).toContain('sessão não encontrada');
    expect(corpo('mentor_intervencao_atualizar')).toContain('intervenção não encontrada');
    expect(corpo('mentor_intervencao_comentar')).toContain('intervenção não encontrada');
  });

  it('o histórico nunca é apagado', () => {
    expect(SQL).not.toMatch(/delete\s+from\s+public\.mentoria_/i);
    const deletes = SQL.match(/delete\s+from\s+public\.\w+/gi) ?? [];
    for (const d of deletes) expect(d).toMatch(/mural_destinatarios/i);
  });

  it('nenhuma função é concedida a anon', () => {
    expect(SQL).not.toMatch(/grant execute[^;]*to anon/i);
  });
});
