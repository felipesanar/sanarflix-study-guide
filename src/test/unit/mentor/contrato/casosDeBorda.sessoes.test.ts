import { describe, expect, it, vi } from 'vitest';
import { campoParaIso } from '@/features/mentor/components/sessoes/dataHora';
import { lerData } from '@/features/mentor/components/sessoes-v2/util';
import { AGORA, JANELA, MODULOS, preparar, SESSAO, type FonteFutura } from './apoio';

describe('janelas e fuso de Brasilia', () => {
  for (const [duracaoMin, quantidade] of [[30, 4], [45, 2], [60, 2]] as const) {
    // FALTA: modulo horarios com divisao da janela e descarte da sobra
    it.fails(`[S1] divide duas horas em ${quantidade} blocos de ${duracaoMin} minutos`, async () => {
      const { dividirJanela } = await import(MODULOS.horarios);
      const blocos = dividirJanela({ inicio: new Date(JANELA.inicio), fim: new Date(JANELA.fim), duracaoMin });
      expect(blocos).toEqual(Array.from({ length: quantidade }, (_, i) => ({ inicio: new Date(Date.parse(JANELA.inicio) + i * duracaoMin * 60000), fim: new Date(Date.parse(JANELA.inicio) + (i + 1) * duracaoMin * 60000) })));
    });
  }
  // FALTA: modulo horarios valida horizonte de 30 dias e datas passadas
  it.fails('[S10] aceita limite de 30 dias e recusa passado e um milissegundo alem', async () => {
    const { dentroDoHorizonte, LIMITE_HORIZONTE_DIAS } = await import(MODULOS.horarios);
    expect(LIMITE_HORIZONTE_DIAS).toBe(30);
    expect(dentroDoHorizonte(new Date(AGORA.getTime() + 30 * 86400000), AGORA)).toBe(true);
    expect(dentroDoHorizonte(new Date(AGORA.getTime() + 30 * 86400000 + 1), AGORA)).toBe(false);
    expect(dentroDoHorizonte(new Date(AGORA.getTime() - 1), AGORA)).toBe(false);
  });
  // FALTA: modulo horarios detecta intersecao e permite horarios adjacentes
  it.fails('[S11] detecta sobreposicao sem confundir fronteiras adjacentes', async () => {
    const { detectarSobreposicao } = await import(MODULOS.horarios);
    const bloco = (inicio: string, fim: string) => ({ inicio: new Date(inicio), fim: new Date(fim) });
    const existentes = [bloco(JANELA.inicio, JANELA.fim)];
    expect(detectarSobreposicao([bloco('2026-11-12T18:59:00Z', '2026-11-12T20:00:00Z')], existentes)).toBe(true);
    expect(detectarSobreposicao([bloco(JANELA.fim, '2026-11-12T20:00:00Z')], existentes)).toBe(false);
  });
  for (const tz of ['America/Manaus', 'Europe/Lisbon']) {
    // FALTA: conversor explicito de Brasilia independente do fuso do aparelho
    it.fails(`[S13] interpreta 19h de Brasilia como 22h UTC com aparelho em ${tz}`, async () => {
      vi.stubEnv('TZ', tz);
      try {
        const { paraUtcIso } = await import(MODULOS.brasilia);
        const iso = paraUtcIso({ ano: 2026, mes: 11, dia: 12, hora: 19, minuto: 0 });
        expect(iso).toMatch(/Z$/);
        expect(new Date(iso).toISOString()).toBe('2026-11-12T22:00:00.000Z');
      } finally { vi.unstubAllEnvs(); }
    });
  }
  // FALTA: formatador explicito com rotulo obrigatorio do fuso
  it.fails('[S13] mostra 19h e termina com horario de Brasilia', async () => {
    const { formatarBrasilia, ROTULO_FUSO } = await import(MODULOS.brasilia);
    expect(ROTULO_FUSO).toBe('horário de Brasília');
    expect(formatarBrasilia('2026-11-12T22:00:00Z')).toMatch(/12\/11.*19h.*\(horário de Brasília\)$/);
  });
  it('[S13] campoParaIso ja grava corretamente com offset de Brasilia', () => {
    expect(campoParaIso('2026-11-12T19:00')).toBe('2026-11-12T22:00:00.000Z');
  });
  // FALTA: criarHorarios ainda nao envia janela em UTC
  it.fails('[S13] criarHorarios envia inicio e fim terminando em Z', async () => {
    const a = preparar();
    await (a.fonte as FonteFutura).criarHorarios(a.triboId, JANELA);
    expect(a.pedidos).toHaveLength(1);
    expect(a.pedidos[0].corpo).toEqual(JANELA);
    expect(a.pedidos[0].corpo).toMatchObject({ inicio: expect.stringMatching(/Z$/), fim: expect.stringMatching(/Z$/) });
  });
  // HOJE (a corrigir): data no passado e empurrada para o ano seguinte sem aviso.
  it('[S10] documenta data passada empurrada para o ano seguinte', () => {
    expect(lerData('10/11', AGORA)).toBe('2027-11-10');
  });
});

describe('contrato de sessoes pelo simulador, sem tela', () => {
  it('[S10] servidor recusa janela alem de 30 dias sem criar horarios', () => {
    const a = preparar();
    expect(a.responder('POST', `/tribos/${a.triboId}/horarios`, { ...JANELA, inicio: '2026-12-12T17:00:00Z', fim: '2026-12-12T19:00:00Z' })).toMatchObject({ status: 422, corpo: { error: { code: 'fora_do_horizonte' } } });
    expect(a.responder('GET', `/tribos/${a.triboId}/sessoes`).corpo).toMatchObject({ data: [] });
  });
  it('[S11] servidor detecta conflito entre tribos do mesmo mentor atomicamente', () => {
    const a = preparar(); a.criarSessao();
    expect(a.responder('POST', `/tribos/${a.triboB2bId}/horarios`, JANELA)).toMatchObject({ status: 409, corpo: { error: { code: 'conflito_horario' } } });
    expect(a.responder('GET', `/tribos/${a.triboB2bId}/sessoes`).corpo).toMatchObject({ data: [] });
  });
  // FALTA: FonteMentoria nao expoe cancelarSessao com aviso individual
  it.fails('[S9] cancela encontro individual e devolve aviso para o aluno', async () => {
    const a = preparar(); const s = a.criarSessao({ ...SESSAO, tipo: 'individual', alunoId: a.alunoIds[0] });
    expect(await (a.fonte as FonteFutura).cancelarSessao(s.id, 'Imprevisto')).toMatchObject({ sessao: { status: 'cancelada' }, avisoPublicacaoId: expect.any(String) });
  });
  it('[S15] Meet pendente impede link manual; falhou permite colar', async () => {
    const a = preparar(); const s = await a.fonte.criarSessao(a.triboId, SESSAO);
    expect(s).toMatchObject({ meet: { estado: 'pendente' } });
    await expect(a.fonte.editarSessao(s.id, { meetUrl: 'https://meet.google.com/manual' })).rejects.toMatchObject({ code: 'sessao_nao_editavel' });
    a.simulador.concluirSalaMeet(s.id, 'falhou');
    const r = a.responder('PATCH', `/sessoes/${s.id}`, { meetUrl: 'https://meet.google.com/manual' });
    expect(r).toMatchObject({ status: 200, corpo: { sessao: { meet: { estado: 'pronto', url: 'https://meet.google.com/manual' } } } });
  });
  it('[S16] horario reservado nao permite editar data nem duracao', async () => {
    const a = preparar(); const [s] = a.criarHorarios();
    expect(a.responder('POST', `/sessoes/${s.id}/reservar`).status).toBe(200);
    await expect(a.fonte.editarSessao(s.id, { inicio: '2026-11-13T17:00:00Z' })).rejects.toMatchObject({ code: 'sessao_nao_editavel' });
    await expect(a.fonte.editarSessao(s.id, { duracaoMin: 60 })).rejects.toMatchObject({ code: 'sessao_nao_editavel' });
  });
  // FALTA: FonteMentoria nao expoe excluirHorario
  it.fails('[S17] exclui horario livre sem cancelar outros horarios', async () => {
    const a = preparar(); const horarios = a.criarHorarios();
    await (a.fonte as FonteFutura).excluirHorario(horarios[0].id);
    expect((await a.fonte.sessoes(a.triboId)).data.map((s) => s.id)).toEqual(horarios.slice(1).map((s) => s.id));
  });
  it('[S17] exclusao de horario recem-reservado avisa quem reservou', async () => {
    const a = preparar(); const [s] = a.criarHorarios(); a.responder('POST', `/sessoes/${s.id}/reservar`);
    await expect(a.fonte.excluirSessao(s.id)).rejects.toMatchObject({ status: 409, code: 'horario_reservado', message: expect.stringContaining('Ana Souza') });
  });
  it('[S19] horario passado sem reserva permanece disponivel, sem virar encontro', async () => {
    const a = preparar(); a.criarHorarios(); a.simulador.avancarRelogio(3 * 86400000);
    const pagina = await a.fonte.sessoes(a.triboId);
    expect(pagina.data).toHaveLength(4);
    for (const s of pagina.data) expect(s).toMatchObject({ tipo: 'disponivel', alunoId: null });
  });
  // FALTA: FonteMentoria nao expoe cancelamento coletivo com aviso no mural
  it.fails('[C3] cancelar coletiva devolve aviso e sai da lista agendada', async () => {
    const a = preparar(); const s = a.criarSessao();
    const r = await (a.fonte as FonteFutura).cancelarSessao(s.id);
    expect(r.avisoPublicacaoId).toEqual(expect.any(String));
    expect(a.responder('GET', `/tribos/${a.triboId}/sessoes?status=agendada`).corpo).toMatchObject({ data: [] });
    expect((await a.fonte.publicacoes(a.triboId)).data).toEqual([expect.objectContaining({ id: r.avisoPublicacaoId, destino: { tipo: 'tribo' } })]);
  });
  it('[C4] servidor aceita mudar data antes da janela e bloqueia a dez minutos', async () => {
    const a = preparar(); const s = a.criarSessao();
    expect(a.responder('PATCH', `/sessoes/${s.id}`, { inicio: '2026-11-12T18:00:00Z' })).toMatchObject({ status: 200, corpo: { avisoPublicacaoId: expect.any(String) } });
    a.simulador.avancarRelogio(Date.parse('2026-11-12T17:50:00Z') - AGORA.getTime());
    await expect(a.fonte.editarSessao(s.id, { inicio: '2026-11-13T18:00:00Z' })).rejects.toMatchObject({ code: 'sessao_nao_editavel' });
  });
  it('[G3] gravacao aguarda por 23 horas e fica pendente apos 25 horas do fim', async () => {
    const a = preparar(); const s = a.criarSessao(); a.simulador.marcarRealizada(s.id);
    const fim = Date.parse(SESSAO.inicio) + 3600000;
    a.simulador.avancarRelogio(fim + 23 * 3600000 - AGORA.getTime());
    expect((await a.fonte.sessoes(a.triboId)).data[0]).toMatchObject({ gravacao: { estado: 'aguardando' } });
    a.simulador.avancarRelogio(2 * 3600000);
    expect((await a.fonte.sessoes(a.triboId)).data[0]).toMatchObject({ gravacao: { estado: 'pendente' } });
  });
});
