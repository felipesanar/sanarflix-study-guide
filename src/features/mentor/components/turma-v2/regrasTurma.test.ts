import { describe, expect, it } from 'vitest';
import type { AlunoTurmaAcademy, DesempenhoTurmaB2c, EngajamentoAluno, TemaTurmaMentor } from '../../api/types';
import {
  ativosNaSemana, contarSegmentos, ehAlerta, filtrarLinhas, formatMesAno, formatNotas, formatPp, formatUltimoAcesso,
  matrizPrevalencia, mediaQuestoesAtivos, montarTurma, questoesPorAtivoNaSemana, regua3, rotuloAlerta, temasDoDetalhamento,
} from './regrasTurma';

function aluno(p: Partial<AlunoTurmaAcademy> & { email: string }): AlunoTurmaAcademy {
  const vazio = { videos: null, documentos: null, total: null };
  const q = { respondidas: null, acertos: null, erros: null, pctAcerto: null };
  return {
    nome: p.email.toUpperCase(), telefone: null, semestre: null, acessoAte: '2026-12-31', b2b: false, academyUserId: null,
    sanarflixUserId: null, ultimaAtividade: null, diasSemAtividade: 1, segmento: 'ativo', meta: null,
    conteudos7d: vazio, conteudos30d: vazio, temDadoConsumo: false, questoes7d: q, questoes30d: q, temDadoQuestoes: false, ...p,
  };
}
const SIMS = [1, 2, 3].map((o) => ({ id: `s${o}`, ordem: o, nome: `${o}º Simulado PRO`, data: `2026-0${o}-21`, status: 'realizado' as const, participantes: null }));
function desempenho(alunos: DesempenhoTurmaB2c['alunos'], extra: Partial<DesempenhoTurmaB2c> = {}): DesempenhoTurmaB2c {
  return { alunos, possivelAprovacaoPct: null, acertoMedioUltimo: null, simulados: SIMS, participacaoUltimo: { simuladoId: 's3', fizeram: 0, total: 0 }, ...extra };
}
function dAluno(email: string, notas: (number | null)[], p: Partial<DesempenhoTurmaB2c['alunos'][number]> = {}) {
  return {
    email, nome: null, notas: notas.map((v, i) => ({ simuladoId: `s${i + 1}`, ordem: i + 1, acertoPct: v, finalizadaEm: null })),
    ultimoAcerto: null, corteMaisDificil: 80, vsCortePp: null, situacao: 'acima' as const, regrediu: false, estagnado: false,
    fezUltimo: notas[notas.length - 1] != null, ...p,
  };
}

describe('montarTurma', () => {
  it('cruza turma e desempenho pelo e-mail, com uma nota por simulado realizado e null quando não fez', () => {
    const t = montarTurma(
      [aluno({ email: 'Ana@X.com', meta: { especialidade: 'Derm', instituicao: 'USP', cortePct: 80 } })],
      desempenho([dAluno('ana@x.com', [82, null, 85], { vsCortePp: 5 })]),
    );
    expect(t.v0).toBe(false);
    expect(t.ultimo?.id).toBe('s3');
    expect(t.linhas[0].notas).toEqual([82, null, 85]);
    expect(t.linhas[0].segmentoCorte).toBe('acima');
    expect(t.linhas[0].vsCortePp).toBe(5);
  });

  it('sem simulado realizado é V0; aluno sem desempenho não ganha nota nem segmento inventado', () => {
    const t = montarTurma([aluno({ email: 'a' })], desempenho([], { simulados: [], participacaoUltimo: { simuladoId: null, fizeram: 0, total: 1 } }));
    expect(t.v0).toBe(true);
    expect(t.linhas[0].notas).toEqual([]);
    expect(t.linhas[0].segmentoCorte).toBe('sem_historico');
  });

  it('alertas: sumiram/esfriando pelo engajamento; regrediram, estagnados e não fizeram pelo desempenho', () => {
    const t = montarTurma(
      [aluno({ email: 'a', segmento: 'sumido', diasSemAtividade: 20 }), aluno({ email: 'b', segmento: 'esfriando' }), aluno({ email: 'c' })],
      desempenho([dAluno('a', [70, 71, null], { estagnado: true }), dAluno('b', [80, 70, 60], { regrediu: true }), dAluno('c', [80, 80, 80], { fezUltimo: null })]),
    );
    expect(t.linhas.map((l) => l.alertas)).toEqual([['sumiram', 'estagnados', 'nao_fizeram'], ['esfriando', 'regrediram'], []]);
  });

  it('quem não fez o último fica "não fez" mesmo com vs corte de um simulado anterior', () => {
    const t = montarTurma([aluno({ email: 'a' })], desempenho([dAluno('a', [90, null, null], { vsCortePp: 10 })]));
    expect(t.linhas[0].vsCortePp).toBeNull();
    expect(t.linhas[0].fezUltimo).toBe(false);
  });
});

describe('filtros e contagens', () => {
  const t = montarTurma(
    [aluno({ email: 'ana', nome: 'Ána Souza', segmento: 'sumido' }), aluno({ email: 'bia', nome: 'Bia Lima' }), aluno({ email: 'caio', nome: 'Caio' })],
    desempenho([dAluno('ana', [70, 70, 70]), dAluno('bia', [85, 70, 90]), dAluno('caio', [null, null, 81])]),
  );
  it('alerta, segmento e busca (sem acento, sem caixa) se combinam', () => {
    expect(filtrarLinhas(t.linhas, { alerta: 'sumiram', segmento: null, busca: '', v0: false }).map((l) => l.email)).toEqual(['ana']);
    expect(filtrarLinhas(t.linhas, { alerta: null, segmento: 'variacao', busca: '', v0: false }).map((l) => l.email)).toEqual(['bia']);
    expect(filtrarLinhas(t.linhas, { alerta: null, segmento: null, busca: 'ana s', v0: false }).map((l) => l.email)).toEqual(['ana']);
    expect(filtrarLinhas(t.linhas, { alerta: 'sumiram', segmento: 'variacao', busca: '', v0: false })).toEqual([]);
  });
  it('V0 filtra pelo engajamento', () => {
    expect(filtrarLinhas(t.linhas, { alerta: null, segmento: 'sumido', busca: '', v0: true }).map((l) => l.email)).toEqual(['ana']);
  });
  it('conta segmentos sobre a turma toda', () => {
    expect(contarSegmentos(t.linhas, false)).toEqual({ todos: 3, acima: 0, variacao: 1, abaixo: 1, sem_historico: 1 });
    expect(contarSegmentos(t.linhas, true)).toEqual({ todos: 3, ativo: 2, esfriando: 0, sumido: 1 });
  });
  it('só aceita chaves de alerta conhecidas', () => {
    expect(ehAlerta('sumiram')).toBe(true);
    expect(ehAlerta('qualquer')).toBe(false);
    expect(rotuloAlerta('nao_fizeram', 5)).toBe('Não fizeram o 5º simulado');
  });
});

describe('régua e indicadores', () => {
  it('régua só com 2 pontos válidos; com 3+ usa 1º, anterior e atual', () => {
    expect(regua3([{ rotulo: 'a', valor: null }, { rotulo: 'b', valor: 10 }])).toEqual([]);
    expect(regua3([{ rotulo: 'a', valor: 10 }, { rotulo: 'b', valor: 12 }]).map((p) => p.rotulo)).toEqual(['Anterior', 'Atual']);
    expect(regua3([10, null, 20, 30, 40].map((valor, i) => ({ rotulo: String(i), valor }))))
      .toEqual([{ rotulo: '1º', valor: 10 }, { rotulo: 'Anterior', valor: 30 }, { rotulo: 'Atual', valor: 40 }]);
  });
  it('questões por aluno ativo ignora quem não tem fonte e devolve null sem ativo', () => {
    const q = (n: number | null) => ({ respondidas: n, acertos: null, erros: null, pctAcerto: null });
    const al = (p: Parameters<typeof aluno>[0]) => aluno({ temDadoQuestoes: true, ...p });
    expect(mediaQuestoesAtivos([al({ email: 'a', questoes7d: q(100) }), al({ email: 'b', questoes7d: q(null) }), al({ email: 'c', questoes7d: q(51) }), aluno({ email: 'd', questoes7d: q(999) })])).toBe(76);
    expect(mediaQuestoesAtivos([al({ email: 'a', segmento: 'sumido', questoes7d: q(9) })])).toBeNull();
  });
  it('semana anterior: ativo = teve questão ou conteúdo; aluno sem atividade conta como inativo', () => {
    const eng: EngajamentoAluno[] = [
      { email: 'a', ultimaAtividade: null, diasSemAtividade: 1, segmento: 'ativo', semanas: [{ semana: 'w1', questoes: 40, acertos: null, conteudos: 0 }, { semana: 'w2', questoes: 0, acertos: null, conteudos: 0 }] },
      { email: 'b', ultimaAtividade: null, diasSemAtividade: 1, segmento: 'ativo', semanas: [{ semana: 'w1', questoes: 0, acertos: null, conteudos: 3 }, { semana: 'w2', questoes: 10, acertos: null, conteudos: null }] },
      { email: 'c', ultimaAtividade: null, diasSemAtividade: null, segmento: 'sem_dado', semanas: [] },
    ];
    expect(ativosNaSemana(eng, 0)).toBe(2);
    expect(ativosNaSemana(eng, 1)).toBe(1);
    expect(questoesPorAtivoNaSemana(eng, 0)).toBe(20);
    expect(ativosNaSemana([], 0)).toBeNull();
  });
});

describe('matriz por prevalência', () => {
  const tema = (grandeArea: string, prevalencia: TemaTurmaMentor['prevalencia'], acertoPct: number | null, respostas: number, tema = 't', especialidade: string | null = null): TemaTurmaMentor => ({
    id: `${grandeArea}-${tema}`, tema, especialidade, grandeArea, prevalencia, peso: null, respostas, acertoPct, alunosAbaixo50: [], critico: respostas >= 30, serie: [],
  });
  it('média ponderada pelas respostas; null fica fora; célula sem tema é null', () => {
    const m = matrizPrevalencia([tema('Cirurgia', 'alta', 80, 30), tema('Cirurgia', 'alta', 50, 10), tema('Cirurgia', 'baixa', null, 20), tema('Cirurgia', 'media', 60, 40)]);
    expect(m.temPrevalencia).toBe(true);
    expect(m.linhas).toEqual([{ area: 'Cirurgia', alta: 72.5, media: 60, baixa: null, geral: 66.3 }]);
  });
  it('sem prevalência cadastrada avisa em vez de inventar', () => {
    expect(matrizPrevalencia([tema('Cirurgia', null, 80, 30)]).temPrevalencia).toBe(false);
  });
  it('ordem das grandes áreas segue a prova', () => {
    expect(matrizPrevalencia([tema('Saúde Mental', 'alta', 1, 1), tema('Zeta', 'alta', 1, 1), tema('Clínica Médica', 'alta', 1, 1)]).linhas.map((l) => l.area))
      .toEqual(['Clínica Médica', 'Saúde Mental', 'Zeta']);
  });
  it('recorte por segmento herda a prevalência do tema da turma', () => {
    const lista = temasDoDetalhamento(
      [{ grandeArea: 'Cirurgia', acertoPct: 70, respostas: 10, temas: [], especialidades: [{ especialidade: 'Trauma', acertoPct: 70, respostas: 10, temas: [{ tema: 'Via aérea', acertoPct: 70, respostas: 10 }, { tema: 'Outro', acertoPct: 50, respostas: 5 }] }] }],
      [tema('Cirurgia', 'alta', 60, 99, 'Via  Aérea', 'Trauma')],
    );
    expect(lista).toEqual([
      { grandeArea: 'Cirurgia', prevalencia: 'alta', acertoPct: 70, respostas: 10 },
      { grandeArea: 'Cirurgia', prevalencia: null, acertoPct: 50, respostas: 5 },
    ]);
  });
});

describe('formatadores', () => {
  it('p.p. com sinal tipográfico, zero sem sinal e null como traço', () => {
    expect([formatPp(3), formatPp(-8), formatPp(0), formatPp(null)]).toEqual(['+3 p.p.', '−8 p.p.', '0 p.p.', '—']);
  });
  it('último acesso, mês/ano e notas', () => {
    expect([0, 1, 17, null].map(formatUltimoAcesso)).toEqual(['hoje', 'ontem', 'há 17 dias', '—']);
    expect([formatMesAno('2026-12-31'), formatMesAno(null)]).toEqual(['dez/26', '—']);
    expect(formatNotas([81, null, 87])).toEqual({ anteriores: '81% · – ·', ultima: '87%' });
    expect(formatNotas([null])).toEqual({ anteriores: '', ultima: '–' });
  });
});
