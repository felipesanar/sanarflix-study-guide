import { describe, expect, it } from 'vitest';
import {
  alertasB2c, diaMes, diaSemanaCurto, horaCurta, indicadoresB2b, indicadoresB2c, indicadoresV0, iniciaisDe,
  itensRotina, prioridadesB2bInicio, quemDoCard, sessoesInicio, textoComparacao, temSimuladoFechado,
} from '@/features/mentor/components/inicio/dadosInicio';
import type {
  AlunoB2b, AlunoTurmaAcademy, DesempenhoAlunoB2c, DesempenhoTurmaB2c, EngajamentoAluno, Intervencao,
  ItemRotinaAcademy, PontoSerieTurma, Sessao, VisaoGeralB2b,
} from '@/features/mentor/api/types';

function aluno(email: string, dias: number | null, extra: Partial<AlunoTurmaAcademy> = {}): AlunoTurmaAcademy {
  return {
    email, nome: email.split('@')[0], telefone: null, semestre: null, acessoAte: null, b2b: false, academyUserId: null,
    sanarflixUserId: null, ultimaAtividade: null, diasSemAtividade: dias, segmento: 'ativo', meta: null,
    conteudos7d: { videos: null, documentos: null, total: null }, conteudos30d: { videos: null, documentos: null, total: null },
    temDadoConsumo: false, questoes7d: { respondidas: null, acertos: null, erros: null, pctAcerto: null },
    questoes30d: { respondidas: null, acertos: null, erros: null, pctAcerto: null }, temDadoQuestoes: false, ...extra,
  };
}
function desemp(email: string, p: Partial<DesempenhoAlunoB2c>): DesempenhoAlunoB2c {
  return { email, nome: null, notas: [], ultimoAcerto: null, corteMaisDificil: null, vsCortePp: null, situacao: 'sem_meta', regrediu: false, estagnado: false, fezUltimo: true, ...p };
}
const SIMS = [
  { id: 's4', ordem: 4, nome: '4º Simulado PRO', data: '2026-08-24', status: 'realizado' as const, participantes: null },
  { id: 's5', ordem: 5, nome: '5º Simulado PRO', data: '2026-09-22T02:00:00.000Z', status: 'realizado' as const, participantes: null },
];
function desempenho(p: Partial<DesempenhoTurmaB2c> = {}): DesempenhoTurmaB2c {
  return { alunos: [], possivelAprovacaoPct: 34, acertoMedioUltimo: 79, simulados: SIMS, participacaoUltimo: { simuladoId: 's5', fizeram: 62, total: 87 }, ...p };
}
const serie: PontoSerieTurma[] = [
  { simuladoId: 's4', ordem: 4, titulo: '4º', fechado: true, participantes: 71, acertoMedio: 77, acimaCortePct: 28 },
  { simuladoId: 's5', ordem: 5, titulo: '5º', fechado: true, participantes: 62, acertoMedio: 79, acimaCortePct: 34 },
];

describe('formatação', () => {
  it('comparação: sinal, p.p., igual e menos tipográfico; null não gera linha', () => {
    expect(textoComparacao(6, ' p.p.', '4º simulado')).toEqual({ texto: '+6 p.p. vs 4º simulado', tom: 'positivo' });
    expect(textoComparacao(-9, '', 'semana anterior', 'igual à semana anterior')).toEqual({ texto: '−9 vs semana anterior', tom: 'negativo' });
    expect(textoComparacao(0, '', '3º simulado')).toEqual({ texto: 'igual ao 3º simulado', tom: 'neutro' });
    expect(textoComparacao(null, '', '3º simulado')).toBeNull();
  });
  it('hora, dia da semana, dia/mês no fuso de São Paulo', () => {
    expect(horaCurta('19:00')).toBe('19h');
    expect(horaCurta('18:30')).toBe('18h30');
    expect(diaSemanaCurto('2026-10-16')).toBe('Sex');
    expect(diaMes('2026-08-24')).toBe('24/08');
    expect(diaMes('2026-09-22T02:00:00.000Z')).toBe('21/09');
    expect(diaMes(null)).toBeNull();
  });
  it('iniciais do primeiro e do último nome', () => {
    expect(iniciaisDe('Renata Bastos Albuquerque de Melo', 'x@y')).toBe('RM');
    expect(iniciaisDe(null, 'joao@x.com')).toBe('JO');
  });
});

describe('Início B2C', () => {
  it('detecta simulado fechado pela participação do último', () => {
    expect(temSimuladoFechado(desempenho())).toBe(true);
    expect(temSimuladoFechado(desempenho({ participacaoUltimo: { simuladoId: null, fizeram: 0, total: 87 } }))).toBe(false);
    expect(temSimuladoFechado(undefined)).toBe(false);
  });

  it('indicadores com simulado: referência, deltas e participação', () => {
    const r = indicadoresB2c(desempenho(), serie);
    expect(r.referencia).toBe('5º Simulado PRO · 21/09');
    expect(r.simuladoId).toBe('s5');
    expect(r.itens.map((i) => [i.rotulo, i.valor, i.sufixo ?? null, i.comparacao?.texto ?? null])).toEqual([
      ['Acima do corte', '34%', null, '+6 p.p. vs 4º simulado'],
      ['Acerto médio', '79%', null, '+2 p.p. vs 4º simulado'],
      ['Participação', '62', '/ 87', '25 não fizeram'],
    ]);
  });

  it('null vira — e o delta some sem 2 pontos válidos', () => {
    const r = indicadoresB2c(desempenho({ possivelAprovacaoPct: null }), [{ ...serie[0], acertoMedio: null }, serie[1]]);
    expect(r.itens[0]).toMatchObject({ valor: '—', comparacao: null });
    expect(r.itens[1].comparacao).toBeNull();
    expect(indicadoresB2c(desempenho(), undefined).itens[0].comparacao).toBeNull();
  });

  it('alertas com simulado usam as flags do servidor e o corte de 15 dias; nunca acessou conta como sumido', () => {
    const turma = [aluno('a@x', 20), aluno('b@x', null), aluno('c@x', 10), aluno('d@x', 1)];
    const d = desempenho({ alunos: [desemp('a@x', { regrediu: true }), desemp('c@x', { estagnado: true, fezUltimo: false }), desemp('d@x', {})] });
    const itens = alertasB2c(turma, d, true);
    expect(itens.map((i) => [i.chave, i.titulo, i.criterio, i.prioridade, i.alunoIds])).toEqual([
      ['sumiram', 'Sumiram', 'Sem acesso há 15 dias ou mais', 'alta', ['b@x', 'a@x']],
      ['regrediram', 'Regrediram', 'Caíram 5 p.p. ou mais de acerto entre os 2 últimos simulados', 'alta', ['a@x']],
      ['estagnados', 'Estagnados', 'Variação menor que 2 p.p. nos 3 últimos simulados', 'media', ['c@x']],
      ['nao_fizeram', 'Não fizeram o 5º simulado', 'Simulado fechou em 21/09', 'media', ['c@x']],
    ]);
  });

  it('V0 (sem simulado): só Sumiram e Esfriando', () => {
    const itens = alertasB2c([aluno('a@x', 20), aluno('c@x', 10), aluno('d@x', 1)], undefined, false);
    expect(itens.map((i) => [i.chave, i.criterio, i.prioridade, i.alunoIds])).toEqual([
      ['sumiram', 'Sem acesso há 15 dias ou mais', 'alta', ['a@x']],
      ['esfriando', 'Sem acesso entre 8 e 14 dias', 'media', ['c@x']],
    ]);
  });

  it('V0: ativos na semana, questões por aluno ativo e sem acesso 15+', () => {
    const q = (n: number | null) => ({ respondidas: n, acertos: null, erros: null, pctAcerto: null });
    const turma = [
      aluno('a@x', 1, { questoes7d: q(100), temDadoQuestoes: true }), aluno('b@x', 3, { questoes7d: q(200), temDadoQuestoes: true }),
      aluno('c@x', 20), aluno('d@x', null),
    ];
    const sem = (questoes: number | null, conteudos: number | null) => ({ semana: '2026-10-05', questoes, acertos: null, conteudos });
    const eng: EngajamentoAluno[] = [
      { email: 'a@x', ultimaAtividade: null, diasSemAtividade: 1, segmento: 'ativo', semanas: [sem(160, 0), sem(10, 0)] },
      { email: 'b@x', ultimaAtividade: null, diasSemAtividade: 3, segmento: 'ativo', semanas: [sem(160, 0), sem(5, 0)] },
      { email: 'c@x', ultimaAtividade: null, diasSemAtividade: 20, segmento: 'sumido', semanas: [sem(0, 0), sem(0, 0)] },
      { email: 'd@x', ultimaAtividade: null, diasSemAtividade: null, segmento: 'sem_dado', semanas: [] },
    ];
    const r = indicadoresV0(turma, eng);
    expect(r.itens.map((i) => [i.rotulo, i.valor, i.sufixo ?? null, i.comparacao?.texto ?? null, i.destaque ?? null])).toEqual([
      ['Ativos na semana', '2', '/ 4', 'igual à semana anterior', null],
      ['Questões por aluno ativo', '150', null, '−10 vs semana anterior', null],
      ['Sem acesso há 15+ dias', '2', 'alunos', 'mesmo corte do alerta', 'perigo'],
    ]);
  });

  it('V0 sem dado de questões mostra — sem delta', () => {
    const r = indicadoresV0([aluno('a@x', 1)], undefined);
    expect(r.itens[1]).toMatchObject({ valor: '—', comparacao: null });
    expect(r.itens[0].comparacao).toBeNull();
  });
});

describe('Início B2B', () => {
  const visao: VisaoGeralB2b = {
    simulados: [{ id: 'b4', ordem: 4, nome: '4º Simulado ENAMED', data: '2026-10-01', status: 'realizado', participantes: 171 }],
    simuladoReferenciaId: 'b4',
    conceitoEnamed: { valor: 3, delta: 1, serie: [{ rotulo: '2º', valor: 3 }, { rotulo: '3º', valor: 3 }, { rotulo: '4º', valor: 3 }] },
    triProjetado: { valor: 58.4, delta: 4.3, serie: [{ rotulo: '3º', valor: 57.2 }, { rotulo: '4º', valor: 58.4 }] },
    proficientesPct: { valor: 52, delta: null, serie: [] },
    proficientes: 89, participantes: 171, totalAlunos: 186, acertoPct: 61.8, simuladosRealizados: 4, simuladosContratados: 6,
  };
  it('indicadores comparam com o simulado anterior; conceito e TRI marcados como projetados', () => {
    const r = indicadoresB2b(visao);
    expect(r.referencia).toBe('4º simulado · 01/10');
    expect(r.itens.map((i) => [i.rotulo, i.valor, i.sufixo ?? null, i.comparacao?.texto ?? null, !!i.projetado])).toEqual([
      ['Conceito ENAMED previsto', '3', '/ 5', 'igual ao 3º simulado', true],
      ['TRI projetado', '58,4', '/ 100', '+1,2 vs 3º simulado', true],
      ['Alunos proficientes', '52%', null, '89 de 171 participantes', false],
    ]);
  });
  it('sem série suficiente o delta some e null vira —', () => {
    const r = indicadoresB2b({ ...visao, triProjetado: { valor: null, delta: null, serie: [{ rotulo: '4º', valor: null }] }, proficientes: null });
    expect(r.itens[1]).toMatchObject({ valor: '—', comparacao: null });
    expect(r.itens[2].comparacao).toBeNull();
  });
  it('prioridades: perfil do servidor + sem acesso recente', () => {
    const a = (email: string, perfil: AlunoB2b['perfil'], dias: number | null): AlunoB2b => ({
      email, nome: email, semestre: 10, telefone: null, proficiencias: [], acertoUltimoPct: null, ultimaAtividade: null, diasSemAtividade: dias, perfil, grupo: null, sinalizadoEm: null,
    });
    const itens = prioridadesB2bInicio([a('v@x', 'virada', 1), a('b@x', 'muito_baixo', 19), a('o@x', 'muito_bom', 0), a('n@x', null, 2)]);
    expect(itens.map((i) => [i.chave, i.titulo, i.criterio, i.prioridade, i.alunoIds])).toEqual([
      ['virada', 'Potencial de virada', 'Proficiência 52–59 no último simulado', 'alta', ['v@x']],
      ['muito_baixo', 'Desempenho muito baixo', 'Proficiência abaixo de 45 ou queda de 5+', 'alta', ['b@x']],
      ['sem_acesso', 'Sem acesso recente', 'Sem acesso há 15+ dias', 'media', ['b@x']],
      ['muito_bom', 'Desempenho muito bom', 'Proficiência 70+ nos 2 últimos', 'baixa', ['o@x']],
    ]);
  });
  it('rotina: enviado, marcar no dia (e atrasado) e futuro', () => {
    const it = (dia: ItemRotinaAcademy['dia'], tipo: ItemRotinaAcademy['tipo'], enviadoEm: string | null): ItemRotinaAcademy => ({ id: dia, semana: '2026-10-12', dia, tipo, conteudo: '', enviadoEm });
    const r = itensRotina([it('sex', 'perola', null), it('ter', 'enquete', '2026-10-13T15:00:00Z'), it('qui', 'resposta', null)], '2026-10-15');
    expect(r.map((x) => [x.dia, x.rotulo, x.estado, x.textoEstado])).toEqual([
      ['Ter 13/10', 'Enquete / desafio de imagem', 'enviado', 'Enviado'],
      ['Qui 15/10', 'Resposta + comentário do mentor', 'marcar', null],
      ['Sex 16/10', 'Pérola de conhecimento', 'futuro', 'Amanhã'],
    ]);
    expect(itensRotina([it('sex', 'perola', null)], '2026-10-13')[0].textoEstado).toBe('Em 3 dias');
  });
});

describe('sessões e cards', () => {
  const s = (id: string, data: string, tipo: Sessao['tipo'], extra: Partial<Sessao> = {}): Sessao => ({
    id, tipo, data, hora: '19:00', tema: 'Tema', alunoId: null, link: null, status: 'agendada', gravacaoUrl: null, pauta: [], ...extra,
  });
  it('B2C destaca o próximo encontro e lista até 2 das demais', () => {
    const r = sessoesInicio([s('i1', '2026-10-19', 'individual'), s('e2', '2026-11-12', 'encontro_tribo'), s('e1', '2026-10-16', 'encontro_tribo'), s('i2', '2026-10-20', 'individual'), s('r', '2026-10-01', 'encontro_tribo', { status: 'realizada' })], 'b2c');
    expect(r.destaque?.id).toBe('e1');
    expect(r.demais.map((x) => x.id)).toEqual(['i1', 'i2']);
  });
  it('B2B destaca a primeira em ordem cronológica e lista as 2 seguintes', () => {
    const r = sessoesInicio([s('b', '2026-10-22', 'oficina'), s('a', '2026-10-20', 'individual'), s('c', '2026-11-05', 'pos_simulado'), s('d', '2026-11-19', 'oficina')], 'b2b');
    expect([r.destaque?.id, ...r.demais.map((x) => x.id)]).toEqual(['a', 'b', 'c']);
    expect(sessoesInicio([], 'b2b')).toEqual({ destaque: null, demais: [] });
  });
  it('quem do card', () => {
    const c = (destino: Intervencao['destino']) => ({ destino }) as Intervencao;
    const nomes = new Map([['a@x', 'Caio Menezes']]);
    expect(quemDoCard(c({ turmaToda: true, alunoIds: ['a@x', 'b@x'] }), nomes)).toBe('Turma toda');
    expect(quemDoCard(c({ alunoIds: ['a@x'] }), nomes)).toBe('Caio Menezes');
    expect(quemDoCard(c({ alunoIds: ['a@x', 'b@x', 'c@x'] }), nomes)).toBe('3 alunos');
    expect(quemDoCard(c({ grupo: 'Sumiram', alunoIds: ['a@x', 'b@x'] }), nomes)).toBe('Sumiram · 2 alunos');
    expect(quemDoCard(c({}), nomes)).toBe('—');
  });
});
