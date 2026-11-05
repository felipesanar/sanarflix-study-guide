import { describe, expect, it } from 'vitest';
import {
  alertasDoAluno, engajamento, filtrarTemasCriticos, ordenarTemas, perfilB2B,
  segmentoCorte, situacaoCorte, statusSessao, tomCelula, vsCorte,
  diasSemAtividade, prioridadesB2C, prioridadesB2B, impactoTema, FATIA_PROVA,
  coletivasNoMes, ordenarSessoes, saudacao,
} from './regrasMentor';
import type { AlunoMentor, Sessao, TemaTurma } from '../api/types';

const aluno: AlunoMentor = { id: 'a', nome: 'A', semestre: 9, telefone: null, acessoAte: null, ultimaAtividade: null, meta: null };

describe('engajamento', () => {
  it('15 dias é sumido (mesmo corte no Início e na Turma)', () => expect(engajamento(15)).toBe('sumido'));
  it('8 a 14 é esfriando', () => {
    expect(engajamento(8)).toBe('esfriando');
    expect(engajamento(14)).toBe('esfriando');
  });
  it('nunca acessou conta como sumido', () => expect(engajamento(null)).toBe('sumido'));
  it('preserva ausência, descarta data inválida e limita atividade futura', () => {
    const hoje = new Date('2026-11-04T12:00:00Z');
    expect(diasSemAtividade(null, hoje)).toBeNull();
    expect(diasSemAtividade('inválida', hoje)).toBeNull();
    expect(diasSemAtividade('2026-11-05T12:00:00Z', hoje)).toBe(0);
    expect(diasSemAtividade('2026-10-20T12:00:00Z', hoje)).toBe(15);
    expect(engajamento(7)).toBe('ativo');
  });
});

describe('B2C · corte da meta', () => {
  it('vsCorte nunca transforma ausência em zero', () => {
    expect(vsCorte(null, 80)).toBeNull();
    expect(vsCorte(87, 84)).toBe(3);
  });
  it('segmento: todos acima, todos abaixo, misto', () => {
    expect(segmentoCorte([85, 86, 87], 84)).toBe('acima');
    expect(segmentoCorte([70, 72, null, 74], 86)).toBe('abaixo');
    expect(segmentoCorte([78, 83, 80], 82)).toBe('variacao');
  });
  it('segmento sem meta ou com 1 ponto é sem histórico', () => {
    expect(segmentoCorte([80, 81], null)).toBe('sem_historico');
    expect(segmentoCorte([null, null, 77], 81)).toBe('sem_historico');
  });
  it('próximo do corte = até 3 p.p. abaixo', () => {
    expect(situacaoCorte(79, 82)).toBe('proximo');
    expect(situacaoCorte(78, 82)).toBe('longe');
  });
});

describe('B2C · alertas', () => {
  it('regressão de 5 p.p.', () => {
    expect(alertasDoAluno({ aluno, dias: 1, serieAcerto: [83, 80, 84, 79] }, true)).toContain('regrediram');
  });
  it('estagnado: variação < 2 nos 3 últimos', () => {
    expect(alertasDoAluno({ aluno, dias: 1, serieAcerto: [70, 73, 73, 74, 74] }, true)).toContain('estagnados');
  });
  it('V0 (sem simulado) só gera alertas de engajamento', () => {
    expect(alertasDoAluno({ aluno, dias: 10, serieAcerto: [] }, false)).toEqual(['esfriando']);
  });
  it('um aluno pode estar em mais de um alerta', () => {
    const a = alertasDoAluno({ aluno, dias: 20, serieAcerto: [64, null, 66, 65, null] }, true);
    expect(a).toEqual(expect.arrayContaining(['sumiram', 'nao_fizeram']));
  });
  it('exige os últimos pontos válidos, sem preencher lacunas', () => {
    expect(alertasDoAluno({ aluno, dias: 1, serieAcerto: [80, null, 74] }, true)).not.toContain('regrediram');
    expect(alertasDoAluno({ aluno, dias: 1, serieAcerto: [70, 71, 72] }, true)).not.toContain('estagnados');
    expect(alertasDoAluno({ aluno, dias: 1, serieAcerto: [70, null, 70] }, true)).not.toContain('estagnados');
  });
  it('remove grupos vazios e mantém a ordem', () => {
    expect(prioridadesB2C([], true)).toEqual([]);
    expect(prioridadesB2C([{ aluno, dias: 20, serieAcerto: [80, 75] }], true).map(p => p.chave)).toEqual(['sumiram', 'regrediram']);
  });
});

describe('B2B · perfis', () => {
  it('virada: 52–59 no último', () => expect(perfilB2B([55, 57, 58, 59])).toBe('virada'));
  it('muito baixo: < 45', () => expect(perfilB2B([44, 42, 47, 44])).toBe('muito_baixo'));
  it('muito baixo: queda de 5+', () => expect(perfilB2B([66, 61])).toBe('muito_baixo'));
  it('muito bom: 70+ nos 2 últimos', () => expect(perfilB2B([70, 72, 74, 75])).toBe('muito_bom'));
  it('sem resultado não tem perfil', () => expect(perfilB2B([null, null])).toBeNull());
  it('respeita limites e não usa histórico antigo no lugar dos últimos simulados', () => {
    expect(perfilB2B([45])).toBeNull();
    expect(perfilB2B([51])).toBeNull();
    expect(perfilB2B([52])).toBe('virada');
    expect(perfilB2B([60])).toBeNull();
    expect(perfilB2B([70])).toBeNull();
    expect(perfilB2B([70, null, 71])).toBeNull();
    expect(perfilB2B([55, null])).toBeNull();
  });
  it('virada vem primeiro e grupos vazios não aparecem', () => {
    expect(prioridadesB2B([])).toEqual([]);
    expect(prioridadesB2B([{ id: 'a', serieProf: [55], dias: 15 }]).map(p => p.chave)).toEqual(['virada', 'sem_acesso']);
  });
});

const tema = (p: Partial<TemaTurma>): TemaTurma => ({
  id: 'x', tema: 'x', especialidade: 'x', grandeArea: 'Preventiva', prevalencia: 'alta',
  acertoPct: 40, respostas: 100, alunosAbaixo50: 10, serie: [], ...p,
});

describe('temas críticos', () => {
  it('B2B exige amostra ≥ 30 e acerto < 50', () => {
    const r = filtrarTemasCriticos([tema({ respostas: 29 }), tema({ acertoPct: 50 }), tema({ id: 'ok' })], 'b2b', null);
    expect(r.map(t => t.id)).toEqual(['ok']);
  });
  it('impacto = peso × (100 − acerto): alta 44% vence média 33%', () => {
    const r = ordenarTemas([tema({ id: 'm', prevalencia: 'media', acertoPct: 33 }), tema({ id: 'a', prevalencia: 'alta', acertoPct: 44 })], 'impacto');
    expect(r[0].id).toBe('a');
  });
  it('não transforma null em zero nem altera a entrada ao ordenar', () => {
    expect(impactoTema(tema({ acertoPct: null }))).toBeNull();
    const temas = [tema({ id: 'n', acertoPct: null }), tema({ id: 'b', acertoPct: 80, respostas: 30 }), tema({ id: 'a', acertoPct: 0 })];
    expect(filtrarTemasCriticos(temas, 'b2b', null).map(t => t.id)).toEqual(['a']);
    expect(filtrarTemasCriticos(temas, 'b2c', 'Preventiva').map(t => t.id)).toEqual(['n', 'b', 'a']);
    expect(ordenarTemas(temas, 'acerto').map(t => t.id)).toEqual(['a', 'b', 'n']);
    expect(temas[0].id).toBe('n');
    expect(FATIA_PROVA).toEqual({ alta: 62, media: 28, baixa: 10 });
  });
});

describe('matriz', () => {
  it('B2C 78/66 · Gestor 80/50', () => {
    expect(tomCelula(77, 'b2c')).toBe('medio');
    expect(tomCelula(65, 'b2c')).toBe('ruim');
    expect(tomCelula(65, 'gestor')).toBe('medio');
    expect(tomCelula(null, 'gestor')).toBeNull();
    expect(tomCelula(78, 'b2c')).toBe('bom');
    expect(tomCelula(66, 'b2c')).toBe('medio');
    expect(tomCelula(80, 'gestor')).toBe('bom');
    expect(tomCelula(50, 'gestor')).toBe('medio');
  });
});

describe('sessões', () => {
  const base: Sessao = { id: 's', tipo: 'oficina', data: '2026-11-19', hora: '20:00', tema: null, alunoId: null, link: null, status: 'agendada', gravacaoUrl: null, pauta: [] };
  it('oficina sem link e sem pauta', () => expect(statusSessao(base)).toBe('falta_link_e_pauta'));
  it('individual nunca falta link (usa a agenda do mentor)', () => expect(statusSessao({ ...base, tipo: 'individual' })).toBe('agendada'));
  it('item na pauta resolve a pendência', () =>
    expect(statusSessao({ ...base, link: 'meet', pauta: [{ id: 'p', origem: 'tema_critico', referenciaId: 't', texto: 'x' }] })).toBe('agendada'));
  it('conta coletivas por mês e ordena sem mutar', () => {
    const sessoes = [base, { ...base, id: 'i', tipo: 'individual' as const }, { ...base, id: 'r', status: 'realizada' as const }];
    expect(coletivasNoMes(sessoes, '2026-11-01')).toBe(2);
    expect(ordenarSessoes(sessoes, 'realizadas').map(s => s.id)).toEqual(['r']);
    expect(sessoes[0]).toBe(base);
    expect(statusSessao({ ...base, status: 'realizada' })).toBe('realizada');
  });
});

it.each([[11, 'Bom dia'], [12, 'Boa tarde'], [17, 'Boa tarde'], [18, 'Boa noite']] as const)('saudação às %s', (h, esperado) => {
  expect(saudacao(new Date(2026, 10, 4, h))).toBe(esperado);
});
