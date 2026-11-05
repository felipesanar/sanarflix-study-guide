import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarDadosAcademy } from '@/features/mentor/api/fonteAcademy';

// Formatos dos jsonb_build_object do snapshot rpcs-b2b-geradas.sql.
const meta = { periodo: 'turma', fonte: 'TRI', atualizadoEm: '2026-11-04', criterio: 'real', partial: true, lowSample: false, alunosSemAcademy: 2 };
const envelope = (data: unknown) => ({ data, meta });
const cronograma = [
  { id: 's2', nome: 'Segundo', data: '2026-10-01T12:00:00Z', status: 'processing', participantes: null, modalidade: 'online', indisponivelPorque: 'TRI pendente' },
  { id: 's1', nome: 'Primeiro', data: '2026-08-01T12:00:00Z', status: 'realizado', participantes: 20 },
  { id: 's3', nome: 'Terceiro', data: null, status: 'reagendado', participantes: null },
];
const questao = { id: 'q1', numero: 7, simuladoId: 's1', grandeArea: 'Clinica', especialidade: 'Cardio', tema: 'ECG', acertoPct: 0, enunciado: 'Caso clinico', imagemEnunciado: 'img', imagemEnunciado2: null, imagemComentario: null, alternativas: [{ letra: 'A', texto: 'Sim', correta: true, marcadaPct: 0 }, { letra: 'B', texto: 'Nao', correta: false, marcadaPct: 100 }] };
function fonte(respostas: Record<string, unknown>) {
  const rpc = vi.fn(async (fn: string, _args?: Record<string, unknown>) => {
    if (!(fn in respostas)) throw new Error(`RPC inesperada: ${fn}`);
    return respostas[fn];
  });
  return { dados: criarDadosAcademy(rpc), rpc };
}
afterEach(() => vi.useRealTimers());

describe('contrato real B2B', () => {
  it.each(['30d', '90d', '6m', 'ciclo'] as const)('converte %s para datas civis de Sao Paulo em todas as RPCs de periodo', async (periodo) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T01:30:00Z')); // ainda dia 3 em SP
    const { dados, rpc } = fonte({ mentor_visao_geral_b2b: envelope({}), mentor_cronograma_b2b: envelope([]), mentor_alunos_b2b: envelope({ data: [] }), mentor_temas_turma_b2b: envelope([]) });
    await dados.visaoGeralB2b(periodo);
    await dados.alunosB2b(periodo);
    await dados.temasTurmaB2b(periodo);
    const inicio = { '30d': '2026-10-04', '90d': '2026-08-05', '6m': '2026-05-03', ciclo: null }[periodo];
    for (const fn of ['mentor_visao_geral_b2b', 'mentor_alunos_b2b', 'mentor_temas_turma_b2b']) {
      expect(rpc).toHaveBeenCalledWith(fn, { p_inicio: inicio, p_fim: periodo === 'ciclo' ? null : '2026-11-03' });
    }
  });

  it('limita seis meses ao ultimo dia do mes destino', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
    const { dados, rpc } = fonte({ mentor_alunos_b2b: envelope({ data: [] }) });
    await dados.alunosB2b('6m');
    expect(rpc).toHaveBeenCalledWith('mentor_alunos_b2b', { p_inicio: '2026-02-28', p_fim: '2026-08-31' });
  });

  it('visao geral usa kpis, evolucao e contagens reais, com ordem do cronograma', async () => {
    const { dados } = fonte({ mentor_cronograma_b2b: envelope(cronograma), mentor_visao_geral_b2b: envelope({ kpis: { enamedProjetado: { valor: 3, delta: 1, serie: [{ rotulo: 'atual', valor: 3 }], origem: 'estimado' }, triProjetado: { valor: 61, delta: null, serie: [{ simuladoId: 's2', valor: 61 }] }, proficientesPct: { valor: 60, delta: null, serie: [] }, acertoPct: { valor: 0 }, simulados: { realizados: 2, contratados: null } }, evolucao: [{ simuladoId: 's2', nome: 'Segundo', data: cronograma[0].data, valor: 61, participantes: 20 }], alunosMatriculadosNoRecorte: 30, n_prof: 12, n_tri: 20, faltam_para_proximo_conceito: 3 }) });
    const r = await dados.visaoGeralB2b('ciclo');
    expect(r.meta).toBe(meta);
    expect(r.data).toMatchObject({ simuladoReferenciaId: 's2', conceitoEnamed: { valor: 3 }, triProjetado: { valor: 61, serie: [{ rotulo: 'Segundo', valor: 61 }] }, proficientesPct: { valor: 60 }, proficientes: 12, participantes: 20, totalAlunos: 30, acertoPct: 0, simuladosRealizados: 2, simuladosContratados: null, comTri: 20, faltamParaProximoConceito: 3 });
    expect(r.data.simulados[0]).toMatchObject({ id: 's2', ordem: 2, status: 'processando' });
  });

  it('alunos desembrulha pagina, preserva todas as classificacoes e prioriza baixo', async () => {
    const { dados } = fonte({ mentor_alunos_b2b: envelope({ data: [{ id: 'a1', email: 'a@x', nome: 'Ana', semestre: 11, perfil: ['virada', 'baixo'], grupo: 'em_variacao', tendencia: 'descendo', proficiencias: [{ simuladoId: 's1', valor: 0 }, { simuladoId: 's2', valor: null }], ultima_atividade: '2026-10-01', sinalizado_em: null }] }) });
    const r = await dados.alunosB2b('ciclo');
    expect(r.meta).toBe(meta);
    expect(r.data[0]).toMatchObject({ email: 'a@x', perfil: 'muito_baixo', perfis: ['virada', 'muito_baixo'], proficiencias: [{ simuladoId: 's1', ordem: null, valor: 0 }, { simuladoId: 's2', ordem: null, valor: null }], telefone: null, acertoUltimoPct: null, diasSemAtividade: null, ultimaAtividade: '2026-10-01', tendencia: 'descendo' });
  });

  it('temas mapeia snake case e campos adicionais, sem fabricar serie ou alunos', async () => {
    const { dados } = fonte({ mentor_temas_turma_b2b: envelope([{ grande_area: 'Clinica', especialidade: 'Cardio', tema: 'ECG', respostas: 30, acerto_pct: 0, critico: true, prevalencia: 'alta', impacto: 300, amostra: 12, lowSample: false }]) });
    const r = await dados.temasTurmaB2b('ciclo');
    expect(r.meta).toBe(meta);
    expect(r.data[0]).toMatchObject({ grandeArea: 'Clinica', peso: 3, respostas: 30, acertoPct: 0, critico: true, impacto: 300, amostra: 12, lowSample: false, serie: [], alunosAbaixo50: [] });
  });

  it('questoes usa pagina camelCase, nao transforma percentuais em contagens', async () => {
    const { dados, rpc } = fonte({ mentor_questoes_b2b: envelope({ data: [questao], total: 1 }) });
    const r = await dados.questoesB2b(['s1']);
    expect(r.meta).toBe(meta);
    expect(rpc).toHaveBeenCalledWith('mentor_questoes_b2b', { p_simulados: ['s1'] });
    expect(r.data[0]).toMatchObject({ questaoId: 'q1', numero: 7, grandeArea: 'Clinica', tema: 'ECG', acertoPct: 0, respostas: null, distribuicao: {}, emailsPorAlternativa: {}, corretaLabel: 'A', temImagem: true, enunciadoInicio: 'Caso clinico', simuladoId: 's1', distribuicaoPct: { A: 0, B: 100 } });
  });

  it('detalhamento usa metricas, areas e pagina embutida; recupera id por numero', async () => {
    const { id: _id, ...semId } = questao;
    const payload = { metricas: [{ simuladoId: 's1', nome: 'Primeiro', data: '2026-08-01', acertoMedioPct: 0, enamedProjetado: 2, proficienciaMedia: 50, proficientesPct: 40 }], acertoPorAreaESemestre: { areas: [{ id: 'CM', nome: 'Clinica', acertoPct: 0, critica: true }], semestres: [] }, questoes: { data: [semId] } };
    const { dados } = fonte({ mentor_detalhamento_b2b: envelope(payload), mentor_questoes_b2b: envelope({ data: [questao] }) });
    const r = await dados.detalhamentoB2b(['s1']);
    expect(r.meta).toBe(meta);
    expect(r.data).toMatchObject({ acertoMedioPct: 0, conceitoEnamed: { valor: 2, delta: null }, triProjetado: { valor: 50 }, proficientesPct: 40, areas: [{ grandeArea: 'Clinica', acertoPct: 0, respostas: null, especialidades: [], temas: [] }], questoes: [{ questaoId: 'q1', respostas: null }], bloqueados: [] });
  });

  it('nao atribui id ambiguo nem inventa agregado entre simulados', async () => {
    const { dados } = fonte({ mentor_detalhamento_b2b: envelope({ metricas: [{ simuladoId: 's1', acertoMedioPct: 30 }, { simuladoId: 's2', acertoMedioPct: 80 }], questoes: { data: [{ numero: 7 }] } }), mentor_questoes_b2b: envelope({ data: [questao, { ...questao, id: 'q2', simuladoId: 's2' }] }) });
    const r = await dados.detalhamentoB2b(['s1', 's2']);
    expect(r.data.questoes[0].questaoId).toBeNull();
    expect(r.data.acertoMedioPct).toBeNull();
    expect(r.data.metricas).toHaveLength(2);
  });

  it('respondentes preserva alunoId e meta minimalista real', async () => {
    const minimal = { fonte: 'answer_progress', atualizadoEm: '2026-11-04' };
    const { dados, rpc } = fonte({ mentor_questao_respondentes_b2b: { data: [{ alunoId: 'a1', email: 'a@x', nome: 'Ana', alternativa: 'B' }], meta: minimal } });
    const r = await dados.respondentesB2b('q1', ['s1']);
    expect(r.meta).toBe(minimal);
    expect(r.data).toEqual([{ alunoId: 'a1', email: 'a@x', nome: 'Ana', alternativa: 'B' }]);
    expect(rpc).toHaveBeenCalledWith('mentor_questao_respondentes_b2b', { p_questao_id: 'q1', p_simulados: ['s1'] });
  });

  it('cronograma deriva ordem cronologica sem alterar a ordem retornada e normaliza status', async () => {
    const { dados } = fonte({ mentor_cronograma_b2b: envelope(cronograma) });
    const r = await dados.cronogramaB2b();
    expect(r.meta).toBe(meta);
    expect(r.data).toMatchObject([{ id: 's2', ordem: 2, status: 'processando', participantes: null, statusOriginal: 'processing', modalidade: 'online', indisponivelPorque: 'TRI pendente' }, { id: 's1', ordem: 1 }, { id: 's3', ordem: 3, status: 'agendado' }]);
  });

  it('aluno detalhe vem como lista por simulado; campos ausentes ficam null ou colecao vazia', async () => {
    const { dados, rpc } = fonte({ mentor_aluno_b2b: envelope([{ id: 'a1', nome: 'Ana', semestre: 11, simuladoId: 's1', simuladoNome: 'Primeiro', simuladoData: '2026-08-01', participou: true, acertos: 20, proficiencia: null, situacao: 'aguardando_resultado', posicao: null, acertoPorArea: [] }]) });
    const r = await dados.alunoB2b('a@x');
    expect(r.meta).toBe(meta);
    expect(rpc).toHaveBeenCalledWith('mentor_aluno_b2b', { p_email: 'a@x' });
    expect(r.data).toMatchObject({ aluno: { email: 'a@x', nome: 'Ana', semestre: 11, perfil: null, telefone: null }, simulados: [{ simuladoId: 's1', ordem: null, titulo: 'Primeiro', proficiencia: null, acertoPct: null, participou: true, acertos: 20, situacao: 'aguardando_resultado' }], consumo30d: null, intervencoes: [], log: [], sinalizadoEm: null });
  });

  it('aluno sem Academy nao ganha identidade ou notas ficticias', async () => {
    const { dados } = fonte({ mentor_aluno_b2b: envelope([]) });
    expect((await dados.alunoB2b('a@x')).data).toEqual({ aluno: null, simulados: [], consumo30d: null, intervencoes: [], log: [], sinalizadoEm: null });
  });
});
