import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiguraGrafico } from '@/features/gestor/components/engajamento/FiguraGrafico';
import { BarrasMensais, alturaDaBarra } from '@/features/gestor/components/engajamento/BarrasMensais';
import { LinhaMensal, eixoPct, eixoQuantidade } from '@/features/gestor/components/engajamento/LinhaMensal';
import { BarrasPorSemestre } from '@/features/gestor/components/engajamento/BarrasPorSemestre';
import { BarraHorizontal } from '@/features/gestor/components/engajamento/BarraHorizontal';

/** Mesmo contrato do `a11y.test.tsx`: todo gráfico vive numa <figure>, com nome e tabela alternativa. */
function esperarFiguraAcessivel(nome: string) {
  const grafico = screen.getByRole('img', { name: nome });
  const figura = grafico.closest('figure');
  expect(figura, 'todo gráfico vive dentro de <figure>').not.toBeNull();
  expect(within(figura as HTMLElement).getByText('Ver dados em tabela')).toBeInTheDocument();
  expect(within(figura as HTMLElement).getByRole('table')).toBeInTheDocument();
  return figura as HTMLElement;
}

const MESES = [
  { mes: '2026-08', parcial: false, valor: 40, texto: '40%', sub: '208 alunos' },
  { mes: '2026-09', parcial: false, valor: 20, texto: '20%', sub: '104 alunos' },
  { mes: '2026-10', parcial: true, valor: 10, texto: '10%', sub: '52 alunos' },
];

describe('FiguraGrafico (§10.6)', () => {
  it('<figure> + role="img" com nome + "Ver dados em tabela" com uma linha por ponto', () => {
    render(
      <FiguraGrafico rotulo="Questões por mês" linhasTabela={[{ rotulo: 'Set', valor: '10' }, { rotulo: 'Out*', valor: '20' }]}>
        <span>desenho</span>
      </FiguraGrafico>,
    );
    const figura = esperarFiguraAcessivel('Questões por mês');
    expect(within(figura).getByText('desenho')).toBeInTheDocument();
    const linhas = within(figura).getAllByRole('row');
    expect(linhas).toHaveLength(3); // cabeçalho + 2 pontos
    expect(within(linhas[2]).getByRole('rowheader')).toHaveTextContent('Out*');
    expect(within(linhas[2]).getByRole('cell')).toHaveTextContent('20');
  });

  it('a tabela tem legenda e cabeçalhos de coluna', () => {
    render(<FiguraGrafico rotulo="X" linhasTabela={[]} cabecalho={['Mês', 'Valor']}><i /></FiguraGrafico>);
    expect(screen.getByRole('table', { name: 'X' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mês' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Valor' })).toBeInTheDocument();
  });
});

describe('BarrasMensais', () => {
  it('é uma figura acessível, com a tabela alternativa "rótulo (sub)"', () => {
    render(<BarrasMensais rotulo="Engajamento mês a mês" pontos={MESES} />);
    const figura = esperarFiguraAcessivel('Engajamento mês a mês');
    const linhas = within(figura).getAllByRole('row');
    expect(within(linhas[1]).getByRole('rowheader')).toHaveTextContent('Ago');
    expect(within(linhas[1]).getByRole('cell')).toHaveTextContent('40% (208 alunos)');
  });

  it('mês parcial leva "*" no rótulo e cor mais clara', () => {
    render(<BarrasMensais rotulo="Meses" pontos={MESES} />);
    const grafico = screen.getByRole('img', { name: 'Meses' });
    expect(within(grafico).getByText('Out*')).toBeInTheDocument();
    expect(within(grafico).getByText('Set')).toBeInTheDocument();
    const barras = within(grafico).getAllByTestId('barra-mensal');
    expect(barras.map((b) => b.getAttribute('data-parcial'))).toEqual(['false', 'false', 'true']);
    // a parcial NÃO é a cor cheia da marca
    expect(barras[2].style.background).not.toBe(barras[0].style.background);
  });

  it('altura proporcional ao maior valor: o máximo ocupa 100% da área útil', () => {
    render(<BarrasMensais rotulo="Meses" pontos={MESES} altura={200} />);
    const alturas = screen.getAllByTestId('barra-mensal').map((b) => b.style.height);
    expect(alturas).toEqual(['200px', '100px', '50px']);
  });

  it('valor escrito acima e sub abaixo de cada barra', () => {
    render(<BarrasMensais rotulo="Meses" pontos={MESES} />);
    const grafico = screen.getByRole('img', { name: 'Meses' });
    expect(within(grafico).getByText('40%')).toBeInTheDocument();
    expect(within(grafico).getByText('208 alunos')).toBeInTheDocument();
  });

  it('série toda zerada não quebra: barras com altura 0', () => {
    render(<BarrasMensais rotulo="Zeros" pontos={MESES.map((p) => ({ ...p, valor: 0, texto: '0%' }))} />);
    expect(screen.getAllByTestId('barra-mensal').map((b) => b.style.height)).toEqual(['0px', '0px', '0px']);
  });

  it('alturaDaBarra: valor positivo nunca some (mínimo 2px) e 0 fica em 0', () => {
    expect(alturaDaBarra(1, 100000, 160)).toBe(2);
    expect(alturaDaBarra(0, 100, 160)).toBe(0);
    expect(alturaDaBarra(5, 0, 160)).toBe(0);
  });
});

describe('eixos da LinhaMensal (§10.6)', () => {
  it('% de acerto: floor(min − 5) a ceil(max + 5), múltiplos de 5', () => {
    expect(eixoPct([64.1, 66.4, 65.2])).toEqual({ min: 55, max: 75 });
    expect(eixoPct([60, 70])).toEqual({ min: 55, max: 75 });
  });

  it('% de acerto: fica dentro de [0, 100] e ignora null', () => {
    expect(eixoPct([2, 3])).toEqual({ min: 0, max: 10 });
    expect(eixoPct([97, 99, null])).toEqual({ min: 90, max: 100 });
    expect(eixoPct([null, null])).toEqual({ min: 0, max: 100 });
    expect(eixoPct([])).toEqual({ min: 0, max: 100 });
  });

  it('quantidade: 0 a ceil(max × 1,15) no múltiplo de 1.000 (questões) ou de 500 (conteúdos)', () => {
    expect(eixoQuantidade([21000, 25000, 3000])).toEqual({ min: 0, max: 29000 }); // 28.750 → 29.000
    expect(eixoQuantidade([1400, 800], 500)).toEqual({ min: 0, max: 2000 }); // 1.610 → 2.000
    expect(eixoQuantidade([1000], 500)).toEqual({ min: 0, max: 1500 }); // 1.150 → 1.500
  });

  it('quantidade: sem dado ou volume pequeno o teto é o próprio passo, nunca 0', () => {
    expect(eixoQuantidade([0, 0])).toEqual({ min: 0, max: 1000 });
    expect(eixoQuantidade([null])).toEqual({ min: 0, max: 1000 });
    expect(eixoQuantidade([12], 500)).toEqual({ min: 0, max: 500 });
  });
});

describe('LinhaMensal', () => {
  const pontosPct = [
    { mes: '2026-08', parcial: false, valor: 64.1 },
    { mes: '2026-09', parcial: false, valor: 66.4 },
    { mes: '2026-10', parcial: true, valor: 65.2 },
  ];
  const fmtPct = (v: number) => `${Math.round(v)}%`;

  it('é uma figura acessível, com a tabela alternativa e "—" para mês sem dado', () => {
    render(
      <LinhaMensal
        rotulo="Evolução do % de acerto"
        modo="pct"
        formatar={fmtPct}
        pontos={[...pontosPct.slice(0, 2), { mes: '2026-10', parcial: true, valor: null }]}
      />,
    );
    const figura = esperarFiguraAcessivel('Evolução do % de acerto');
    const linhas = within(figura).getAllByRole('row');
    expect(within(linhas[2]).getByRole('cell')).toHaveTextContent('66%');
    expect(within(linhas[3]).getByRole('rowheader')).toHaveTextContent('Out*');
    expect(within(linhas[3]).getByRole('cell')).toHaveTextContent('—');
  });

  it('eixo de % na faixa calculada (55% a 75%) com 3 marcas', () => {
    render(<LinhaMensal rotulo="Acerto" modo="pct" formatar={fmtPct} pontos={pontosPct} />);
    const grafico = screen.getByRole('img', { name: 'Acerto' });
    for (const marca of ['55%', '65%', '75%']) {
      expect(within(grafico).getAllByText(marca).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('eixo de quantidade: marcas 0, metade e teto', () => {
    render(
      <LinhaMensal
        rotulo="Questões"
        modo="quantidade"
        formatar={(v) => String(v)}
        pontos={[
          { mes: '2026-09', parcial: false, valor: 21000 },
          { mes: '2026-10', parcial: true, valor: 25000 },
        ]}
      />,
    );
    const grafico = screen.getByRole('img', { name: 'Questões' });
    expect(within(grafico).getByText('29000')).toBeInTheDocument();
    expect(within(grafico).getByText('14500')).toBeInTheDocument();
    expect(within(grafico).getByText('0')).toBeInTheDocument();
  });

  it('um ponto por mês com valor; o parcial tem miolo da cor do fundo e o fechado, da marca', () => {
    render(<LinhaMensal rotulo="Acerto" modo="pct" formatar={fmtPct} pontos={pontosPct} />);
    const pontos = screen.getAllByTestId('linha-ponto');
    expect(pontos).toHaveLength(3);
    expect(pontos.map((p) => p.getAttribute('data-parcial'))).toEqual(['false', 'false', 'true']);
    expect(pontos[2].style.background).toContain('--gp-surface-1');
    expect(pontos[0].style.background).toContain('--gp-brand');
  });

  it('desenha uma polyline e a área (8%) com preserveAspectRatio="none" e viewBox 1000×220', () => {
    const { container } = render(<LinhaMensal rotulo="Acerto" modo="pct" formatar={fmtPct} pontos={pontosPct} />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 1000 220');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    expect(screen.getAllByTestId('linha-serie')).toHaveLength(1);
    expect(screen.getByTestId('linha-area').getAttribute('fill-opacity')).toBe('0.08');
  });

  it('mês sem dado quebra a linha em trechos; trecho de 1 ponto fica só como ponto', () => {
    render(
      <LinhaMensal
        rotulo="Acerto"
        modo="pct"
        formatar={fmtPct}
        pontos={[
          { mes: '2026-06', parcial: false, valor: 60 },
          { mes: '2026-07', parcial: false, valor: null },
          { mes: '2026-08', parcial: false, valor: 70 },
          { mes: '2026-09', parcial: false, valor: 72 },
        ]}
      />,
    );
    expect(screen.getAllByTestId('linha-ponto')).toHaveLength(3);
    expect(screen.getAllByTestId('linha-serie')).toHaveLength(1);
  });

  it('o valor aparece sobre cada ponto até 12 meses; acima disso só na tabela alternativa', () => {
    const doze = Array.from({ length: 12 }, (_, i) => ({ mes: `2025-${String(i + 1).padStart(2, '0')}`, parcial: false, valor: 60 + i }));
    const { unmount } = render(<LinhaMensal rotulo="Doze" modo="pct" formatar={fmtPct} pontos={doze} />);
    const grafico = screen.getByRole('img', { name: 'Doze' });
    expect(within(grafico).getByText('71%')).toBeInTheDocument();
    unmount();

    const treze = Array.from({ length: 13 }, (_, i) => ({ mes: `2025-${String(i + 1).padStart(2, '0')}`.replace('2025-13', '2026-01'), parcial: false, valor: 60 + i }));
    render(<LinhaMensal rotulo="Treze" modo="pct" formatar={fmtPct} pontos={treze} />);
    const grafico13 = screen.getByRole('img', { name: 'Treze' });
    expect(within(grafico13).queryByText('72%')).toBeNull();
  });
});

describe('BarrasPorSemestre', () => {
  const linhas = Array.from({ length: 12 }, (_, i) => ({
    semestre: i + 1,
    valor: i === 4 ? null : (i + 1) * 100,
    texto: i === 4 ? '—' : String((i + 1) * 100),
  }));

  it('é uma figura acessível com as 12 linhas e "—" onde não há dado', () => {
    render(<BarrasPorSemestre rotulo="Questões por semestre" linhas={linhas} modo="quantidade" />);
    const figura = esperarFiguraAcessivel('Questões por semestre');
    const corpo = within(figura).getAllByRole('row').slice(1);
    expect(corpo).toHaveLength(12);
    expect(within(corpo[7]).getByRole('rowheader')).toHaveTextContent('8º semestre');
    expect(within(corpo[7]).getByRole('cell')).toHaveTextContent('800');
    expect(within(corpo[4]).getByRole('cell')).toHaveTextContent('—');
  });

  it('sem onSelecionar é só desenho: nenhum botão', () => {
    render(<BarrasPorSemestre rotulo="Q" linhas={linhas} modo="quantidade" />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('clicar chama onSelecionar com o semestre; o selecionado leva aria-pressed', async () => {
    const onSelecionar = vi.fn();
    const user = userEvent.setup();
    render(<BarrasPorSemestre rotulo="Q" linhas={linhas} modo="quantidade" selecionado={8} onSelecionar={onSelecionar} />);

    const botoes = screen.getAllByRole('button');
    expect(botoes).toHaveLength(12);
    expect(screen.getByRole('button', { name: '8º semestre: 800' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '3º semestre: 300' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '5º semestre: —' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '3º semestre: 300' }));
    expect(onSelecionar).toHaveBeenCalledWith(3);
  });

  it('modo quantidade: a maior linha ocupa a altura toda; modo pct: barra cheia = 100%', () => {
    const { unmount } = render(<BarrasPorSemestre rotulo="Q" linhas={linhas} modo="quantidade" altura={120} />);
    const alturas = screen.getAllByTestId('barra-semestre').map((b) => b.style.height);
    expect(alturas[11]).toBe('120px');
    expect(alturas[5]).toBe('60px'); // 600 de 1.200
    expect(alturas[4]).toBe('0px'); // sem dado
    unmount();

    render(
      <BarrasPorSemestre
        rotulo="P"
        modo="pct"
        altura={100}
        linhas={[{ semestre: 1, valor: 50, texto: '50%' }, { semestre: 2, valor: 100, texto: '100%' }]}
      />,
    );
    expect(screen.getAllByTestId('barra-semestre').map((b) => b.style.height)).toEqual(['50px', '100px']);
  });

  it('com seleção, as barras dos demais semestres clareiam', () => {
    render(<BarrasPorSemestre rotulo="Q" linhas={linhas} modo="quantidade" selecionado={2} />);
    const barras = screen.getAllByTestId('barra-semestre');
    expect(barras[1].style.background).not.toBe(barras[0].style.background);
    expect(barras[0].style.background).toBe(barras[2].style.background);
  });
});

describe('BarraHorizontal', () => {
  it('é só desenho: fora da árvore de acessibilidade, sem role="img"', () => {
    const { container } = render(<BarraHorizontal pct={40} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('largura do preenchimento = pct, cortada em [0, 100]', () => {
    const { container, rerender } = render(<BarraHorizontal pct={40} />);
    const preenchimento = () => (container.firstElementChild as HTMLElement).firstElementChild as HTMLElement;
    expect(preenchimento().style.width).toBe('40%');
    rerender(<BarraHorizontal pct={140} />);
    expect(preenchimento().style.width).toBe('100%');
    rerender(<BarraHorizontal pct={-5} />);
    expect(preenchimento().style.width).toBe('0%');
    rerender(<BarraHorizontal pct={Number.NaN} />);
    expect(preenchimento().style.width).toBe('0%');
  });

  it('marcador = traço da média, só quando informado', () => {
    const { rerender } = render(<BarraHorizontal pct={40} />);
    expect(screen.queryByTestId('barra-marcador')).toBeNull();
    rerender(<BarraHorizontal pct={40} marcador={63} />);
    expect(screen.getByTestId('barra-marcador').style.left).toBe('63%');
    rerender(<BarraHorizontal pct={40} marcador={null} />);
    expect(screen.queryByTestId('barra-marcador')).toBeNull();
  });

  it('aceita cor própria (token ou color-mix)', () => {
    const cor = 'color-mix(in srgb, var(--gp-brand) 45%, var(--gp-surface-1))';
    const { container } = render(<BarraHorizontal pct={40} cor={cor} />);
    const preenchimento = (container.firstElementChild as HTMLElement).firstElementChild as HTMLElement;
    expect(preenchimento.style.background).toContain('color-mix');
  });
});
