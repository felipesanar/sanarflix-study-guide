import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/utils';
import { DispersaoChart, medianaDeNotas, prepararPontos } from '@/features/gestor/charts/DispersaoChart';
import type { VisaoGeral } from '@/features/gestor/api/types';

const DIM = { largura: 640, altura: 320 };

/**
 * Mesmos valores da fixture compartilhada da Fase 4 (`visaoGeralFake.dispersao`,
 * Task 37) — replicados aqui porque a Task 37 é de outro agente em paralelo e
 * `__tests__/fixtures/visaoGeral.ts` ainda não existe neste working tree. Ver
 * pendências: quando a fixture compartilhada landar, este arquivo pode trocar
 * para importá-la sem mudar nenhuma expectativa (os valores são idênticos).
 */
const DOIS_SEMESTRES: VisaoGeral['dispersao'] = [
  { alunoId: 'a1', semestre: 11, nota: 72 },
  { alunoId: 'a2', semestre: 11, nota: 58 },
  { alunoId: 'a3', semestre: 11, nota: 64 },
  { alunoId: 'a4', semestre: 12, nota: 81 },
  { alunoId: 'a5', semestre: 12, nota: 49 },
  { alunoId: 'a6', semestre: 12, nota: 66 },
];

const UM_SEMESTRE: VisaoGeral['dispersao'] = [
  { alunoId: 'a1', semestre: 11, nota: 40 },
  { alunoId: 'a2', semestre: 11, nota: 55 },
  { alunoId: 'a3', semestre: 11, nota: 70 },
];

describe('prepararPontos', () => {
  it('não aplica jitter quando há mais de um semestre', () => {
    const preparados = prepararPontos(DOIS_SEMESTRES);
    expect(preparados.map((p) => p.x)).toEqual([11, 11, 11, 12, 12, 12]);
  });

  it('aplica jitter determinístico quando há um único semestre', () => {
    const preparados = prepararPontos(UM_SEMESTRE);
    const xs = preparados.map((p) => p.x);
    expect(new Set(xs).size).toBe(3);
    xs.forEach((x) => expect(Math.abs(x - 11)).toBeLessThan(0.25));
  });
});

describe('medianaDeNotas', () => {
  it('calcula a mediana com número ímpar de pontos', () => {
    expect(medianaDeNotas(UM_SEMESTRE)).toBe(55);
  });

  it('calcula a mediana com número par de pontos', () => {
    expect(medianaDeNotas([...UM_SEMESTRE, { alunoId: 'a4', semestre: 11, nota: 80 }])).toBe(62.5);
  });
});

describe('DispersaoChart (modo Por aluno)', () => {
  it('desenha um símbolo por aluno e é acessível como imagem', () => {
    const { container } = render(<DispersaoChart pontos={DOIS_SEMESTRES} {...DIM} />);
    expect(screen.getByRole('img', { name: /Dispersão de proficiência por semestre/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.recharts-scatter-symbol')).toHaveLength(6);
  });

  it('desenha o corte de proficiência em 60', () => {
    const { container } = render(<DispersaoChart pontos={DOIS_SEMESTRES} {...DIM} />);
    expect(container.querySelector('.recharts-reference-line-line')).not.toBeNull();
    expect(screen.getByText(/Corte de proficiência: 60/i)).toBeInTheDocument();
  });

  it('desenha a linha de tendência quando o servidor a fornece', () => {
    const { container } = render(
      <DispersaoChart
        pontos={DOIS_SEMESTRES}
        tendencia={[{ semestre: 11, nota: 58 }, { semestre: 12, nota: 66 }]}
        {...DIM}
      />
    );
    expect(container.querySelector('.recharts-scatter-line')).not.toBeNull();
    expect(screen.queryByText(/linha de tendência indisponível/i)).not.toBeInTheDocument();
  });

  it('sem tendência do servidor não desenha reta e informa a indisponibilidade', () => {
    const { container } = render(<DispersaoChart pontos={DOIS_SEMESTRES} {...DIM} />);
    expect(container.querySelector('.recharts-scatter-line')).toBeNull();
    expect(screen.getByText(/linha de tendência indisponível para este recorte/i)).toBeInTheDocument();
  });

  it('com um único semestre vira distribuição interna: jitter + mediana em destaque', () => {
    const { container } = render(<DispersaoChart pontos={UM_SEMESTRE} {...DIM} />);
    expect(container.querySelectorAll('.recharts-scatter-symbol')).toHaveLength(3);
    expect(screen.getByText(/Mediana do semestre: 55/i)).toBeInTheDocument();
  });

  it('mostra estado vazio sem alunos', () => {
    render(<DispersaoChart pontos={[]} {...DIM} />);
    expect(screen.getByTestId('dispersao-vazio')).toHaveTextContent('Sem alunos com resultado neste recorte');
  });

  it('nunca expõe alunoId em atributo, tooltip, label ou tabela de dados no DOM', () => {
    const { container } = render(<DispersaoChart pontos={DOIS_SEMESTRES} {...DIM} />);
    DOIS_SEMESTRES.forEach((ponto) => {
      expect(container.innerHTML).not.toContain(ponto.alunoId);
    });
  });

  /**
   * Achado 2 (revisão de 05/08), mesma classe já corrigida em `AreasChart`:
   * `role="img"` no `<figure>` torna todo descendente "presentational" (ARIA
   * 1.2, Children Presentational: True), podando a `<figcaption>` — que carrega
   * o corte, a mediana e o aviso de tendência indisponível — e a tabela
   * colapsável exigida pelo handoff §5 da árvore de acessibilidade.
   */
  it('mantém role="img" restrito ao desenho, sem podar figcaption e tabela da árvore de acessibilidade', () => {
    const { container } = render(<DispersaoChart pontos={UM_SEMESTRE} {...DIM} />);

    const imagem = container.querySelector('[role="img"]');
    expect(imagem).not.toBeNull();
    expect(imagem?.querySelector('details, summary, table, figcaption')).toBeNull();

    expect(screen.getByTestId('dispersao-tabela')).toBeInTheDocument();
    expect(screen.getByText(/Mediana do semestre: 55/i)).toBeInTheDocument();
  });
});
