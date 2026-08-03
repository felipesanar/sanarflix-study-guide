import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

// O shell não busca dado de IES — o SidebarIes busca. Aqui ele é neutralizado.
vi.mock('@/features/gestor/shell/SidebarIes', () => ({
  SidebarIes: () => <div>IES Alfa</div>,
}));

import { GestorShell } from '@/features/gestor/shell/GestorShell';
import { GESTOR_V2_NAV } from '@/features/gestor/shell/SidebarNav';

const renderizar = (rota: string) =>
  render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/gestor" element={<GestorShell />}>
            <Route index element={<div>conteúdo do início</div>} />
            <Route path="visao-geral" element={<div>conteúdo da visão geral</div>} />
            <Route path="detalhamento" element={<div>conteúdo do detalhamento</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe('GestorShell (spec §8.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', nome: 'Ana Gestora', email: 'ana@ies.edu.br', ies_nome: 'IES Alfa' },
      logout: vi.fn(),
    });
  });

  it('a nav tem exatamente os 3 itens do portal v2', () => {
    renderizar('/gestor');
    expect(GESTOR_V2_NAV.map((i) => i.title)).toEqual([
      'Início',
      'Visão Geral',
      'Detalhamento',
    ]);
    const nav = screen.getByRole('navigation', { name: /seções do portal/i });
    expect(nav.querySelectorAll('a')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/gestor');
    expect(screen.getByRole('link', { name: 'Visão Geral' })).toHaveAttribute('href', '/gestor/visao-geral');
    expect(screen.getByRole('link', { name: 'Detalhamento' })).toHaveAttribute('href', '/gestor/detalhamento');
  });

  it('marca o item ativo pela rota — e /gestor só fica ativo em correspondência exata', () => {
    renderizar('/gestor/visao-geral');
    expect(screen.getByRole('link', { name: 'Visão Geral' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');

    renderizar('/gestor');
    const inicios = screen.getAllByRole('link', { name: 'Início' });
    expect(inicios[inicios.length - 1]).toHaveAttribute('aria-current', 'page');
  });

  it('NÃO tem header no topo do conteúdo', () => {
    const { container } = renderizar('/gestor');
    expect(container.querySelector('header')).toBeNull();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('sidebar de 240px com lockup de altura mínima 48px (claro e escuro) e conteúdo rolável', () => {
    const { container } = renderizar('/gestor');

    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside).toHaveClass('w-60'); // 240px via token, sem px solto

    const lockup = screen.getByAltText('SanarFlix Academy');
    expect(lockup).toHaveAttribute('src', '/sanarflix-academy-lockup.svg');
    expect(lockup).toHaveClass('h-12'); // 48px (spec §8.3)
    expect(lockup).toHaveClass('dark:hidden');

    const lockupDark = container.querySelector('img[src="/sanarflix-academy-lockup-white.svg"]');
    expect(lockupDark).not.toBeNull();
    expect(lockupDark).toHaveClass('dark:block');
    // Nunca filter: invert() na marca (spec §8.3).
    expect(container.innerHTML).not.toContain('invert');

    const main = container.querySelector('main');
    expect(main).toHaveClass('overflow-y-auto');
    expect(main?.textContent).toContain('conteúdo do início');
  });

  it('rodapé traz o perfil do usuário', () => {
    renderizar('/gestor');
    expect(screen.getByText('Ana Gestora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });

  it('rodapé traz o botão "Ir para versão aluno", fora da nav de 3 itens (Task 25)', () => {
    renderizar('/gestor');

    const botao = screen.getByRole('button', { name: 'Ir para versão aluno' });
    expect(botao).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: /seções do portal/i });
    expect(
      within(nav).queryByRole('button', { name: 'Ir para versão aluno' }),
    ).not.toBeInTheDocument();
  });

  it('clicar em "Ir para versão aluno" navega para a home do aluno', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <MemoryRouter initialEntries={['/gestor']}>
          <Routes>
            <Route path="/" element={<div>experiência do aluno</div>} />
            <Route path="/gestor" element={<GestorShell />}>
              <Route index element={<div>conteúdo do início</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ir para versão aluno' }));
    expect(screen.getByText('experiência do aluno')).toBeInTheDocument();
  });
});
