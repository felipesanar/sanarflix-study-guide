// src/features/gestor/__tests__/AreasChart.test.tsx
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { AreasChart } from '@/features/gestor/charts/AreasChart';
import type { VisaoGeral } from '@/features/gestor/api/types';

const DIM = { largura: 640, altura: 320 };

/**
 * Fixture local ao teste desta Task 39. A fixture compartilhada da Fase 4
 * (`__tests__/fixtures/visaoGeral.ts`, Task 37) ainda não existe neste
 * working tree no momento em que este arquivo foi escrito — outro agente
 * cuida dela em paralelo. Os valores abaixo espelham exatamente
 * `visaoGeralFake.evolucaoPorArea` do plano (Task 37) para que o
 * comportamento fique idêntico quando a fixture compartilhada chegar.
 */
const evolucaoPorAreaFake: VisaoGeral['evolucaoPorArea'] = [
  {
    area: 'Clínica Médica',
    critica: true,
    pontos: [
      { rotulo: 'Simulado 1', valor: 28 },
      { rotulo: 'Simulado 2', valor: 29 },
      { rotulo: 'Simulado 3', valor: 27 },
    ],
  },
  {
    area: 'Cirurgia',
    critica: false,
    pontos: [
      { rotulo: 'Simulado 1', valor: 58 },
      { rotulo: 'Simulado 2', valor: 60 },
      { rotulo: 'Simulado 3', valor: 61 },
    ],
  },
  {
    area: 'Pediatria',
    critica: false,
    pontos: [
      { rotulo: 'Simulado 1', valor: 52 },
      { rotulo: 'Simulado 2', valor: 54 },
      { rotulo: 'Simulado 3', valor: 55 },
    ],
  },
];

describe('AreasChart (modo Por grande área)', () => {
  it('desenha uma linha por grande área', () => {
    const { container } = render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(3);
  });

  /**
   * Task 46.5 (QA de fim de fase): §11/checklist da Fase 4 exige `role="img"`
   * MAIS `<title>` e `<desc>` no SVG nos TRÊS modos do gráfico protagonista.
   * `EvolucaoChart` e `DispersaoChart` já traziam; este era o único sem — o
   * `aria-label` do `<figure>` sozinho dá nome, mas não a descrição longa.
   */
  it('é acessível como imagem com título e descrição no SVG', () => {
    const { container } = render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    expect(screen.getByRole('img', { name: /Desempenho por grande área/i })).toBeInTheDocument();
    expect(container.querySelector('svg title')?.textContent).toMatch(/Desempenho por grande área/i);
    expect(container.querySelector('svg desc')?.textContent).toMatch(/percentual de acerto/i);
  });

  it('rotula a métrica como desempenho em % de acerto, e nunca como proficiência', () => {
    render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    expect(screen.getByTestId('areas-rotulo-metrica')).toHaveTextContent('Desempenho por grande área (% de acerto)');
    expect(screen.queryByText(/profici/i)).not.toBeInTheDocument();
  });

  it('dá peso 3px à área crítica e 1.5px às demais, com 70% de opacidade nas demais', () => {
    const { container } = render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    const curvas = Array.from(container.querySelectorAll('.recharts-line-curve'));
    expect(curvas[0].getAttribute('stroke-width')).toBe('3');
    expect(curvas[1].getAttribute('stroke-width')).toBe('1.5');
    expect(curvas[1].getAttribute('stroke-opacity')).toBe('0.7');
  });

  it('marca a área crítica na legenda', () => {
    render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    const item = screen.getByRole('button', { name: /Clínica Médica/ });
    expect(item).toHaveTextContent('área crítica');
  });

  it('legenda clicável isola a área e o segundo clique reativa todas', async () => {
    const user = userEvent.setup();
    const { container } = render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);

    const cirurgia = screen.getByRole('button', { name: /Cirurgia/ });
    await user.click(cirurgia);
    expect(cirurgia).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(1);

    await user.click(cirurgia);
    expect(cirurgia).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(3);
  });

  it('oferece alternativa tabular com % de acerto por simulado', () => {
    render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    const tabela = screen.getByTestId('areas-tabela');
    expect(tabela.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(tabela).toHaveTextContent('27%');
  });

  it('mostra estado vazio sem áreas', () => {
    render(<AreasChart areas={[]} {...DIM} />);
    expect(screen.getByTestId('areas-vazio')).toHaveTextContent('Sem dados por grande área neste recorte');
  });

  /**
   * Achados 1 e 3 (revisão de 05/08): a RPC monta `pontos` por área de forma
   * independente (uma subquery correlacionada por `grande_area`), então áreas
   * diferentes podem ter quantidades e conjuntos de simulados diferentes —
   * ex.: todas as questões de uma área foram anuladas num simulado, ou a
   * `grande_area` não foi classificada. O componente casava por ÍNDICE, não
   * por rótulo: com uma área "curta", o valor do simulado errado aparecia sob
   * o rótulo de outro. Esta fixture propositalmente dá a Cirurgia 1 ponto
   * (só no Simulado 3) e à Clínica Médica os 3 pontos completos.
   */
  it('casa cada área pelo rótulo do simulado, mesmo com áreas de comprimentos diferentes', () => {
    const areasHeterogeneas: VisaoGeral['evolucaoPorArea'] = [
      {
        area: 'Cirurgia',
        critica: false,
        pontos: [{ rotulo: 'Simulado 3', valor: 61 }],
      },
      {
        area: 'Clínica Médica',
        critica: true,
        pontos: [
          { rotulo: 'Simulado 1', valor: 28 },
          { rotulo: 'Simulado 2', valor: 29 },
          { rotulo: 'Simulado 3', valor: 27 },
        ],
      },
    ];
    render(<AreasChart areas={areasHeterogeneas} {...DIM} />);

    const tabela = screen.getByTestId('areas-tabela');
    const cabecalhos = Array.from(tabela.querySelectorAll('thead th')).map((th) => th.textContent);
    expect(cabecalhos).toEqual(['Grande área', 'Simulado 1', 'Simulado 2', 'Simulado 3']);

    const linhas = Array.from(tabela.querySelectorAll('tbody tr'));
    const linhaCirurgia = linhas.find((linha) => linha.textContent?.includes('Cirurgia'));
    const linhaClinica = linhas.find((linha) => linha.textContent?.includes('Clínica Médica'));

    // Cirurgia só tem ponto no Simulado 3: TRACO nas duas primeiras colunas,
    // 61% na terceira — nunca 61% deslocado para a primeira coluna.
    expect(Array.from(linhaCirurgia?.querySelectorAll('td') ?? []).map((td) => td.textContent)).toEqual([
      '—',
      '—',
      '61%',
    ]);
    // Clínica Médica tem a régua completa e não pode perder nenhum valor.
    expect(Array.from(linhaClinica?.querySelectorAll('td') ?? []).map((td) => td.textContent)).toEqual([
      '28%',
      '29%',
      '27%',
    ]);
  });

  /**
   * Achado 2 (revisão de 05/08): `role="img"` no `<figure>` torna todo
   * descendente "presentational" (ARIA 1.2), podando a legenda clicável e a
   * tabela colapsável — a alternativa não-visual — da árvore de
   * acessibilidade. `role="img"` deve envolver só o desenho.
   */
  it('mantém role="img" restrito ao desenho, sem podar legenda e tabela da árvore de acessibilidade', () => {
    const { container } = render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);

    const imagem = container.querySelector('[role="img"]');
    expect(imagem).not.toBeNull();
    expect(imagem?.querySelector('button, summary, details, table')).toBeNull();

    // Legenda e tabela continuam alcançáveis, fora do nó de imagem.
    expect(screen.getByRole('button', { name: /Cirurgia/ })).toBeInTheDocument();
    expect(screen.getByText('Ver dados em tabela')).toBeInTheDocument();
  });
});
