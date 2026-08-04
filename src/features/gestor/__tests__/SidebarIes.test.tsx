import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ContextoGestor } from '@/features/gestor/api/types';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockUseGestorContexto = vi.fn();
vi.mock('@/features/gestor/api/queries', () => ({
  useGestorContexto: () => mockUseGestorContexto(),
}));

import { SidebarIes } from '@/features/gestor/shell/SidebarIes';

const Sonda = () => <span data-testid="search">{useLocation().search}</span>;

const contexto = (
  papel: ContextoGestor['usuario']['papel'],
  podeTrocarIes: boolean,
  iesDisponiveis: { id: string; nome: string }[],
): ContextoGestor => ({
  usuario: { id: 'u1', nome: 'Ana Gestora', papel },
  iesDisponiveis,
  iesAtual: { id: 'ies-1', nome: 'IES Alfa' },
  contrato: null,
  podeTrocarIes,
  podeExportar: true,
});

const TRES_IES = [
  { id: 'ies-1', nome: 'IES Alfa' },
  { id: 'ies-2', nome: 'IES Beta' },
  { id: 'ies-3', nome: 'IES Gama' },
];

const renderizar = () =>
  render(
    <MemoryRouter initialEntries={['/gestor']}>
      <SidebarIes />
      <Sonda />
    </MemoryRouter>,
  );

describe('SidebarIes (spec §3)', () => {
  beforeAll(() => {
    // Radix Select precisa de scrollIntoView/hasPointerCapture, ausentes no
    // jsdom (mesmo padrão de src/test/components/admin/IesFeaturesBoard.test.tsx).
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => vi.clearAllMocks());

  const comContexto = (ctx: ContextoGestor) =>
    mockUseGestorContexto.mockReturnValue({
      data: ctx,
      meta: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

  it('admin: dropdown com todas as IES', () => {
    comContexto(contexto('admin', true, TRES_IES));
    renderizar();
    expect(screen.getByRole('combobox', { name: /instituição/i })).toBeInTheDocument();
    expect(screen.getByText('IES Alfa')).toBeInTheDocument();
  });

  it('gestor_grupo: dropdown com as IES do grupo', () => {
    comContexto(contexto('gestor_grupo', true, TRES_IES.slice(0, 2)));
    renderizar();
    expect(screen.getByRole('combobox', { name: /instituição/i })).toBeInTheDocument();
  });

  it('gestor: rótulo estático — NENHUM elemento clicável (caso de teste 13 da spec §12)', () => {
    comContexto(contexto('gestor', false, [{ id: 'ies-1', nome: 'IES Alfa' }]));
    renderizar();
    expect(screen.getByText('IES Alfa')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    // Nem desabilitado: simplesmente não é um controle.
    expect(document.querySelector('[disabled]')).toBeNull();
  });

  it('trocar de IES escreve a chave `ies` na URL', async () => {
    comContexto(contexto('admin', true, TRES_IES));
    renderizar();

    fireEvent.click(screen.getByRole('combobox', { name: /instituição/i }));
    const opcao = await screen.findByText('IES Beta', {
      selector: '[role="option"] *, [role="option"]',
    });
    fireEvent.click(opcao);

    await waitFor(() => {
      expect(screen.getByTestId('search').textContent).toBe('?ies=ies-2');
    });
  });

  it('carregando: reserva a altura do controle, sem número nem rótulo falso', () => {
    mockUseGestorContexto.mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    renderizar();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('semeia o iesId na URL com a IES do contexto quando ainda não há seleção (achado do Felipe, item 3a — sem isso nenhum hook de dado dispara no primeiro acesso)', async () => {
    comContexto(contexto('gestor', false, [{ id: 'ies-1', nome: 'IES Alfa' }]));
    renderizar();
    await waitFor(() => {
      expect(screen.getByTestId('search').textContent).toBe('?ies=ies-1');
    });
  });

  it('não sobrescreve um iesId já presente na URL (link colável com IES explícita)', async () => {
    comContexto(contexto('admin', true, TRES_IES));
    render(
      <MemoryRouter initialEntries={['/gestor?ies=ies-2']}>
        <SidebarIes />
        <Sonda />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('IES Beta')).toBeInTheDocument();
    });
    expect(screen.getByTestId('search').textContent).toBe('?ies=ies-2');
  });

  it('o rótulo do dropdown segue o iesId da URL, não o iesAtual do servidor (achado do Felipe, item 3b — get_gestor_contexto não recebe p_ies_id e não é reconsultado ao trocar)', async () => {
    // contexto.iesAtual fica travado em "IES Alfa" propositalmente — simula o
    // servidor não tendo recomputado nada após a troca de IES no cliente.
    comContexto(contexto('admin', true, TRES_IES));
    render(
      <MemoryRouter initialEntries={['/gestor?ies=ies-2']}>
        <SidebarIes />
        <Sonda />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('IES Beta')).toBeInTheDocument();
    });
    expect(screen.queryByText('IES Alfa')).not.toBeInTheDocument();
  });
});
