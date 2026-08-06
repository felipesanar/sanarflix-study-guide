import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/utils';
import { EvolucaoChart, TooltipEvolucao } from '@/features/gestor/charts/EvolucaoChart';
import type { VisaoGeral } from '@/features/gestor/api/types';

const DIM = { largura: 640, altura: 320 };

/**
 * Fixtures locais a este arquivo. O plano (Task 38) importa `visaoGeralFake`/
 * `visaoComUmSimulado` de `./fixtures/visaoGeral` — fixture compartilhada da
 * Task 37, que roda em paralelo e ainda não existe neste momento. Para não
 * criar um arquivo fora do escopo desta task (e não colidir com o que a Task
 * 37 vai produzir), a mesma forma de dado (`VisaoGeral['evolucao']`) é
 * reproduzida aqui, só com o suficiente para os casos abaixo. Migrar para o
 * import compartilhado quando `fixtures/visaoGeral.ts` existir.
 */
const visaoGeralFake: { evolucao: VisaoGeral['evolucao'] } = {
  evolucao: [
    { simuladoId: 'sim-1', nome: 'Simulado 1', data: '2026-03-15', valor: 57, participantes: 320 },
    { simuladoId: 'sim-2', nome: 'Simulado 2', data: '2026-05-10', valor: 59, participantes: 310 },
    { simuladoId: 'sim-3', nome: 'Simulado 3', data: '2026-07-14', valor: 62, participantes: 305 },
  ],
};

const visaoComUmSimulado = (): { evolucao: VisaoGeral['evolucao'] } => ({
  evolucao: [
    { simuladoId: 'sim-1', nome: 'Simulado 1', data: '2026-03-15', valor: 51, participantes: 300 },
  ],
});

const raios = (container: HTMLElement, seletor: string) =>
  Array.from(container.querySelectorAll(seletor)).map((no) => no.getAttribute('r'));

describe('EvolucaoChart (modo Geral)', () => {
  it('é acessível como imagem com título e descrição', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    const figura = screen.getByRole('img', { name: /Evolução da proficiência institucional/i });
    expect(figura).toBeInTheDocument();
    expect(container.querySelector('svg title')?.textContent).toMatch(/Evolução da proficiência institucional/i);
    expect(container.querySelector('svg desc')?.textContent).toMatch(/escala 0 a 100/i);
  });

  it('desenha linha, área e a linha de meta tracejada com 2+ simulados', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    expect(container.querySelector('.recharts-line')).not.toBeNull();
    expect(container.querySelector('.recharts-area')).not.toBeNull();

    const meta = container.querySelector('.recharts-reference-line-line');
    expect(meta).not.toBeNull();
    // Anatomia da referência: 1.5px, tracejado 6 5, em linha (não em texto).
    expect(meta?.getAttribute('stroke-dasharray')).toBe('6 5');
    expect(meta?.getAttribute('stroke-width')).toBe('1.5');
  });

  /**
   * Handoff §7: o rótulo da meta mora DENTRO do plot, ancorado à direita, e diz
   * o que a linha é — não só "Meta 60" solto fora da área de desenho (o que
   * obrigava a reservar margem morta à direita).
   */
  it('rotula a meta dentro do plot, com o texto por extenso', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    const rotulo = container.querySelector('.recharts-reference-line text');
    expect(rotulo?.textContent).toBe('meta de proficiência · 60');
  });

  it('usa espessura de 2.5px e traço em gradiente da marca na linha protagonista', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    const curva = container.querySelector('.recharts-line-curve');
    expect(curva?.getAttribute('stroke-width')).toBe('2.5');
    expect(curva?.getAttribute('stroke')).toBe('url(#gradiente-linha-evolucao-gestor)');
  });

  /** Handoff §7: gradiente de área em três paradas, não uma rampa linear. */
  it('a área usa o gradiente de três paradas da referência', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    const paradas = Array.from(container.querySelectorAll('#gradiente-evolucao-gestor stop'));
    expect(paradas.map((parada) => parada.getAttribute('offset'))).toEqual(['0%', '58%', '100%']);
    expect(paradas.map((parada) => parada.getAttribute('stop-opacity'))).toEqual(['0.22', '0.06', '0']);
  });

  /** Handoff §7: grade horizontal SÓLIDA de 1px; nada de tracejado 3 3. */
  it('desenha a grade sólida, só horizontal, e a base do plot mais densa', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    const horizontais = Array.from(container.querySelectorAll('.recharts-cartesian-grid-horizontal line'));
    expect(horizontais.length).toBeGreaterThan(0);
    horizontais.forEach((linha) => expect(linha.getAttribute('stroke-dasharray')).toBeNull());
    expect(container.querySelector('.recharts-cartesian-grid-vertical line')).toBeNull();
    expect(container.querySelector('.recharts-xAxis .recharts-cartesian-axis-line')?.getAttribute('stroke'))
      .toBe('var(--gp-border-strong)');
  });

  /**
   * O tick do valor da meta duplicaria gridline e rótulo em cima da linha
   * tracejada — na referência o eixo Y salta de 40 para 80.
   */
  it('não repete o valor da meta nos ticks do eixo Y', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    const ticks = Array.from(
      container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value'),
    ).map((no) => no.textContent);
    expect(ticks).toEqual(['0', '20', '40', '80', '100']);
  });

  /**
   * Handoff §7: o ponto CORRENTE é branco com anel da marca sobre um halo
   * largo; os anteriores são círculos brancos de anel fino. Antes todos eram
   * sólidos na marca — o atual não se distinguia dos demais.
   */
  it('desenha o ponto atual com halo e anel, e os anteriores em anel fino', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    const todos = raios(container, '.recharts-line-dots circle');
    expect(todos).toEqual(['6', '6', '13', '7.5', '4']);
  });

  /**
   * docs/06-data-viz.md, princípio 3 (tooltip rico): o número de participantes
   * é o que separa uma queda medida em 12 alunos de uma medida em 300 — ele
   * existia só na tabela colapsável.
   */
  it('o tooltip traz nome do simulado, valor e número de participantes', () => {
    render(
      <TooltipEvolucao
        active
        payload={[{ payload: { rotulo: 'Sim. de Área CM', valor: 61, participantes: 102, data: '2026-06-02' } }]}
      />,
    );
    expect(screen.getByText('Sim. de Área CM')).toBeInTheDocument();
    expect(screen.getByText('61 de proficiência · 102 alunos')).toBeInTheDocument();
    expect(screen.getByText('02/06/2026')).toBeInTheDocument();
  });

  it('o tooltip não renderiza nada quando inativo', () => {
    render(<TooltipEvolucao active={false} payload={[{ payload: { rotulo: 'Sim. de Área CM', valor: 61, participantes: 102, data: '2026-06-02' } }]} />);
    expect(screen.queryByText('Sim. de Área CM')).not.toBeInTheDocument();
  });

  /** docs/06-data-viz.md, princípio 2: legenda sempre, com rótulo por extenso. */
  it('tem rodapé de legenda com a série e a meta', () => {
    render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    expect(screen.getByText('Proficiência institucional')).toBeInTheDocument();
    expect(screen.getByText('Meta 60')).toBeInTheDocument();
  });

  it('com 1 simulado NÃO desenha linha: mostra o ponto rotulado e a nota de primeira medição', () => {
    const { container } = render(<EvolucaoChart pontos={visaoComUmSimulado().evolucao} {...DIM} />);
    expect(container.querySelector('.recharts-surface')).toBeNull();
    expect(container.querySelector('.recharts-line')).toBeNull();

    const unico = screen.getByTestId('evolucao-ponto-unico');
    expect(unico).toHaveTextContent('Simulado 1');
    expect(unico).toHaveTextContent('51');
    expect(unico).toHaveTextContent('300 alunos');
    expect(
      screen.getByText('Primeira medição; a evolução aparece a partir do segundo simulado.')
    ).toBeInTheDocument();
  });

  /**
   * docs/06-data-viz.md, princípio 7: o vazio é DESENHADO (eixos + mensagem),
   * nunca um retângulo em branco com uma frase no meio.
   */
  it('o estado vazio mantém a moldura do gráfico: eixos, grade e linha de meta', () => {
    render(<EvolucaoChart pontos={[]} {...DIM} />);
    const vazio = screen.getByTestId('evolucao-vazio');
    expect(vazio).toHaveTextContent('Nenhum simulado realizado neste recorte');
    // Rótulos do eixo Y da moldura, na mesma escala em que o dado apareceria.
    ['100', '80', '40', '20', '0'].forEach((tick) => expect(vazio).toHaveTextContent(tick));
    expect(vazio).toHaveTextContent('meta de proficiência · 60');
  });

  it('oferece alternativa tabular com um registro por simulado', () => {
    render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    const tabela = screen.getByTestId('evolucao-tabela');
    expect(tabela.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(tabela).toHaveTextContent('Simulado 3');
    expect(tabela).toHaveTextContent('14/07/2026');
    expect(tabela).toHaveTextContent('62');
  });

  /**
   * Achado 2 (revisão de 05/08), mesma classe já corrigida em `AreasChart`:
   * `role="img"` no `<figure>` torna todo descendente "presentational" (ARIA
   * 1.2, Children Presentational: True), podando a `<figcaption>` e a tabela
   * colapsável — justamente a alternativa não-visual — da árvore de
   * acessibilidade. O role tem que envolver só o desenho.
   */
  describe('role="img" restrito ao desenho (achado 2, revisão de 05/08)', () => {
    it('com 2+ simulados, o nó de imagem não engole a figcaption nem a tabela', () => {
      const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);

      const imagem = container.querySelector('[role="img"]');
      expect(imagem).not.toBeNull();
      expect(imagem?.querySelector('details, summary, table, figcaption')).toBeNull();

      expect(screen.getByTestId('evolucao-tabela')).toBeInTheDocument();
      expect(screen.getByText('Proficiência institucional')).toBeInTheDocument();
    });

    it('com 1 simulado só, idem — o aviso de primeira medição fica fora do nó de imagem', () => {
      const { container } = render(<EvolucaoChart pontos={visaoComUmSimulado().evolucao} {...DIM} />);

      const imagem = container.querySelector('[role="img"]');
      expect(imagem).not.toBeNull();
      expect(imagem?.querySelector('details, summary, table, figcaption')).toBeNull();

      expect(screen.getByTestId('evolucao-tabela')).toBeInTheDocument();
      expect(
        screen.getByText('Primeira medição; a evolução aparece a partir do segundo simulado.'),
      ).toBeInTheDocument();
    });
  });
});
