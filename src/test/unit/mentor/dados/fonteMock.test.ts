import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarMock, LATENCIA_MOCK_MS } from '@/features/mentor/api/fonteMock';

afterEach(() => vi.useRealTimers());

describe('fonteMock · B2C (tribo Carcará)', () => {
  it('me e turma vêm do protótipo', async () => {
    const { fonte } = criarMock('b2c', { latenciaMs: 0 });
    const me = await fonte.me();
    expect(fonte.nome).toBe('mock');
    expect(me.portalMentor).toBe(true);
    expect(me.mentor).toMatchObject({ nome: 'Thiago Taniguchi', modalidade: 'b2c' });
    expect(me.tribos[0]).toMatchObject({ nome: 'Carcará', slug: 'carcara', lema: 'Nota 90+' });
    const alunos = await fonte.alunos(me.tribos[0].id);
    expect(alunos.length).toBe(12);
    expect(alunos.every((a) => a.semestre === null)).toBe(true);
    expect(alunos.find((a) => a.nome === 'Beatriz Sampaio')?.meta).toMatchObject({ especialidade: 'Dermatologia', instituicao: 'USP-SP', cortePct: 84 });
  });

  it('DAG B2C: não fez = null (nunca zero)', async () => {
    const { dados } = criarMock('b2c', { latenciaMs: 0 });
    const { data } = await dados.desempenhoTurma(null);
    const marina = data.alunos.find((a) => a.nome === 'Marina Albuquerque')!;
    expect(marina.notas.map((n) => n.acertoPct)).toEqual([68, 70, 69, null, null]);
    expect(data.simulados.map((s) => s.status)).toEqual(['realizado', 'realizado', 'realizado', 'realizado', 'realizado', 'agendado']);
    const temas = (await dados.temasTurma(null)).data;
    expect(temas[0]).toMatchObject({ tema: 'Vigilância em saúde', prevalencia: 'alta', acertoPct: 44, respostas: 312 });
  });

  it('mural mutável: publicar, editar e excluir valem na sessão', async () => {
    const { fonte, dados } = criarMock('b2c', { latenciaMs: 0 });
    const t = (await fonte.me()).tribos[0].id;
    const antes = (await fonte.publicacoes(t)).data.length;
    const p = await fonte.criarPublicacao(t, { tag: 'aviso', titulo: 'Novo aviso', mensagem: 'Oi', link: null, status: 'publicada', destino: { tipo: 'tribo' }, registrarIntervencao: true });
    expect((await fonte.publicacoes(t)).data[0]).toMatchObject({ id: p.id, titulo: 'Novo aviso', status: 'publicada', editadaEm: null });
    // "Registrar como intervenção" cria o card em Feito, como o Academy.
    const quadro = await dados.intervencoes({ de: null, ate: null });
    expect(quadro.cards[0]).toMatchObject({ tipo: 'mensagem', status: 'feito', origem: 'mural', referenciaId: p.id });

    const editada = await fonte.editarPublicacao(p.id, { titulo: 'Aviso corrigido' });
    expect(editada.titulo).toBe('Aviso corrigido');
    expect(editada.editadaEm).not.toBeNull();

    await fonte.excluirPublicacao(p.id);
    expect((await fonte.publicacoes(t)).data.length).toBe(antes);
  });

  it('dois mocks não compartilham estado', async () => {
    const a = criarMock('b2c', { latenciaMs: 0 });
    const b = criarMock('b2c', { latenciaMs: 0 });
    const t = (await a.fonte.me()).tribos[0].id;
    await a.fonte.criarPublicacao(t, { tag: 'aviso', titulo: 'Só no A', mensagem: 'x', link: null, status: 'rascunho', destino: { tipo: 'tribo' } });
    expect((await b.fonte.publicacoes(t)).data.some((p) => p.titulo === 'Só no A')).toBe(false);
  });

  it('sessões e kanban mutáveis: criar sessão gera card; marcar realizada move para Feito', async () => {
    const { fonte, dados } = criarMock('b2c', { latenciaMs: 0 });
    const t = (await fonte.me()).tribos[0].id;
    const s = await fonte.criarSessao(t, { tipo: 'encontro_tribo', inicio: '2026-12-10T22:00:00Z', tema: 'Revisão final' });
    let card = (await dados.intervencoes({ de: null, ate: null })).cards.find((c) => c.referenciaId === s.id)!;
    expect(card).toMatchObject({ tipo: 'coletiva', status: 'afazer', origem: 'sessao_criada' });
    await fonte.editarSessao(s.id, { status: 'realizada' });
    card = (await dados.intervencoes({ de: null, ate: null })).cards.find((c) => c.referenciaId === s.id)!;
    expect(card.status).toBe('feito');
    await dados.atualizarIntervencao(card.id, { status: 'andamento' });
    expect((await dados.intervencoes({ de: null, ate: null })).cards.find((c) => c.id === card.id)!.status).toBe('andamento');
  });

  it('latência simulada padrão de 250 ms', async () => {
    vi.useFakeTimers();
    expect(LATENCIA_MOCK_MS).toBe(250);
    const { fonte } = criarMock('b2c');
    let pronto = false;
    void fonte.me().then(() => { pronto = true; });
    await vi.advanceTimersByTimeAsync(200);
    expect(pronto).toBe(false);
    await vi.advanceTimersByTimeAsync(60);
    expect(pronto).toBe(true);
  });
});

describe('fonteMock · B2B (UniAtenas Paracatu)', () => {
  it('me, turma com semestre, rotina e pérolas', async () => {
    const { fonte, dados } = criarMock('b2b', { latenciaMs: 0 });
    const me = await fonte.me();
    expect(me.mentor).toMatchObject({ nome: 'Beatriz Câmara', modalidade: 'b2b' });
    expect(me.tribos[0]).toMatchObject({ iesNome: 'UniAtenas', campus: 'Paracatu', encontrosPorMes: 2 });
    const alunos = await fonte.alunos(me.tribos[0].id);
    expect(alunos.find((a) => a.nome === 'Amanda Rocha')?.semestre).toBe(12);
    const rotina = await dados.rotina('2026-10-12');
    expect(rotina.map((r) => r.dia)).toEqual(['ter', 'qui', 'sex']);
    const pendente = rotina.find((r) => r.enviadoEm === null)!;
    await dados.marcarRotinaEnviada(pendente.id);
    expect((await dados.rotina('2026-10-12')).find((r) => r.id === pendente.id)!.enviadoEm).not.toBeNull();
    expect((await dados.perolas()).length).toBeGreaterThan(0);
  });

  it('DAG B2B: alunos com perfil e proficiência null quando não fez', async () => {
    const { dados } = criarMock('b2b', { latenciaMs: 0 });
    const { data } = await dados.alunosB2b('6m');
    const davi = data.find((a) => a.nome === 'Davi Santana')!;
    expect(davi.perfil).toBe('muito_baixo');
    expect(davi.proficiencias.map((p) => p.valor)).toEqual([38, 41, 39, null]);
    const visao = (await dados.visaoGeralB2b('6m')).data;
    expect(visao.triProjetado.valor).toBe(58.4);
    expect(visao.conceitoEnamed.valor).toBe(3);
  });

  it('sinalizar à IES uma vez por aluno', async () => {
    const { dados } = criarMock('b2b', { latenciaMs: 0 });
    const alunos = (await dados.alunosB2b('6m')).data;
    const alvo = alunos.find((a) => a.nome === 'Gabriela Prado')!;
    await dados.sinalizarIes(alvo.email, 'Proficiência abaixo de 45');
    await expect(dados.sinalizarIes(alvo.email, 'de novo')).rejects.toMatchObject({ code: 'validacao' });
  });
});
