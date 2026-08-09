import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Onda 2/B1 (`docs/superpowers/plans/2026-08-09-gestor-motion-e-loading.md`):
 * indicador de página ativa deslizando, ícone com transição de cor e
 * prefetch no hover de cada item. `GestorShell.test.tsx` já trava a anatomia
 * ESTÁTICA do item ativo (superfície, barra de 3px, ícone filled/outlined) —
 * este arquivo cobre só o que é NOVO nesta rodada, sem duplicar aquela
 * cobertura.
 */

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

const mockPrefetchVisaoGeral = vi.fn().mockResolvedValue(undefined);
vi.mock('@/features/gestor/api/prefetch', () => ({
  prefetchVisaoGeral: (...args: unknown[]) => mockPrefetchVisaoGeral(...args),
}));

import { SidebarNav } from '@/features/gestor/shell/SidebarNav';

const renderizar = (rota: string) => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[rota]}>
        <SidebarNav />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('SidebarNav — motion e prefetch (Onda 2/B1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  });

  it('ícone de cada item declara a transição de color (80ms/--gp-ease), ativo e inativo', () => {
    const { container } = renderizar('/gestor/visao-geral?ies=ies-1');

    const ativo = container.querySelector('.icon-dende-icons-equalizer-filled')
      ?.parentElement as HTMLElement;
    const inativo = container.querySelector('.icon-dende-icons-home-outlined')
      ?.parentElement as HTMLElement;

    for (const caixa of [ativo, inativo]) {
      expect(caixa.className).toContain('transition-[color]');
      expect(caixa.className).toContain('[transition-duration:80ms]');
      expect(caixa.className).toContain('[transition-timing-function:cubic-bezier(0.2,0,0,1)]');
    }
  });

  it('hover em "Visão Geral" aquece a Visão Geral com o iesId/semestre da URL e o user.id do contexto', () => {
    renderizar('/gestor?ies=ies-1&semestre=geral');

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Visão Geral' }));

    expect(mockPrefetchVisaoGeral).toHaveBeenCalledTimes(1);
    const [, userId, iesId, semestre] = mockPrefetchVisaoGeral.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(iesId).toBe('ies-1');
    expect(semestre).toBe('geral');
  });

  it('hover em "Visão Geral" SEM iesId na URL não aquece nada (não há o que aquecer ainda)', () => {
    renderizar('/gestor');

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Visão Geral' }));

    expect(mockPrefetchVisaoGeral).not.toHaveBeenCalled();
  });

  it('hover em "Início" e em "Detalhamento por Simulados" não aquece a Visão Geral — cada um só aquece o próprio destino, e Detalhamento ainda não tem função de prefetch dedicada', () => {
    renderizar('/gestor?ies=ies-1');

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Início' }));
    fireEvent.mouseEnter(
      screen.getByRole('link', { name: 'Detalhamento por Simulados' }),
    );

    expect(mockPrefetchVisaoGeral).not.toHaveBeenCalled();
  });
});
