import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ContextoGestor } from '@/features/gestor/api/types';

/**
 * `SidebarNav` (Onda 2/B1) passou a chamar `useQueryClient()` — prefetch no
 * hover de "Visão Geral" (`prefetchVisaoGeral`). Sem um `QueryClientProvider`
 * na árvore, `GestorShell` (que monta `SidebarNav`) explode em qualquer
 * render deste arquivo. Uma instância nova por render, como qualquer outro
 * teste do repo que precisa de QueryClient — sem cache compartilhado entre
 * casos de teste.
 */
const criarQueryClient = () => new QueryClient();

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

// O shell não busca dado de IES — o SidebarIes busca. Aqui ele é neutralizado.
vi.mock('@/features/gestor/shell/SidebarIes', () => ({
  SidebarIes: () => <div>IES Alfa</div>,
}));

// O papel (achado 108: link "Portal do Admin" no rodapé) vem de
// get_gestor_contexto — mesma RPC/hook que o SidebarIes usa para
// `podeTrocarIes`. Mockado aqui para controlar o papel por teste.
const mockUseGestorContexto = vi.fn();
vi.mock('@/features/gestor/api/queries', () => ({
  useGestorContexto: () => mockUseGestorContexto(),
}));

import { GestorShell } from '@/features/gestor/shell/GestorShell';
import { GESTOR_V2_NAV } from '@/features/gestor/shell/SidebarNav';

const contextoComPapel = (papel: ContextoGestor['usuario']['papel']): ContextoGestor => ({
  usuario: { id: 'u1', nome: 'Ana Gestora', papel },
  iesDisponiveis: [{ id: 'ies-1', nome: 'IES Alfa' }],
  iesAtual: { id: 'ies-1', nome: 'IES Alfa' },
  contrato: null,
  podeTrocarIes: papel !== 'gestor',
  podeExportar: true,
});

const renderizar = (rota: string) =>
  render(
    <QueryClientProvider client={criarQueryClient()}>
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
      </ThemeProvider>
    </QueryClientProvider>,
  );

describe('GestorShell (spec §8.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', nome: 'Ana Gestora', email: 'ana@ies.edu.br', ies_nome: 'IES Alfa' },
      // O alternador de experiência lê `access.experiences` (espelho da RPC
      // get_access): aluno é a base de todos, gestão é o portal atual.
      access: { roles: ['gestor'], experiences: ['aluno', 'gestao'], capabilities: [] },
      logout: vi.fn(),
    });
    // Papel padrão dos testes existentes: gestor comum — sem o link de admin.
    mockUseGestorContexto.mockReturnValue({
      data: contextoComPapel('gestor'),
      meta: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('a nav tem exatamente os 3 itens do portal v2, com o rótulo completo do 3º (referência)', () => {
    renderizar('/gestor');
    expect(GESTOR_V2_NAV.map((i) => i.title)).toEqual([
      'Início',
      'Visão Geral',
      'Detalhamento por Simulados',
    ]);
    const nav = screen.getByRole('navigation', { name: /seções do portal/i });
    expect(nav.querySelectorAll('a')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/gestor');
    expect(screen.getByRole('link', { name: 'Visão Geral' })).toHaveAttribute('href', '/gestor/visao-geral');
    expect(screen.getByRole('link', { name: 'Detalhamento por Simulados' })).toHaveAttribute(
      'href',
      '/gestor/detalhamento',
    );
  });

  it('a nav agrupa as duas telas de análise sob o overline "Desempenho Institucional"', () => {
    renderizar('/gestor');
    const nav = screen.getByRole('navigation', { name: /seções do portal/i });
    const grupo = within(nav).getByText('Desempenho Institucional');

    // Título de GRUPO: 10px/600, 0.06em, uppercase, em --gp-text-3 — um degrau
    // ABAIXO do overline "Portal do Gestor" (11px/0.1em), de propósito. Nos
    // 11px/0.1em o rótulo não cabia na coluna de 240px, quebrava em duas linhas
    // e competia em peso com os próprios itens de nav que rotula.
    expect(grupo.style.fontSize).toBe('10px');
    expect(grupo.style.fontWeight).toBe('600');
    expect(grupo.style.letterSpacing).toBe('0.06em');
    expect(grupo.style.textTransform).toBe('uppercase');

    // Texto, não link — o grupo não é focável nem navegável.
    expect(grupo.tagName).not.toBe('A');

    // Início fica ACIMA do grupo; Visão Geral e Detalhamento, abaixo.
    const filhos = Array.from(nav.children);
    const posGrupo = filhos.findIndex((n) => n.contains(grupo));
    const posInicio = filhos.findIndex((n) =>
      n.contains(screen.getByRole('link', { name: 'Início' })),
    );
    const posVisao = filhos.findIndex((n) =>
      n.contains(screen.getByRole('link', { name: 'Visão Geral' })),
    );
    expect(posInicio).toBeLessThan(posGrupo);
    expect(posGrupo).toBeLessThanOrEqual(posVisao);
  });

  it('marca o item ativo pela rota — e /gestor só fica ativo em correspondência exata', () => {
    renderizar('/gestor/visao-geral');
    expect(screen.getByRole('link', { name: 'Visão Geral' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');

    renderizar('/gestor');
    const inicios = screen.getAllByRole('link', { name: 'Início' });
    expect(inicios[inicios.length - 1]).toHaveAttribute('aria-current', 'page');
  });

  it('item ativo: superfície de marca, texto de marca e barra vertical de 3px à esquerda', () => {
    renderizar('/gestor/visao-geral');
    const ativo = screen.getByRole('link', { name: 'Visão Geral' });

    // Tinta de marca por token, nos dois temas — nunca o cinza de sidebar.
    expect(ativo.className).toContain('text-[color:var(--gp-brand-strong)]');
    expect(ativo.className).toContain('dark:text-[color:var(--gp-brand-on-dark)]');
    expect(ativo.className).toContain('font-semibold');
    expect(ativo.style.borderRadius).toBe('var(--gp-radius-sm)');

    // Barra de 3px absoluta, colada à esquerda, decorativa.
    const barra = ativo.firstElementChild as HTMLElement;
    expect(barra.getAttribute('aria-hidden')).toBe('true');
    expect(barra.style.position).toBe('absolute');
    expect(barra.style.left).toBe('0px');
    expect(barra.style.width).toBe('3px');

    // O item inativo não tem barra nem tinta de marca.
    const inativo = screen.getByRole('link', { name: 'Início' });
    expect(inativo.querySelector('[aria-hidden="true"][style*="absolute"]')).toBeNull();
    expect(inativo.className).toContain('text-[color:var(--gp-text-2)]');
  });

  it('ícones da nav são glifos do Dendê, com filled no ativo e outlined em repouso', () => {
    const { container } = renderizar('/gestor/visao-geral');

    // Ativo = -filled na caixa óptica de 20px; inativos = -outlined.
    expect(container.querySelector('.icon-dende-icons-equalizer-filled')).not.toBeNull();
    expect(container.querySelector('.icon-dende-icons-home-outlined')).not.toBeNull();
    expect(container.querySelector('.icon-dende-icons-insights-outlined')).not.toBeNull();
    expect(container.querySelector('.icon-dende-icons-equalizer-outlined')).toBeNull();

    const caixa = container.querySelector('.icon-dende-icons-equalizer-filled')
      ?.parentElement as HTMLElement;
    expect(caixa.style.width).toBe('20px');
    expect((container.querySelector('.icon-dende-icons-equalizer-filled') as HTMLElement).style.fontSize).toBe('18px');

    // Nenhum SVG na sidebar da nav — a família é uma só (Fontello do Dendê).
    const nav = screen.getByRole('navigation', { name: /seções do portal/i });
    expect(nav.querySelectorAll('svg')).toHaveLength(0);
  });

  it('NÃO tem header no topo do conteúdo', () => {
    const { container } = renderizar('/gestor');
    expect(container.querySelector('header')).toBeNull();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('sidebar de 240px com lockup de altura mínima 48px (claro e escuro) e conteúdo rolável', () => {
    const { container } = renderizar('/gestor');

    const aside = container.querySelector('aside') as HTMLElement;
    expect(aside).not.toBeNull();
    expect(aside).toHaveClass('w-60'); // 240px via token, sem px solto
    // Coluna fixa só de `lg` para cima: abaixo disso o mesmo conteúdo vai para
    // o drawer da barra superior (auditoria de 09/08, B7).
    expect(aside).toHaveClass('hidden');
    expect(aside).toHaveClass('lg:flex');

    // Escopado ao `aside`: a barra superior do mobile repete a marca, mas lá
    // ela é decorativa (`alt=""`), então só a da sidebar tem nome acessível.
    const lockup = within(aside).getByAltText('SanarFlix Academy');
    expect(lockup).toHaveAttribute('src', '/sanarflix-academy-lockup.svg');
    expect(lockup).toHaveClass('h-12'); // 48px (spec §8.3)
    expect(lockup).toHaveClass('dark:hidden');

    const lockupDark = aside.querySelector('img[src="/sanarflix-academy-lockup-white.svg"]');
    expect(lockupDark).not.toBeNull();
    expect(lockupDark).toHaveClass('dark:block');
    // Nunca filter: invert() na marca (spec §8.3).
    expect(container.innerHTML).not.toContain('invert');

    const main = container.querySelector('main');
    expect(main).toHaveClass('overflow-y-auto');
    expect(main?.textContent).toContain('conteúdo do início');
  });

  it('a navegação do shell fica atrás de um drawer abaixo de lg', () => {
    const { container } = renderizar('/gestor');

    const gatilho = screen.getByRole('button', { name: 'Abrir menu do portal' });
    // A barra que hospeda o gatilho desaparece de `lg` para cima, quando a
    // sidebar volta a ser coluna fixa.
    expect(gatilho.parentElement).toHaveClass('lg:hidden');
    expect(container.querySelector('aside')).toHaveClass('lg:flex');
  });

  it('o lockup vem acompanhado do overline "Portal do Gestor" (11px/600/0.1em uppercase)', () => {
    const { container } = renderizar('/gestor');
    const aside = container.querySelector('aside') as HTMLElement;
    const overline = within(aside).getByText('Portal do Gestor');
    expect(overline.style.fontSize).toBe('11px');
    expect(overline.style.fontWeight).toBe('600');
    expect(overline.style.letterSpacing).toBe('0.1em');
    expect(overline.style.textTransform).toBe('uppercase');
    expect(overline.style.color).toBe('var(--gp-text-3)');

    // Mesmo bloco do lockup, fechado por divisor.
    const bloco = overline.parentElement as HTMLElement;
    expect(bloco.querySelector('img[alt="SanarFlix Academy"]')).not.toBeNull();
    expect(bloco.style.borderBottom).toContain('var(--gp-border-subtle)');
  });


  it('rodapé traz o perfil do usuário: avatar de 34px, nome 13px/600 e o PAPEL abaixo (nunca o e-mail)', () => {
    renderizar('/gestor');

    const nome = screen.getByText('Ana Gestora');
    expect(nome.style.fontSize).toBe('13px');
    expect(nome.style.fontWeight).toBe('600');

    // Segunda linha = papel vindo do servidor, não o e-mail (que vai para o title).
    expect(screen.getByText('Gestão acadêmica')).toBeInTheDocument();
    expect(screen.queryByText('ana@ies.edu.br')).not.toBeInTheDocument();
    expect((nome.parentElement as HTMLElement).title).toBe('ana@ies.edu.br');

    const avatar = nome.parentElement?.previousElementSibling as HTMLElement;
    expect(avatar.style.width).toBe('34px');
    expect(avatar.style.height).toBe('34px');
    expect(avatar.style.background).toBe('var(--gp-brand-surface)');
    expect(avatar.textContent).toBe('AG');

    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });

  it('rodapé traz o sino de avisos: 32px, glifo do Dendê de 18px, com nome acessível', () => {
    renderizar('/gestor');
    const sino = screen.getByRole('button', { name: 'Avisos da Sanar' });
    expect(sino.style.width).toBe('32px');
    expect(sino.style.height).toBe('32px');
    expect(sino.style.borderRadius).toBe('var(--gp-radius-sm)');

    const glifo = sino.querySelector('.icon-dende-icons-notifications-outlined') as HTMLElement;
    expect(glifo).not.toBeNull();
    expect(glifo.style.fontSize).toBe('18px');
  });

  it('o papel exibido acompanha o que o servidor devolve', () => {
    mockUseGestorContexto.mockReturnValue({
      data: contextoComPapel('admin'),
      meta: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderizar('/gestor');
    expect(screen.getByText('Administração')).toBeInTheDocument();
    expect(screen.queryByText('Gestão acadêmica')).not.toBeInTheDocument();
  });

  it('nenhum ícone da sidebar é SVG — 100% Fontello do Dendê nos glifos do próprio shell', () => {
    mockUseGestorContexto.mockReturnValue({
      data: contextoComPapel('admin'),
      meta: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderizar('/gestor');

    // Os glifos que o shell desenha: sino e "Sair".
    expect(document.querySelector('.icon-dende-icons-notifications-outlined')).not.toBeNull();
    expect(document.querySelector('.icon-dende-icons-logout-outlined')).not.toBeNull();

    // `ThemeToggle` e `ExperienceSwitcher` são compartilhados com aluno/admin e
    // seguem no Lucide — por isso o alvo aqui é o botão, não a sidebar inteira.
    expect(screen.getByRole('button', { name: /sair/i }).querySelectorAll('svg')).toHaveLength(0);
  });

  describe('troca de experiência no rodapé (portal não é item de navegação)', () => {
    it('o rodapé traz o alternador de experiência, com a experiência ATUAL no nome acessível, e fora da nav de 3 itens', () => {
      renderizar('/gestor');

      const alternador = screen.getByRole('button', { name: /experiência atual: gestão/i });
      expect(alternador).toBeInTheDocument();

      const nav = screen.getByRole('navigation', { name: /seções do portal/i });
      expect(within(nav).queryByRole('button', { name: /trocar de experiência/i })).not.toBeInTheDocument();
    });

    it('os antigos botões avulsos de portal saíram do shell', () => {
      mockUseGestorContexto.mockReturnValue({
        data: contextoComPapel('admin'),
        meta: undefined,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderizar('/gestor');

      expect(screen.queryByRole('button', { name: 'Portal do Admin' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Ir para versão aluno' })).not.toBeInTheDocument();
    });

    it('não renderiza alternador nenhum para quem só tem a experiência de aluno', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'u1', nome: 'Ana Gestora', email: 'ana@ies.edu.br', ies_nome: 'IES Alfa' },
        access: { roles: [], experiences: ['aluno'], capabilities: [] },
        logout: vi.fn(),
      });
      renderizar('/gestor');

      expect(screen.queryByRole('button', { name: /trocar de experiência/i })).not.toBeInTheDocument();
    });
  });
});

/**
 * Os dois contêineres roláveis do shell precisam ser `position: relative`.
 *
 * Sem isso, todo descendente `position:absolute` resolve contra o VIEWPORT
 * INICIAL em vez de contra o contêiner — e o `.sr-only` do Tailwind é
 * justamente `position:absolute`. A posição estática dele fica onde ele aparece
 * no fluxo, lá embaixo num conteúdo de 3400px, então o `<html>` crescia para
 * 2486px num viewport de 891: o documento ganhava barra de rolagem PRÓPRIA
 * além da do conteúdo (o "scroll duplo") e sobrava uma faixa vazia abaixo do
 * app.
 *
 * Só aparecia no Detalhamento, porque é a tela cujo conteúdo passa da altura da
 * janela por margem suficiente para o `sr-only` cair fora — o que fez o defeito
 * parecer intermitente e específico de tela.
 *
 * jsdom não faz layout, então este teste guarda a CAUSA (a classe), não o
 * efeito. A medição do efeito foi feita no navegador real:
 * `documentElement.scrollHeight` caiu de 2486 para 891 ao aplicar `relative`.
 */
describe('GestorShell — contêineres roláveis ancoram os absolutos', () => {
  it('o main e o aside são position:relative', () => {
    const { container } = renderizar("/gestor");

    const main = container.querySelector('main');
    const aside = container.querySelector('aside');

    expect(main?.className, 'sem `relative` o conteúdo rolável estica o documento').toContain('relative');
    expect(aside?.className, 'a sidebar rola e tem a mesma armadilha').toContain('relative');
  });

  it('o shell usa h-dvh e trava o overscroll — nunca h-screen', () => {
    const { container } = renderizar("/gestor");
    const shell = container.querySelector('.gestor-portal');

    expect(shell?.className).toContain('h-dvh');
    expect(shell?.className).not.toContain('h-screen');
    expect(shell?.className).toContain('overflow-hidden');
  });
});
