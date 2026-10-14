import { describe, it, expect } from 'vitest';
import {
  escolherAtual,
  indicadoresPorSimulado,
  rotuloSimuladoAtual,
  simuladoPadrao,
} from '@/features/mentor/components/detalhamento/util';
import type { AlunoDesempenho } from '@/services/mentor/desempenho';

function aluno(email: string, corte: number | null, notas: [string, number, number][]): AlunoDesempenho {
  return {
    email,
    nome: email,
    notas: notas.map(([simulado_id, sequence_number, acerto_pct]) => ({
      simulado_id,
      sequence_number,
      acerto_pct,
      finalizada_em: '2026-01-01T00:00:00Z',
    })),
    ultimo_acerto: null,
    corte_mais_dificil: corte,
    vs_corte_pp: null,
    situacao: 'sem_meta',
    regrediu: false,
    estagnado: false,
    fez_ultimo: null,
  };
}

/** s1 e s2 encerrados; s3 ainda aberto. */
const SELECAO = [
  { id: 's1', sequence_number: 1, encerrado: true },
  { id: 's2', sequence_number: 2, encerrado: true },
  { id: 's3', sequence_number: 3, encerrado: false },
];

describe('indicadoresPorSimulado', () => {
  const alunos = [
    aluno('a', 65, [['s1', 1, 60], ['s2', 2, 70], ['s3', 3, 80]]),
    aluno('b', 66, [['s1', 1, 50], ['s2', 2, 64]]),
    aluno('c', null, [['s1', 1, 55], ['s3', 3, 40]]),
    aluno('d', 70, []),
  ];
  const r = indicadoresPorSimulado(alunos, SELECAO);

  it('acerto médio e participação por simulado, sobre a turma toda', () => {
    expect(r[0]).toMatchObject({ simulado_id: 's1', fizeram: 3, total: 4, participacao_pct: 75 });
    expect(r[0].acerto_medio).toBeCloseTo(55);
    expect(r[1]).toMatchObject({ fizeram: 2, participacao_pct: 50 });
    expect(r[1].acerto_medio).toBeCloseTo(67);
    expect(r[2]).toMatchObject({ fizeram: 2, participacao_pct: 50 });
    expect(r[2].acerto_medio).toBeCloseTo(60);
  });

  it('possível aprovação: só quem fez o simulado e tem corte entra no denominador', () => {
    // s1: a (60<65 não), b (50<66 não), c sem corte fora, d não fez.
    expect(r[0]).toMatchObject({ com_corte: 2, no_corte: 0, possivel_aprovacao_pct: 0 });
    // s2: a 70>=65 sim, b 64<66 não.
    expect(r[1]).toMatchObject({ com_corte: 2, no_corte: 1, possivel_aprovacao_pct: 50 });
    // s3: a 80>=65 sim; c sem corte fora.
    expect(r[2]).toMatchObject({ com_corte: 1, no_corte: 1, possivel_aprovacao_pct: 100 });
  });

  it('sem notas nem corte: valores nulos, sem dividir por zero', () => {
    const [x] = indicadoresPorSimulado([aluno('c', null, [['s1', 1, 55]]), aluno('d', 70, [])], [SELECAO[1]]);
    expect(x).toMatchObject({ fizeram: 0, acerto_medio: null, participacao_pct: 0, possivel_aprovacao_pct: null });
    const [vazio] = indicadoresPorSimulado([], [SELECAO[0]]);
    expect(vazio).toMatchObject({ total: 0, participacao_pct: null, acerto_medio: null });
  });

  it('aceita notas ausentes (aluno sem histórico)', () => {
    const sem = { ...aluno('z', 50, []), notas: undefined as unknown as AlunoDesempenho['notas'] };
    expect(indicadoresPorSimulado([sem], [SELECAO[0]])[0].fizeram).toBe(0);
  });
});

describe('escolherAtual', () => {
  const alunos = [
    aluno('a', null, [['s1', 1, 60], ['s2', 2, 70], ['s3', 3, 80]]),
    aluno('b', null, [['s1', 1, 50], ['s2', 2, 64]]),
  ];
  const ind = indicadoresPorSimulado(alunos, SELECAO);

  it('usa o último encerrado da RPC quando está na seleção, mesmo com um mais novo aberto', () => {
    const { atual, anterior, emAndamento } = escolherAtual(ind, 's2');
    expect(atual?.simulado_id).toBe('s2');
    expect(anterior?.simulado_id).toBe('s1');
    expect(emAndamento).toBe(false);
  });

  it('o anterior é relativo ao atual, não ao último selecionado', () => {
    const { atual, anterior } = escolherAtual(ind.slice(1), 's2');
    expect(atual?.simulado_id).toBe('s2');
    expect(anterior).toBeNull();
  });

  it('sem encerrado na seleção: o último com notas, "em andamento", e o anterior da seleção', () => {
    const { atual, anterior, emAndamento } = escolherAtual(ind, null);
    expect(atual?.simulado_id).toBe('s3');
    expect(anterior?.simulado_id).toBe('s2');
    expect(emAndamento).toBe(true);
  });

  it('id encerrado fora da seleção cai no fallback', () => {
    const { atual, emAndamento } = escolherAtual(ind.slice(2), 's2');
    expect(atual?.simulado_id).toBe('s3');
    expect(emAndamento).toBe(true);
  });

  it('o fallback pula simulados sem nenhuma nota', () => {
    const comVazio = indicadoresPorSimulado(alunos, [...SELECAO, { id: 's4', sequence_number: 4, encerrado: false }]);
    const { atual, anterior } = escolherAtual(comVazio, null);
    expect(atual?.simulado_id).toBe('s3');
    expect(anterior?.simulado_id).toBe('s2');
  });

  it('o encerrado da RPC na seleção é Atual mesmo sem nenhuma nota (não "em andamento")', () => {
    const comVazio = indicadoresPorSimulado(alunos, [...SELECAO, { id: 's4', sequence_number: 4, encerrado: true }]);
    const { atual, anterior, emAndamento } = escolherAtual(comVazio, 's4');
    expect(atual?.simulado_id).toBe('s4');
    expect(atual?.fizeram).toBe(0);
    expect(atual?.acerto_medio).toBeNull();
    expect(anterior?.simulado_id).toBe('s3');
    expect(emAndamento).toBe(false);
  });

  it('"em andamento" vem de encerrado === false, não de o id ser o da RPC', () => {
    // Fallback sobre um simulado já encerrado (RPC apontou para outro, fora da seleção): não é "em andamento".
    const soEncerrados = indicadoresPorSimulado(alunos, SELECAO.slice(0, 2));
    expect(escolherAtual(soEncerrados, 'fora').emAndamento).toBe(false);
    // E o aberto é "em andamento" mesmo sem nenhuma nota.
    const abertoVazio = indicadoresPorSimulado(alunos, [SELECAO[1], { id: 's4', sequence_number: 4, encerrado: false }]);
    expect(escolherAtual(abertoVazio, 's4')).toMatchObject({ emAndamento: true });
  });

  it('seleção vazia não quebra', () => {
    expect(escolherAtual([], null)).toEqual({ atual: null, anterior: null, emAndamento: false });
  });
});

describe('simuladoPadrao', () => {
  const lista = [
    { id: 's1', sequence_number: 1, titulo: 'S1', janela_fim: null, encerrado: true },
    { id: 's3', sequence_number: 3, titulo: 'S3', janela_fim: null, encerrado: false },
    { id: 's2', sequence_number: 2, titulo: 'S2', janela_fim: null, encerrado: true },
  ];
  it('é o encerrado mais recente, pulando o aberto mesmo mais novo', () => {
    expect(simuladoPadrao(lista)?.id).toBe('s2');
  });
  it('sem nenhum encerrado, cai no mais recente de todos', () => {
    expect(simuladoPadrao(lista.map((s) => ({ ...s, encerrado: false })))?.id).toBe('s3');
  });
  it('lista vazia = nenhum', () => {
    expect(simuladoPadrao([])).toBeNull();
  });
});

describe('rotuloSimuladoAtual', () => {
  it('marca "em andamento" só quando aplicável', () => {
    expect(rotuloSimuladoAtual(3, true)).toBe('Simulado 3 · em andamento');
    expect(rotuloSimuladoAtual(3, false)).toBe('Simulado 3');
  });
});
