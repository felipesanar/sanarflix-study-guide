// src/features/gestor/__tests__/AreasChart.test.tsx
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, userEvent } from '@/test/utils';
import { AreasChart, coresDasAreas } from '@/features/gestor/charts/AreasChart';
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

const opacidades = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.recharts-line-curve')).map((no) =>
    no.getAttribute('stroke-opacity'),
  );

describe('coresDasAreas (paleta de séries, ordem fixa do handoff)', () => {
  /**
   * A cor tem que ser propriedade da grande ÁREA, não da posição dela no
   * array: se viesse do índice, a Cirurgia mudaria de cor sempre que outra
   * área entrasse ou saísse do recorte, e "a linha azul" deixaria de
   * significar a mesma coisa entre dois filtros.
   */
  it('dá a mesma cor à mesma área, independentemente da posição no recorte', () => {
    const completo = coresDasAreas(evolucaoPorAreaFake);
    expect(completo).toEqual(['var(--gp-serie-1)', 'var(--gp-serie-2)', 'var(--gp-serie-5)']);

    const semClinica = coresDasAreas(evolucaoPorAreaFake.slice(1));
    expect(semClinica).toEqual(['var(--gp-serie-2)', 'var(--gp-serie-5)']);
  });

  it('casa a área mesmo com o nome abreviado no cadastro', () => {
    const abreviado: VisaoGeral['evolucaoPorArea'] = [
      { area: 'Gineco. e Obstetrícia', critica: false, pontos: [] },
      { area: 'Medicina Preventiva', critica: false, pontos: [] },
    ];
    expect(coresDasAreas(abreviado)).toEqual(['var(--gp-serie-3)', 'var(--gp-serie-4)']);
  });

  it('nunca repete cor entre séries do mesmo gráfico quando a área é desconhecida', () => {
    const comDesconhecida: VisaoGeral['evolucaoPorArea'] = [
      { area: 'Clínica Médica', critica: false, pontos: [] },
      { area: 'Área nova sem cor fixa', critica: false, pontos: [] },
      { area: 'Cirurgia', critica: false, pontos: [] },
    ];
    const cores = coresDasAreas(comDesconhecida);
    expect(new Set(cores).size).toBe(cores.length);
    expect(cores[0]).toBe('var(--gp-serie-1)');
    expect(cores[2]).toBe('var(--gp-serie-2)');
  });
});

describe('AreasChart (modo Grande área)', () => {
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
  /**
   * Regressão da "bolinha no topo".
   *
   * `Line.renderDots` do Recharts percorre TODOS os pontos, inclusive os de
   * valor nulo, e passa `cy: null` para eles (`cartesian/Line.js`). O guard
   * do `PontoArea` testava `=== undefined`, deixava o `null` passar, e o
   * `<circle>` saía sem atributo `cy` — que em SVG vale 0, ou seja, um ponto
   * colado no topo do plot sem série nenhuma por trás. Aqui é o cenário
   * comum deste gráfico: cada área tem o seu próprio conjunto de simulados,
   * então buraco é a regra (§4.10 — buraco nunca vira zero).
   */
  it('ponto sem valor não vira bolinha solta no topo do gráfico', () => {
    const comBuraco: VisaoGeral['evolucaoPorArea'] = [
      {
        area: 'Clínica Médica',
        critica: false,
        pontos: [
          { rotulo: 'Simulado 1', valor: 70 },
          { rotulo: 'Simulado 2', valor: 72 },
        ],
      },
      // Não tem o Simulado 1: a linha desta área nasce com um buraco.
      { area: 'Pediatria', critica: false, pontos: [{ rotulo: 'Simulado 2', valor: 41 }] },
    ];

    const { container } = render(<AreasChart areas={comBuraco} {...DIM} />);
    const bolinhas = Array.from(container.querySelectorAll('.recharts-line-dots circle'));

    expect(bolinhas.length).toBeGreaterThan(0);
    bolinhas.forEach((bolinha) => {
      expect(bolinha.getAttribute('cy')).not.toBeNull();
      expect(bolinha.getAttribute('cx')).not.toBeNull();
    });
  });

  it('é acessível como imagem com descrição no SVG, e com <title> vazio (sem tooltip nativo)', () => {
    const { container } = render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    expect(screen.getByRole('img', { name: /Desempenho por grande área/i })).toBeInTheDocument();
    expect(container.querySelector('svg desc')?.textContent).toMatch(/percentual de acerto/i);
    // Ver a explicação em `EvolucaoChart.test.tsx`: `<title>` COM TEXTO vira
    // tooltip nativo do navegador e sobrepõe o tooltip de dado.
    expect(container.querySelector('svg title')?.textContent).toBe('');
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

  /**
   * docs/06-data-viz.md §2: a meta é linha tracejada com rótulo à direita.
   * Sem ela, "Grande área" era o único modo em que o gestor não conseguia ver
   * de relance quais áreas estão abaixo do corte.
   */
  it('desenha a linha de meta tracejada, com o rótulo dentro do plot', () => {
    const { container } = render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    const meta = container.querySelector('.recharts-reference-line-line');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('stroke-dasharray')).toBe('6 5');
    expect(meta?.getAttribute('stroke-width')).toBe('1.5');
    expect(container.querySelector('.recharts-reference-line text')?.textContent).toBe(
      'meta de acerto · 60',
    );
  });

  /** Handoff §7: grade horizontal SÓLIDA de 1px; sem grade vertical. */
  it('desenha a grade sólida, só horizontal', () => {
    const { container } = render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    const horizontais = Array.from(container.querySelectorAll('.recharts-cartesian-grid-horizontal line'));
    expect(horizontais.length).toBeGreaterThan(0);
    horizontais.forEach((linha) => expect(linha.getAttribute('stroke-dasharray')).toBeNull());
    expect(container.querySelector('.recharts-cartesian-grid-vertical line')).toBeNull();
  });

  it('não repete o valor da meta nos ticks do eixo Y', () => {
    const { container } = render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    const ticks = Array.from(
      container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value'),
    ).map((no) => no.textContent);
    expect(ticks).toEqual(['0%', '20%', '40%', '80%', '100%']);
  });

  /**
   * Referência: cada série marca o ponto de cada simulado, e o ÚLTIMO ponto da
   * série crítica ganha halo + anel — é onde a leitura vira decisão.
   */
  it('marca cada simulado com um ponto e destaca o último ponto da área crítica', () => {
    const { container } = render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    const criticos = Array.from(
      container.querySelectorAll('.recharts-line-dots'),
    )[0].querySelectorAll('circle');
    expect(Array.from(criticos).map((no) => no.getAttribute('r'))).toEqual(['4', '4', '12', '5.5', '3.2']);

    const naoCriticos = Array.from(
      container.querySelectorAll('.recharts-line-dots'),
    )[1].querySelectorAll('circle');
    expect(Array.from(naoCriticos).map((no) => no.getAttribute('r'))).toEqual(['3.5', '3.5', '3.5']);
  });

  it('marca a área crítica na legenda', () => {
    render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    const item = screen.getByRole('button', { name: /Clínica Médica/ });
    expect(item).toHaveTextContent('área crítica');
  });

  /** docs/06-data-viz.md §2: "Hover em uma série destaca e esmaece as outras." */
  it('hover numa série a isola visualmente: as outras esmaecem, e voltam ao sair', () => {
    const { container } = render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    expect(opacidades(container)).toEqual(['1', '0.7', '0.7']);

    const cirurgia = screen.getByRole('button', { name: /Cirurgia/ });
    fireEvent.mouseEnter(cirurgia);
    expect(opacidades(container)).toEqual(['0.4', '0.7', '0.4']);

    fireEvent.mouseLeave(cirurgia);
    expect(opacidades(container)).toEqual(['1', '0.7', '0.7']);
  });

  it('o mesmo destaque acontece pelo teclado, ao focar o item da legenda', () => {
    const { container } = render(<AreasChart areas={evolucaoPorAreaFake} {...DIM} />);
    fireEvent.focus(screen.getByRole('button', { name: /Pediatria/ }));
    expect(opacidades(container)).toEqual(['0.4', '0.4', '0.7']);
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

  /** docs/06-data-viz.md, princípio 7: o vazio é desenhado, não um bloco branco. */
  it('o estado vazio mantém a moldura do gráfico, com a meta de acerto rotulada', () => {
    render(<AreasChart areas={[]} {...DIM} />);
    const vazio = screen.getByTestId('areas-vazio');
    expect(vazio).toHaveTextContent('Sem dados por grande área neste recorte');
    expect(vazio).toHaveTextContent('meta de acerto · 60');
    ['100', '80', '40', '20', '0'].forEach((tick) => expect(vazio).toHaveTextContent(tick));
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
