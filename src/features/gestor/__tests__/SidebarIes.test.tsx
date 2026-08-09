import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
  afterEach(() => vi.useRealTimers());

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

  it('trocar de IES limpa `?simulados=` — os ids pertenciam ao cronograma da IES anterior', async () => {
    comContexto(contexto('admin', true, TRES_IES));
    render(
      <MemoryRouter initialEntries={['/gestor/detalhamento?ies=ies-1&simulados=s1,s2']}>
        <SidebarIes />
        <Sonda />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('combobox', { name: /instituição/i }));
    fireEvent.click(
      await screen.findByText('IES Beta', { selector: '[role="option"] *, [role="option"]' }),
    );

    // Sem isso, a nova IES montava a tela inteira sobre uma seleção que não
    // existe no cronograma dela — sem chip marcado E sem o estado vazio
    // "Escolha ao menos um simulado", porque `selecionados.length` seguia > 0.
    await waitFor(() => {
      expect(screen.getByTestId('search').textContent).toBe('?ies=ies-2');
    });
  });

  it('carregando por MENOS que a regra dos 400ms: nenhum skeleton chega a aparecer (o flash que `useDelayedLoading` elimina)', () => {
    vi.useFakeTimers();
    mockUseGestorContexto.mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    renderizar();

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('carregando por MAIS que 400ms: reserva a MESMA caixa do cartão final (48px) e mostra o tile + DUAS barras de shimmer, sem número nem rótulo falso', () => {
    vi.useFakeTimers();
    mockUseGestorContexto.mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    renderizar();

    act(() => {
      vi.advanceTimersByTime(401);
    });

    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    // A regra de doc 04 §7 é a ALTURA FINAL: o skeleton usa a MESMA caixa
    // (`CARTAO`) do gatilho e do rótulo estático, então a sidebar não pula.
    expect(skeleton.style.minHeight).toBe('48px');
    expect(screen.queryByRole('combobox')).toBeNull();

    // Tile (32px) + coluna com duas barras (nome + linha de contexto).
    const [tile, coluna] = Array.from(skeleton.children) as HTMLElement[];
    expect(tile.style.width).toBe('32px');
    const barras = Array.from(coluna.children) as HTMLElement[];
    expect(barras).toHaveLength(2);
    expect(barras[0].style.height).toBe('12px');
    expect(barras[1].style.height).toBe('9px');
  });

  it('não existe rótulo "Instituição" acima do cartão — o nome acessível vem do aria-label', () => {
    comContexto(contexto('admin', true, TRES_IES));
    renderizar();
    expect(screen.queryByText(/^institui[çc][ãa]o$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Instituição em foco' })).toBeInTheDocument();
  });

  it('o cartão traz o tile de 32px com a sigla da IES e o glifo do Dendê', () => {
    comContexto(contexto('admin', true, TRES_IES));
    const { container } = renderizar();

    const gatilho = screen.getByRole('combobox', { name: /instituição/i });
    const tile = gatilho.firstElementChild as HTMLElement;
    expect(tile.style.width).toBe('32px');
    expect(tile.style.height).toBe('32px');
    expect(tile.getAttribute('aria-hidden')).toBe('true');
    expect(tile.textContent).toBe('IA'); // "IES Alfa"

    // Indicador de troca: glifo do Dendê de 16px, nunca ícone do Lucide.
    const glifo = container.querySelector('.icon-dende-icons-unfold_more-outlined') as HTMLElement;
    expect(glifo).not.toBeNull();
    expect(glifo.style.fontSize).toBe('16px');
    expect(gatilho.querySelectorAll('svg')).toHaveLength(0);
  });

  it('gestor (rótulo estático) reserva a mesma caixa do cartão, sem borda nem afordância de troca', () => {
    comContexto(contexto('gestor', false, [{ id: 'ies-1', nome: 'IES Alfa' }]));
    const { container } = renderizar();

    const cartao = screen.getByText('IES Alfa').closest('div[style*="min-height"]') as HTMLElement;
    expect(cartao.style.minHeight).toBe('48px');
    expect(cartao.style.border).toBe('');
    expect(container.querySelector('.icon-dende-icons-unfold_more-outlined')).toBeNull();
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

  it('?ies= fora do escopo (não está em iesDisponiveis) cai para a IES do contexto, em vez de deixar o seletor em branco (achado 17)', async () => {
    // Link colável de um admin apontando para uma IES que este destinatário
    // não acessa, ou bookmark de um gestor_grupo cuja IES saiu do grupo.
    comContexto(contexto('admin', true, TRES_IES));
    render(
      <MemoryRouter initialEntries={['/gestor?ies=ies-fora-do-escopo']}>
        <SidebarIes />
        <Sonda />
      </MemoryRouter>,
    );

    // Nunca em branco: cai para contexto.iesAtual ('IES Alfa'), que É uma das
    // opções do dropdown — a pessoa sempre tem um caminho de saída.
    await waitFor(() => {
      expect(screen.getByText('IES Alfa')).toBeInTheDocument();
    });
    expect(screen.queryByText('ies-fora-do-escopo')).not.toBeInTheDocument();

    // E a URL é corrigida — sem isso os hooks de dado (useCronograma etc.)
    // continuariam mandando o id inválido pra RPC.
    await waitFor(() => {
      expect(screen.getByTestId('search').textContent).toBe('?ies=ies-1');
    });
  });

  it('?ies= inválido não deixa o seletor sem nenhuma opção correspondente (o value do Select sempre casa com um SelectItem)', async () => {
    comContexto(contexto('gestor_grupo', true, TRES_IES.slice(0, 2)));
    render(
      <MemoryRouter initialEntries={['/gestor?ies=ies-que-saiu-do-grupo']}>
        <SidebarIes />
        <Sonda />
      </MemoryRouter>,
    );

    const combobox = await screen.findByRole('combobox', { name: /instituição/i });
    // Radix expõe o rótulo da opção selecionada dentro do trigger — nunca vazio.
    await waitFor(() => {
      expect(combobox.textContent).not.toBe('');
    });
    expect(screen.getByText('IES Alfa')).toBeInTheDocument();
  });

  it('gestor com rótulo estático: ?ies= inválido não quebra a tela e mantém o nome da IES do contexto (achado 17, cenário sem dropdown)', () => {
    comContexto(contexto('gestor', false, [{ id: 'ies-1', nome: 'IES Alfa' }]));
    render(
      <MemoryRouter initialEntries={['/gestor?ies=ies-inexistente']}>
        <SidebarIes />
        <Sonda />
      </MemoryRouter>,
    );
    expect(screen.getByText('IES Alfa')).toBeInTheDocument();
  });
});
