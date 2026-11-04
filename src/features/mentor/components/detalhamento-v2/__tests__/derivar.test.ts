import { describe, expect, it } from 'vitest';
import type { AlunoB2b, DesempenhoTurmaB2c, PontoSerieTurma, QuestaoMentor, QuestaoResumoMentor, SimuladoMentor } from '@/features/mentor/api/types';
import {
  alternativasDeQuestao,
  alternativasDeResumo,
  alunosVisaoB2b,
  alunosVisaoB2c,
  escreverParamSimulados,
  itensSeletor,
  kpisB2c,
  lerParamSimulados,
  matrizPrevalencia,
  questoesDoRecorte,
  rotuloRecorte,
  rotuloUltimoAcesso,
  selecaoPadrao,
  simuladosDoRecorte,
} from '../derivar';

const sim = (ordem: number, status: SimuladoMentor['status'] = 'realizado', participantes: number | null = null): SimuladoMentor => ({
  id: `s${ordem}`, ordem, nome: `${ordem}º Simulado PRO`, data: `2026-0${ordem}-10T12:00:00Z`, status, participantes,
});
const SIMS = [sim(1), sim(2), sim(3), sim(4), sim(5), sim(6, 'agendado')];

describe('seleção de simulados', () => {
  it('padrão = os 2 mais recentes disponíveis, em ordem cronológica', () => {
    expect(selecaoPadrao(SIMS)).toEqual(['s4', 's5']);
    expect(selecaoPadrao([sim(1), sim(2, 'previsto')])).toEqual(['s1']);
    expect(selecaoPadrao([])).toEqual([]);
  });

  it('?s= ausente usa o padrão; vazio é seleção vazia; aceita ordem ou id; ignora indisponível e lixo', () => {
    expect(lerParamSimulados(null, SIMS)).toEqual(['s4', 's5']);
    expect(lerParamSimulados('', SIMS)).toEqual([]);
    expect(lerParamSimulados('5,3', SIMS)).toEqual(['s3', 's5']);
    expect(lerParamSimulados('s2,4,4,x,6', SIMS)).toEqual(['s2', 's4']);
  });

  it('escreve a seleção como ordens (deep link legível)', () => {
    expect(escreverParamSimulados(['s5', 's4'], SIMS)).toBe('4,5');
    expect(escreverParamSimulados([], SIMS)).toBe('');
  });

  it('rótulo do recorte', () => {
    expect(rotuloRecorte(simuladosDoRecorte(['s4', 's5'], SIMS))).toBe('4º e 5º');
    expect(rotuloRecorte(simuladosDoRecorte(['s3', 's4', 's5'], SIMS))).toBe('3º, 4º e 5º');
    expect(rotuloRecorte(simuladosDoRecorte(['s5'], SIMS))).toBe('5º');
  });

  it('itens do seletor: indisponíveis com o motivo do protótipo e status de processamento mapeado', () => {
    const itens = itensSeletor([sim(5, 'realizado', 62), sim(6, 'agendado'), sim(7, 'previsto'), sim(8, 'processando')]);
    expect(itens.map((i) => [i.status, i.indisponivelPorque ?? null, i.participantes])).toEqual([
      ['realizado', null, 62],
      ['agendado', 'Ainda não realizado', null],
      ['previsto', 'Previsto, sem data', null],
      ['processing', 'Em processamento', null],
    ]);
  });
});

describe('matriz por prevalência', () => {
  it('pondera por respostas, tira null da média e mantém a ordem das áreas', () => {
    const m = matrizPrevalencia([
      { grandeArea: 'Preventiva', prevalencia: 'alta', acertoPct: 40, respostas: 100 },
      { grandeArea: 'Preventiva', prevalencia: 'alta', acertoPct: 70, respostas: 50 },
      { grandeArea: 'Preventiva', prevalencia: 'media', acertoPct: null, respostas: 30 },
      { grandeArea: 'Cirurgia', prevalencia: 'baixa', acertoPct: 80, respostas: 20 },
      { grandeArea: 'Cirurgia', prevalencia: null, acertoPct: 10, respostas: 999 },
    ], ['Cirurgia', 'Preventiva']);
    expect(m.temPrevalencia).toBe(true);
    expect(m.linhas.map((l) => l.area)).toEqual(['Cirurgia', 'Preventiva']);
    expect(m.linhas[1].celulas).toEqual({ alta: 50, media: null, baixa: null });
    expect(m.linhas[0].celulas).toEqual({ alta: null, media: null, baixa: 80 });
    expect(m.colunas).toEqual({ alta: 50, media: null, baixa: 80 });
  });

  it('sem nenhuma prevalência cadastrada: temPrevalencia=false (estado próprio)', () => {
    const m = matrizPrevalencia([{ grandeArea: 'Preventiva', prevalencia: null, acertoPct: 50, respostas: 10 }], ['Preventiva']);
    expect(m.temPrevalencia).toBe(false);
    expect(m.linhas[0].celulas).toEqual({ alta: null, media: null, baixa: null });
  });
});

describe('KPIs B2C', () => {
  const serie: PontoSerieTurma[] = [
    { simuladoId: 's4', ordem: 4, titulo: null, fechado: true, participantes: 71, acertoMedio: 77, acimaCortePct: 28 },
    { simuladoId: 's5', ordem: 5, titulo: null, fechado: true, participantes: 62, acertoMedio: 79, acimaCortePct: 34 },
    { simuladoId: 's3', ordem: 3, titulo: null, fechado: true, participantes: 74, acertoMedio: 76, acimaCortePct: 26 },
  ];
  const desempenho = {
    alunos: [
      { email: 'a@x.com', notas: [{ simuladoId: 's4', ordem: 4, acertoPct: 80, finalizadaEm: null }] },
      { email: 'b@x.com', notas: [] },
    ],
    participacaoUltimo: { simuladoId: 's5', fizeram: 1, total: 87 },
  } as unknown as DesempenhoTurmaB2c;

  it('acerto médio ponderado por participantes, só do recorte; total da turma; rótulos curtos', () => {
    const k = kpisB2c(simuladosDoRecorte(['s4', 's5'], SIMS), serie, desempenho);
    expect(k.acertoMedio).toBeCloseTo((77 * 71 + 79 * 62) / 133, 1);
    expect(k.participantes).toBe(1);
    expect(k.totalTurma).toBe(87);
    expect(k.porSimulado.map((p) => [p.rotulo, p.participacao, p.possivelAprovacaoPct])).toEqual([['4º', 71, 28], ['5º', 62, 34]]);
  });

  it('sem serie: tudo null (nunca zero)', () => {
    const k = kpisB2c(simuladosDoRecorte(['s5'], SIMS), [], undefined);
    expect(k.acertoMedio).toBeNull();
    expect(k.participantes).toBeNull();
    expect(k.porSimulado[0].participacao).toBeNull();
  });
});

describe('visão de alunos', () => {
  it('B2C: calcula no simulado mais recente do recorte, situação pelo corte, sem semestre', () => {
    const desempenho = {
      alunos: [
        { email: 'bea@x.com', nome: 'Beatriz', corteMaisDificil: 84, notas: [{ simuladoId: 's5', ordem: 5, acertoPct: 87, finalizadaEm: null }] },
        { email: 'caio@x.com', nome: 'Caio', corteMaisDificil: 82, notas: [{ simuladoId: 's5', ordem: 5, acertoPct: 79, finalizadaEm: null }] },
        { email: 'rafa@x.com', nome: 'Rafael', corteMaisDificil: 85, notas: [{ simuladoId: 's5', ordem: 5, acertoPct: 77, finalizadaEm: null }] },
        { email: 'sem@x.com', nome: 'Sem Meta', corteMaisDificil: null, notas: [{ simuladoId: 's5', ordem: 5, acertoPct: 70, finalizadaEm: null }] },
        { email: 'nao@x.com', nome: 'Não Fez', corteMaisDificil: 80, notas: [{ simuladoId: 's4', ordem: 4, acertoPct: 70, finalizadaEm: null }] },
      ],
    } as unknown as DesempenhoTurmaB2c;
    const linhas = alunosVisaoB2c(desempenho, [{ email: 'bea@x.com', diasSemAtividade: 0 }, { email: 'caio@x.com', diasSemAtividade: 1 }], 's5');
    const por = Object.fromEntries(linhas.map((l) => [l.id, l]));
    expect(por['bea@x.com']).toMatchObject({ participou: true, acertoPct: 87, corte: 84, situacaoMeta: 'acima', semestre: null, ultimoAcesso: 'hoje', acertos: null });
    expect(por['caio@x.com']).toMatchObject({ situacaoMeta: 'proximo', ultimoAcesso: 'ontem' });
    expect(por['rafa@x.com']).toMatchObject({ situacaoMeta: 'longe', ultimoAcesso: '—' });
    expect(por['sem@x.com']).toMatchObject({ situacaoMeta: 'sem_meta' });
    expect(por['nao@x.com']).toMatchObject({ participou: false, acertoPct: null, situacaoMeta: null });
  });

  it('último acesso legível', () => {
    expect(rotuloUltimoAcesso(0)).toBe('hoje');
    expect(rotuloUltimoAcesso(1)).toBe('ontem');
    expect(rotuloUltimoAcesso(4)).toBe('há 4 dias');
    expect(rotuloUltimoAcesso(null)).toBe('—');
  });

  it('B2B: proficiência do último simulado, limiar 60 e virada 52–59', () => {
    const base = { semestre: 12, telefone: null, ultimaAtividade: null, diasSemAtividade: null, perfil: null, grupo: null, sinalizadoEm: null };
    const alunos: AlunoB2b[] = [
      { ...base, email: 'h@x', nome: 'Heitor', acertoUltimoPct: 81, proficiencias: [{ simuladoId: 's3', ordem: 3, valor: 70 }, { simuladoId: 's4', ordem: 4, valor: 75 }] },
      { ...base, email: 'b@x', nome: 'Bruno', acertoUltimoPct: 64, proficiencias: [{ simuladoId: 's4', ordem: 4, valor: 59 }] },
      { ...base, email: 'g@x', nome: 'Gabriela', acertoUltimoPct: 49, proficiencias: [{ simuladoId: 's4', ordem: 4, valor: 45 }] },
      { ...base, email: 'n@x', nome: 'Nina', acertoUltimoPct: 50, proficiencias: [{ simuladoId: 's3', ordem: 3, valor: 50 }, { simuladoId: 's4', ordem: 4, valor: null }] },
    ];
    const linhas = Object.fromEntries(alunosVisaoB2b(alunos, 's4').map((l) => [l.id, l]));
    expect(linhas['h@x']).toMatchObject({ proficiencia: 75, faixa: 'proficiente', acertoPct: 81, semestre: 12 });
    expect(linhas['b@x']).toMatchObject({ faixa: 'virada' });
    expect(linhas['g@x']).toMatchObject({ faixa: 'abaixo' });
    expect(linhas['n@x']).toMatchObject({ participou: false, proficiencia: null, faixa: null, acertoPct: null });
  });
});

describe('questões', () => {
  const q = (numero: number, ordem: number, acerto: number | null, area = 'Preventiva'): QuestaoResumoMentor => ({
    questaoId: `q${ordem}-${numero}`, numero, ordem, grandeArea: area, especialidade: null, tema: 'T', temaCurto: null, dificuldade: null,
    enunciadoInicio: null, temImagem: false, corretaLabel: 'D', acertoPct: acerto, respostas: 10, distribuicao: {}, emailsPorAlternativa: {},
  });
  const qs = [q(3, 5, 60), q(1, 5, 30), q(2, 5, null), q(1, 4, 10), q(4, 5, 90, 'Cirurgia')];

  it('só o simulado mais recente do recorte, filtro de área e ordenações com null no fim', () => {
    expect(questoesDoRecorte(qs, 5, null, 'prova').map((x) => x.numero)).toEqual([1, 2, 3, 4]);
    expect(questoesDoRecorte(qs, 5, null, 'erradas').map((x) => x.numero)).toEqual([1, 3, 4, 2]);
    expect(questoesDoRecorte(qs, 5, null, 'acertadas').map((x) => x.numero)).toEqual([4, 3, 1, 2]);
    expect(questoesDoRecorte(qs, 5, 'Cirurgia', 'prova').map((x) => x.numero)).toEqual([4]);
  });

  it('alternativas da questão completa: texto limpo, sem prefixo, correta marcada', () => {
    const completa = {
      alternativas: [
        { label: 'A', texto: 'A) <b>Notificar</b> semanalmente', correta: false, n: 9, pct: 9, emails: ['a@x'] },
        { label: 'D', texto: 'D) Notificar em 24h', correta: true, n: 31, pct: 31, emails: null },
      ],
    } as unknown as QuestaoMentor;
    expect(alternativasDeQuestao(completa)).toEqual([
      { letra: 'A', texto: 'Notificar semanalmente', correta: false, marcadaPct: 9 },
      { letra: 'D', texto: 'Notificar em 24h', correta: true, marcadaPct: 31 },
    ]);
  });

  it('alternativas do resumo (B2B): % pela distribuição, branco fora, sem texto', () => {
    const r = { ...q(12, 4, 32), distribuicao: { A: 9, B: 14, C: 45, D: 32, branco: 5 }, corretaLabel: 'D' };
    expect(alternativasDeResumo(r)).toEqual([
      { letra: 'A', texto: '', correta: false, marcadaPct: 9 },
      { letra: 'B', texto: '', correta: false, marcadaPct: 14 },
      { letra: 'C', texto: '', correta: false, marcadaPct: 45 },
      { letra: 'D', texto: '', correta: true, marcadaPct: 32 },
    ]);
  });
});
