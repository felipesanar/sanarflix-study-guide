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
  it('cada status tem rótulo textual em português; previsto é "A definir"', () => {
    const casos: Array<[Parameters<typeof BadgeStatus>[0]['status'], string]> = [
      ['realizado', 'Realizado'],
      ['agendado', 'Agendado'],
      ['reagendado', 'Reagendado'],
      ['previsto', 'A definir'],
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
      ['excelente', 'Excelente'],
      ['mediano', 'Mediano'],
      ['critico', 'Crítico'],
    ];
    for (const [nivel, rotulo] of casos) {
      const { unmount } = render(<ChipNivel nivel={nivel} />);
      expect(screen.getByText(rotulo)).toBeInTheDocument();
      unmount();
    }
  });

  it('a cor vem de token, nunca de hex solto', () => {
    const { container } = render(<ChipNivel nivel="excelente" />);
    expect(container.innerHTML).toContain('hsl(var(--chart-1))');
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}/);
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
