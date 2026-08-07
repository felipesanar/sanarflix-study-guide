import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Meta } from '@/features/gestor/api/types';

import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { BadgeStatus } from '@/features/gestor/components/BadgeStatus';
import { ChipNivel } from '@/features/gestor/components/ChipNivel';
import { TooltipRastreabilidade } from '@/features/gestor/components/TooltipRastreabilidade';
import { BlocoErrorBoundary } from '@/features/gestor/components/BlocoErrorBoundary';

describe('GestorSkeleton (spec §8.4 — reserva a altura final)', () => {
  it('reserva a altura recebida e se anuncia como carregando', () => {
    render(<GestorSkeleton altura={320} rotulo="Carregando evolução" />);
    const status = screen.getByRole('status', { name: 'Carregando evolução' });
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status.style.minHeight).toBe('320px');
  });

  it('aceita altura em unidade CSS', () => {
    render(<GestorSkeleton altura="20rem" />);
    expect(screen.getByRole('status').style.minHeight).toBe('20rem');
  });
});

describe('EstadoVazio', () => {
  it('mostra título e descrição, e nunca inventa número', () => {
    render(<EstadoVazio titulo="Sem simulados realizados" descricao="Escolha outro recorte." altura={200} />);
    expect(screen.getByText('Sem simulados realizados')).toBeInTheDocument();
    expect(screen.getByText('Escolha outro recorte.')).toBeInTheDocument();
    expect(screen.getByText('Sem simulados realizados').closest('div')?.textContent).not.toMatch(/\d/);
  });
});

describe('EstadoErro (spec §8.4 — retry por bloco)', () => {
  it('o botão "Tentar novamente" chama onRetry', () => {
    const onRetry = vi.fn();
    render(<EstadoErro onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('usa role=alert para anunciar a falha', () => {
    render(<EstadoErro titulo="Falha ao carregar a evolução" onRetry={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar a evolução');
  });
});

const META: Meta = {
  periodo: '2026.1 · 3 simulados',
  fonte: 'resultados_alunos_tri',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'proficiência >= 60',
  partial: false,
  lowSample: false,
};

describe('BadgeStatus (spec §6.4)', () => {
  it('cada status tem rótulo textual em português; previsto é "Previsto"', () => {
    const casos: Array<[Parameters<typeof BadgeStatus>[0]['status'], string]> = [
      ['realizado', 'Realizado'],
      ['agendado', 'Agendado'],
      ['reagendado', 'Reagendado'],
      ['previsto', 'Previsto'],
      ['processing', 'Em processamento'],
    ];
    for (const [status, rotulo] of casos) {
      const { unmount } = render(<BadgeStatus status={status} />);
      expect(screen.getByText(rotulo)).toBeInTheDocument();
      unmount();
    }
  });
});

describe('ChipNivel (spec §4.4)', () => {
  it('nunca comunica só por cor: sempre há rótulo textual', () => {
    const casos: Array<[Parameters<typeof ChipNivel>[0]['nivel'], string]> = [
      ['excelente', 'Excelente desempenho'],
      ['mediano', 'Desempenho mediano'],
      ['critico', 'Desempenho crítico'],
    ];
    for (const [nivel, rotulo] of casos) {
      const { unmount } = render(<ChipNivel nivel={nivel} />);
      expect(screen.getByText(rotulo)).toBeInTheDocument();
      unmount();
    }
  });

  /**
   * A cor vem de token **semântico**, não da paleta de gráfico.
   *
   * O `ChipNivel` improvisava `color-mix` sobre `--chart-1/3/--destructive` — a
   * escala de séries de gráfico, que existe para distinguir categorias lado a
   * lado, não para carregar juízo de valor. Nível de desempenho é semântica
   * (bom/atenção/ruim) e pede o par `on/surface` do handoff §5, que é o que o
   * `<TagNivel>` aplica. Este teste trava a origem do token, não o hex.
   */
  it('a cor vem de token semântico, nunca de hex solto nem da paleta de gráfico', () => {
    const { container } = render(<ChipNivel nivel="excelente" />);
    expect(container.innerHTML).toContain('--gp-success');
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(container.innerHTML).not.toMatch(/--chart-\d/);
  });
});

describe('TooltipRastreabilidade (spec §4.1)', () => {
  it('expõe Período · Fonte · Atualizado em · Critério, com o critério vindo do servidor', async () => {
    render(
      <TooltipProvider>
        <TooltipRastreabilidade meta={META} />
      </TooltipProvider>,
    );

    const gatilho = screen.getByRole('button', { name: /rastreabilidade/i });
    fireEvent.focus(gatilho);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Período');
    expect(tooltip).toHaveTextContent('2026.1 · 3 simulados');
    expect(tooltip).toHaveTextContent('Fonte');
    expect(tooltip).toHaveTextContent('resultados_alunos_tri');
    expect(tooltip).toHaveTextContent('Atualizado em');
    expect(tooltip).toHaveTextContent('26/07/2026');
    expect(tooltip).toHaveTextContent('Critério');
    expect(tooltip).toHaveTextContent('proficiência >= 60');
  });

  it('converte o instante para o fuso de Brasília, não a data-calendário UTC (achado 05/08)', async () => {
    // atualizadoEm é timestamptz UTC (RPCs emitem `now() AT TIME ZONE 'UTC'`).
    // 2026-08-06T01:10:00Z é 05/08/2026 22:10 em Brasília (UTC-3) — ainda o
    // dia 05, embora a data-calendário UTC já seja 06. Ler os dígitos do ISO
    // sem converter fuso (o que `formatData` de lib/formatters.ts faz de
    // propósito para datas de cronograma) mostraria "06/08/2026", uma data no
    // futuro para quem está em Brasília.
    const metaTardeDaNoite: Meta = {
      ...META,
      atualizadoEm: '2026-08-06T01:10:00Z',
    };

    render(
      <TooltipProvider>
        <TooltipRastreabilidade meta={metaTardeDaNoite} />
      </TooltipProvider>,
    );

    // O span sr-only renderiza sempre, sem depender de hover/focus.
    expect(screen.getByTestId('rastreabilidade-texto')).toHaveTextContent('05/08/2026');
    expect(screen.getByTestId('rastreabilidade-texto')).not.toHaveTextContent('06/08/2026');

    const gatilho = screen.getByRole('button', { name: /rastreabilidade/i });
    fireEvent.focus(gatilho);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('05/08/2026');
    expect(tooltip).not.toHaveTextContent('06/08/2026');
  });

  /**
   * `meta.lowSample` é parte de "de onde vem este número". `KpiCard` já tem o
   * selo visível "cobertura parcial", mas `ContextoDoRecorte` — o outro
   * consumidor deste tooltip — não tinha canal nenhum para o aviso e afirmava
   * procedência como se a cobertura fosse completa.
   */
  it('com meta.lowSample, declara cobertura parcial no tooltip e no texto sr-only', async () => {
    render(
      <TooltipProvider>
        <TooltipRastreabilidade meta={{ ...META, lowSample: true }} />
      </TooltipProvider>,
    );

    expect(screen.getByTestId('rastreabilidade-texto')).toHaveTextContent(
      'Cobertura: parcial (amostra pequena)',
    );

    fireEvent.focus(screen.getByRole('button', { name: /rastreabilidade/i }));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Cobertura');
    expect(tooltip).toHaveTextContent('parcial (amostra pequena)');
  });

  it('sem lowSample, nenhuma linha de cobertura é inventada', () => {
    render(
      <TooltipProvider>
        <TooltipRastreabilidade meta={META} />
      </TooltipProvider>,
    );

    expect(screen.getByTestId('rastreabilidade-texto')).not.toHaveTextContent('Cobertura');
  });

  /**
   * Achado F5 (revisão final): `TooltipContent` herda a classe `border` SEM
   * cor do primitivo compartilhado (`src/components/ui/tooltip.tsx`) — sem
   * `borderColor` no `style`, o anel resolve para `hsl(var(--border))`, um
   * cinza-claro contra a superfície escura que o item A6 usa nos dois temas.
   */
  it('a borda do tooltip usa --gp-tooltip-surface — nunca a borda cinza-clara herdada do primitivo (F5)', async () => {
    render(
      <TooltipProvider>
        <TooltipRastreabilidade meta={META} />
      </TooltipProvider>,
    );

    fireEvent.focus(screen.getByRole('button', { name: /rastreabilidade/i }));
    // O role="tooltip" cai no <span> sr-only que o Radix usa para a
    // descrição acessível — o balão VISÍVEL (que carrega o `style` real) é
    // o irmão renderizado por TooltipPrimitive.Content, sem esse role.
    await screen.findByRole('tooltip');
    const balao = document.querySelector('[data-radix-popper-content-wrapper] [data-side]');
    expect(balao?.getAttribute('style')).toContain('border-color: var(--gp-tooltip-surface)');
  });
});

describe('BlocoErrorBoundary (spec §8.4 — boundary POR BLOCO)', () => {
  beforeEach(() => {
    // react-error-boundary loga a exceção; silenciado para não poluir a saída.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  const Explode = ({ quebrar }: { quebrar: boolean }) => {
    if (quebrar) throw new Error('gráfico quebrou');
    return <div>gráfico ok</div>;
  };

  it('isola a falha: o bloco vizinho continua na tela', () => {
    render(
      <>
        <BlocoErrorBoundary bloco="evolucao">
          <Explode quebrar />
        </BlocoErrorBoundary>
        <BlocoErrorBoundary bloco="areas">
          <div>bloco vizinho intacto</div>
        </BlocoErrorBoundary>
      </>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('bloco vizinho intacto')).toBeInTheDocument();
    expect(screen.queryByText('gráfico ok')).not.toBeInTheDocument();
  });

  it('"Tentar novamente" remonta o bloco', () => {
    // A falha é transitória: o reset do boundary remonta os filhos e, resolvida
    // a causa, o segundo render não quebra. O gatilho é uma flag externa porque
    // estado de componente é perdido no remount (o que quebrou no render nem
    // chega a montar).
    let deveQuebrar = true;
    const Instavel = () => {
      if (deveQuebrar) throw new Error('gráfico quebrou');
      return <div>gráfico ok</div>;
    };

    render(
      <BlocoErrorBoundary bloco="evolucao">
        <Instavel />
      </BlocoErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    deveQuebrar = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(screen.getByText('gráfico ok')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
