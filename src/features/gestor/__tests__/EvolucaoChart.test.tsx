import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/utils';
import { EvolucaoChart } from '@/features/gestor/charts/EvolucaoChart';
import type { VisaoGeral } from '@/features/gestor/api/types';

const DIM = { largura: 640, altura: 320 };

/**
 * Fixtures locais a este arquivo. O plano (Task 38) importa `visaoGeralFake`/
 * `visaoComUmSimulado` de `./fixtures/visaoGeral` — fixture compartilhada da
 * Task 37, que roda em paralelo e ainda não existe neste momento. Para não
 * criar um arquivo fora do escopo desta task (e não colidir com o que a Task
 * 37 vai produzir), a mesma forma de dado (`VisaoGeral['evolucao']`) é
 * reproduzida aqui, só com o suficiente para os 6 casos abaixo. Migrar para o
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

describe('EvolucaoChart (modo Geral)', () => {
  it('é acessível como imagem com título e descrição', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    const figura = screen.getByRole('img', { name: /Evolução da proficiência institucional/i });
    expect(figura).toBeInTheDocument();
    expect(container.querySelector('svg title')?.textContent).toMatch(/Evolução da proficiência institucional/i);
    expect(container.querySelector('svg desc')?.textContent).toMatch(/escala 0 a 100/i);
  });

  it('desenha linha, área e a linha de meta 60 tracejada com 2+ simulados', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    expect(container.querySelector('.recharts-line')).not.toBeNull();
    expect(container.querySelector('.recharts-area')).not.toBeNull();

    const meta = container.querySelector('.recharts-reference-line-line');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('stroke-dasharray')).toBe('6 4');
    expect(screen.getByText(/Meta institucional de proficiência: 60/i)).toBeInTheDocument();
  });

  it('usa espessura de 2.5px na linha protagonista', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    expect(container.querySelector('.recharts-line-curve')?.getAttribute('stroke-width')).toBe('2.5');
  });

  it('com 1 simulado NÃO desenha linha: mostra o ponto rotulado e a nota de primeira medição', () => {
    const { container } = render(<EvolucaoChart pontos={visaoComUmSimulado().evolucao} {...DIM} />);
    expect(container.querySelector('.recharts-surface')).toBeNull();
    expect(container.querySelector('.recharts-line')).toBeNull();

    const unico = screen.getByTestId('evolucao-ponto-unico');
    expect(unico).toHaveTextContent('Simulado 1');
    expect(unico).toHaveTextContent('51');
    expect(
      screen.getByText('Primeira medição; a evolução aparece a partir do segundo simulado.')
    ).toBeInTheDocument();
  });

  it('mostra estado vazio sem simulados realizados', () => {
    render(<EvolucaoChart pontos={[]} {...DIM} />);
    expect(screen.getByTestId('evolucao-vazio')).toHaveTextContent('Nenhum simulado realizado neste recorte');
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
      expect(screen.getByText(/Meta institucional de proficiência: 60/i)).toBeInTheDocument();
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
