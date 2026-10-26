import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

// O layout do Engajamento é carregado sob demanda (`lazy`). A fábrica abaixo só roda quando o módulo é
// importado de fato — é o que o teste de prefetch do chunk observa (spec 2026-10-22-engajamento §10.2).
const mockChunkEngajamentoCarregado = vi.fn();
vi.mock('@/features/gestor/routes/engajamento/EngajamentoLayout', () => {
  mockChunkEngajamentoCarregado();
  return { default: () => null };
});

import { SidebarNav, GESTOR_V2_NAV } from '@/features/gestor/shell/SidebarNav';

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

/** Spec 2026-10-22-engajamento §10.2: 4 itens em 2 grupos, selo NOVO e prefetch do chunk. */
describe('SidebarNav — item Engajamento e grupos (spec 2026-10-22-engajamento §10.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  });

  it('tem 4 itens: Início solto e dois grupos, "Desempenho Institucional" (2 telas) e "Uso da plataforma" (Engajamento)', () => {
    expect(GESTOR_V2_NAV.map((i) => [i.title, i.url, i.grupo ?? null])).toEqual([
      ['Início', '/gestor', null],
      ['Visão Geral', '/gestor/visao-geral', 'Desempenho Institucional'],
      ['Detalhamento por Simulados', '/gestor/detalhamento', 'Desempenho Institucional'],
      ['Engajamento', '/gestor/engajamento', 'Uso da plataforma'],
    ]);
    renderizar('/gestor');
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });

  it('cada título de grupo aparece UMA vez, na ordem, como texto (não link) e no mesmo estilo', () => {
    renderizar('/gestor');
    const nav = screen.getByRole('navigation', { name: /seções do portal/i });
    const desempenho = within(nav).getByText('Desempenho Institucional');
    const uso = within(nav).getByText('Uso da plataforma');
    for (const titulo of [desempenho, uso]) {
      expect(titulo.tagName).not.toBe('A');
      expect(titulo.style.fontSize).toBe('10px');
      expect(titulo.style.textTransform).toBe('uppercase');
      expect(titulo.style.padding).toBe('18px 12px 8px');
    }

    // Ordem na tela: Início, [Desempenho], Visão Geral, Detalhamento, [Uso], Engajamento.
    const todos = Array.from(nav.querySelectorAll('a, div')).filter(
      (n) => n.tagName === 'A' || n === desempenho || n === uso,
    );
    const nomes = todos.map((n) => (n === desempenho ? 'G:desempenho' : n === uso ? 'G:uso' : n.textContent));
    expect(nomes).toEqual([
      'Início',
      'G:desempenho',
      'Visão Geral',
      'Detalhamento por Simulados',
      'G:uso',
      'Engajamento NOVO',
    ]);
  });

  it('o selo NOVO fica no item Engajamento, com aria-label "novo", e muda o nome acessível do link para "Engajamento novo"', () => {
    renderizar('/gestor');
    const link = screen.getByRole('link', { name: 'Engajamento novo' });
    expect(link).toHaveAttribute('href', '/gestor/engajamento');
    const selo = within(link).getByLabelText('novo');
    expect(selo).toHaveTextContent('NOVO');
    expect(selo.style.marginLeft).toBe('auto');
    expect(selo.style.fontSize).toBe('10px');
    expect(selo.style.fontWeight).toBe('700');
    expect(selo.style.letterSpacing).toBe('0.04em');
    expect(selo.style.padding).toBe('2px 6px');
    expect(selo.style.background).toBe('var(--gp-brand)');
    expect(selo.style.color).toBe('var(--gp-on-brand)');

    // Só o Engajamento leva selo.
    expect(screen.queryAllByLabelText('novo')).toHaveLength(1);
  });

  it('o link do Engajamento carrega a query string atual (o recorte sobrevive à troca de tela)', () => {
    renderizar('/gestor/visao-geral?ies=ies-1&semestre=geral');
    expect(screen.getByRole('link', { name: 'Engajamento novo' })).toHaveAttribute(
      'href',
      '/gestor/engajamento?ies=ies-1&semestre=geral',
    );
  });

  it('o Engajamento fica ativo em /gestor/engajamento e nas abas filhas', () => {
    renderizar('/gestor/engajamento/questoes?ies=ies-1');
    expect(screen.getByRole('link', { name: 'Engajamento novo' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
  });

  it('hover em "Engajamento" aquece o chunk do layout, e só nele (antes do hover o módulo nem é carregado)', async () => {
    renderizar('/gestor?ies=ies-1');
    expect(mockChunkEngajamentoCarregado).not.toHaveBeenCalled();

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Engajamento novo' }));

    await waitFor(() => expect(mockChunkEngajamentoCarregado).toHaveBeenCalled());
    // Não há função de prefetch de DADO para o Engajamento: só o chunk é aquecido.
    expect(mockPrefetchVisaoGeral).not.toHaveBeenCalled();
  });
});
