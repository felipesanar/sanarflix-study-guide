import { describe, it, expect } from 'vitest';
import {
  contarSegmentosHistorico,
  escolherSimuladosDosCards,
  resumoPorSimulado,
  segmentoHistorico,
  semNotaNoSimulado,
} from '@/features/mentor/components/turma/resumo';
import { contarAlertas, passaAlerta } from '@/features/mentor/components/turma/simulados';
import { desempAluno, desempAlunoNulos, nota, SIM1, SIM2, SIM3 } from '../components/mentor/fixtures';

const S1 = { id: SIM1, sequence_number: 1 };
const S2 = { id: SIM2, sequence_number: 2 };
const S3 = { id: SIM3, sequence_number: 3 };

describe('segmentoHistorico', () => {
  it('exatamente no corte conta como acima', () => {
    const a = desempAluno({ email: 'a', corte_mais_dificil: 70, notas: [nota(SIM1, 1, 70), nota(SIM2, 2, 80)] });
    expect(segmentoHistorico(a)).toBe('acima');
  });
  it('todas abaixo do corte = abaixo', () => {
    const a = desempAluno({ email: 'a', corte_mais_dificil: 70, notas: [nota(SIM1, 1, 69.9), nota(SIM2, 2, 50)] });
    expect(segmentoHistorico(a)).toBe('abaixo');
  });
  it('misturado = em variação', () => {
    const a = desempAluno({ email: 'a', corte_mais_dificil: 70, notas: [nota(SIM1, 1, 60), nota(SIM2, 2, 75)] });
    expect(segmentoHistorico(a)).toBe('variacao');
  });
  it('uma nota só = sem histórico', () => {
    const a = desempAluno({ email: 'a', corte_mais_dificil: 70, notas: [nota(SIM1, 1, 90)] });
    expect(segmentoHistorico(a)).toBe('sem_historico');
  });
  it('sem corte = sem histórico, mesmo com várias notas', () => {
    const a = desempAluno({ email: 'a', corte_mais_dificil: null, notas: [nota(SIM1, 1, 90), nota(SIM2, 2, 95)] });
    expect(segmentoHistorico(a)).toBe('sem_historico');
  });
  it('aluno inexistente = sem histórico', () => {
    expect(segmentoHistorico(undefined)).toBe('sem_historico');
  });
  it('só conta as notas dentro do recorte', () => {
    const a = desempAluno({
      email: 'a',
      corte_mais_dificil: 70,
      notas: [nota(SIM1, 1, 50), nota(SIM2, 2, 80), nota(SIM3, 3, 85)],
    });
    expect(segmentoHistorico(a)).toBe('variacao');
    expect(segmentoHistorico(a, new Set([SIM2, SIM3]))).toBe('acima');
    expect(segmentoHistorico(a, new Set([SIM1, SIM3]))).toBe('variacao');
    expect(segmentoHistorico(a, new Set([SIM3]))).toBe('sem_historico');
  });
  it('conta cada segmento', () => {
    const alunos = [
      desempAluno({ email: 'a', corte_mais_dificil: 70, notas: [nota(SIM1, 1, 80), nota(SIM2, 2, 80)] }),
      desempAluno({ email: 'b', corte_mais_dificil: 70, notas: [nota(SIM1, 1, 60), nota(SIM2, 2, 80)] }),
      desempAluno({ email: 'c', corte_mais_dificil: 70, notas: [nota(SIM1, 1, 60), nota(SIM2, 2, 60)] }),
      desempAluno({ email: 'd', corte_mais_dificil: 70, notas: [nota(SIM1, 1, 60)] }),
    ];
    expect(contarSegmentosHistorico(alunos)).toEqual({ acima: 1, variacao: 1, abaixo: 1, sem_historico: 1 });
  });
});

describe('resumoPorSimulado', () => {
  const alunos = [
    desempAluno({ email: 'a', corte_mais_dificil: 70, notas: [nota(SIM1, 1, 80)] }),
    desempAluno({ email: 'b', corte_mais_dificil: 70, notas: [nota(SIM1, 1, 60)] }),
    desempAluno({ email: 'c', corte_mais_dificil: null, notas: [nota(SIM1, 1, 100)] }),
    desempAluno({ email: 'd', corte_mais_dificil: 70, notas: [] }),
  ];
  it('acerto médio só de quem fez; participação sobre o total', () => {
    const r = resumoPorSimulado(alunos, S1);
    expect(r.acertoMedio).toBeCloseTo((80 + 60 + 100) / 3);
    expect(r.participacao).toEqual({ fizeram: 3, total: 4 });
  });
  it('possível aprovação exclui quem não tem corte e quem não fez', () => {
    const r = resumoPorSimulado(alunos, S1);
    // a (80>=70) sim, b (60<70) não; c sem corte e d sem nota ficam fora do denominador.
    expect(r.possivelAprovacao).toBe(50);
  });
  it('nota exatamente no corte aprova', () => {
    const r = resumoPorSimulado([desempAluno({ email: 'a', corte_mais_dificil: 70, notas: [nota(SIM1, 1, 70)] })], S1);
    expect(r.possivelAprovacao).toBe(100);
  });
  it('simulado sem ninguém: nulos, nunca 0', () => {
    const r = resumoPorSimulado(alunos, S2);
    expect(r.acertoMedio).toBeNull();
    expect(r.possivelAprovacao).toBeNull();
    expect(r.participacao).toEqual({ fizeram: 0, total: 4 });
  });
  it('ninguém com corte: possível aprovação nula', () => {
    const r = resumoPorSimulado([desempAluno({ email: 'a', corte_mais_dificil: null, notas: [nota(SIM1, 1, 80)] })], S1);
    expect(r.possivelAprovacao).toBeNull();
    expect(r.acertoMedio).toBe(80);
  });
});

describe('escolherSimuladosDosCards', () => {
  const alunos = [desempAluno({ email: 'a', notas: [nota(SIM1, 1, 50), nota(SIM2, 2, 60), nota(SIM3, 3, 70)] })];

  it('Atual = último encerrado da RPC quando está no recorte; Anterior imediato; Primeiro o 1º', () => {
    const r = escolherSimuladosDosCards([S1, S2, S3], alunos, SIM3);
    expect(r.atual).toEqual({ simulado: S3, emAndamento: false });
    expect(r.anterior).toEqual(S2);
    expect(r.primeiro).toEqual(S1);
  });
  it('o aberto mais novo não vira Atual enquanto há um encerrado no recorte', () => {
    const r = escolherSimuladosDosCards([S1, S2, S3], alunos, SIM2);
    expect(r.atual).toEqual({ simulado: S2, emAndamento: false });
    expect(r.anterior).toEqual(S1);
    expect(r.primeiro).toBeNull();
  });
  it('o encerrado da RPC no recorte é Atual mesmo sem nenhuma nota (participação 0, acerto "–")', () => {
    const r = escolherSimuladosDosCards([S1, S2, S3], [desempAluno({ email: 'a', notas: [nota(SIM1, 1, 50), nota(SIM2, 2, 60)] })], SIM3);
    expect(r.atual).toEqual({ simulado: S3, emAndamento: false });
    expect(r.anterior).toEqual(S2);
    const resumo = resumoPorSimulado([desempAluno({ email: 'a', notas: [nota(SIM1, 1, 50)] })], S3);
    expect(resumo.participacao).toEqual({ fizeram: 0, total: 1 });
    expect(resumo.acertoMedio).toBeNull();
  });
  it('recorte sem o encerrado da RPC cai no último com nota, em andamento', () => {
    const r = escolherSimuladosDosCards([S1, S3], alunos, SIM2);
    expect(r.atual).toEqual({ simulado: S3, emAndamento: true });
    expect(r.anterior).toEqual(S1);
    expect(r.primeiro).toBeNull();
  });
  it('sem simulado encerrado (null) usa o último com nota', () => {
    const r = escolherSimuladosDosCards([S1, S2, S3], alunos, null);
    expect(r.atual).toEqual({ simulado: S3, emAndamento: true });
    expect(r.anterior).toEqual(S2);
    expect(r.primeiro).toEqual(S1);
  });
  it('um simulado só: sem Anterior nem Primeiro', () => {
    const r = escolherSimuladosDosCards([S1], alunos, SIM1);
    expect(r.atual?.simulado).toEqual(S1);
    expect(r.anterior).toBeNull();
    expect(r.primeiro).toBeNull();
  });
  it('dois simulados: Primeiro coincide com Anterior e some', () => {
    const r = escolherSimuladosDosCards([S1, S2], alunos, SIM2);
    expect(r.anterior).toEqual(S1);
    expect(r.primeiro).toBeNull();
  });
  it('ignora a ordem de entrada e simulados sem nota', () => {
    const r = escolherSimuladosDosCards([S3, S1, S2], [desempAluno({ email: 'a', notas: [nota(SIM1, 1, 50)] })], null);
    expect(r.atual).toEqual({ simulado: S1, emAndamento: true });
  });
  it('sem notas em lugar nenhum: nada', () => {
    expect(escolherSimuladosDosCards([S1], [desempAluno({ email: 'a' })], null)).toEqual({
      atual: null,
      anterior: null,
      primeiro: null,
    });
  });
});

describe('semNotaNoSimulado', () => {
  it('lista quem não tem nota naquele simulado', () => {
    const alunos = [
      desempAluno({ email: 'a', notas: [nota(SIM1, 1, 50)] }),
      desempAluno({ email: 'b', notas: [nota(SIM2, 2, 50)] }),
      desempAluno({ email: 'c' }),
    ];
    expect(semNotaNoSimulado(alunos, SIM1).map((a) => a.email)).toEqual(['b', 'c']);
  });
});

describe('alertas com regrediu/estagnado nulos', () => {
  const alunos = [
    desempAlunoNulos({ email: 'a' }),
    desempAluno({ email: 'b', regrediu: true }),
    desempAluno({ email: 'c', estagnado: true }),
  ];
  it('null não conta como alerta', () => {
    expect(contarAlertas(alunos)).toEqual({ regrediu: 1, estagnado: 1, nao_fez: 0 });
    expect(passaAlerta(alunos[0], 'regrediu')).toBe(false);
    expect(passaAlerta(alunos[0], 'estagnado')).toBe(false);
  });
});
