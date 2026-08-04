import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, type RouteObject } from 'react-router-dom';

// O setup global troca useLocation por () => ({ pathname: '/' }); aqui
// precisamos do router real (medido: sem esta linha o pathname vira '/').
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

// Os dois shells são stubados: esta suíte verifica QUAL shell a flag escolhe,
// não o conteúdo de cada um (e evita arrastar o módulo de analytics legado).
vi.mock('@/features/gestor/shell/GestorShell', () => ({
  GestorShell: () => <div>shell v2</div>,
}));
vi.mock('@/experiences/gestor/GestorLayout', () => ({
  GestorLayout: () => <div>layout legado</div>,
}));
// GestorIndexSwitch delega pro GestorIndexRedirect existente quando o portal
// v2 está efetivamente desligado (flag off OU escape de admin do card 108).
// Stub SÓ o redirect (mock parcial — `GestorFeatureGate` continua real, pois
// `gestorRoutes()` usa ele nas 5 telas legadas): esta suíte testa SÓ a decisão
// de ramo, não o comportamento interno do redirect (que tem suíte própria em
// gestorFeatureGate.test.tsx).
vi.mock('@/experiences/gestor/GestorFeatureGate', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/experiences/gestor/GestorFeatureGate')>();
  return {
    ...original,
    GestorIndexRedirect: () => <div>index redirect legado</div>,
  };
});

const mockUseEffectiveFeatures = vi.fn();
vi.mock('@/hooks/useEffectiveFeatures', () => ({
  useEffectiveFeatures: () => mockUseEffectiveFeatures(),
}));

// A válvula de escape do card 108 lê a role no AuthContext — precisa de mock
// próprio (padrão espelhado de src/test/unit/gestorFeatureGate.test.tsx).
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import {
  gestorV2Routes,
} from '@/features/gestor/gestorV2Routes';
import {
  GestorPortalShell,
  GestorIndexSwitch,
  PortalV2Gate,
  LegacyGestorGate,
  PORTAL_V2_FEATURE,
} from '@/features/gestor/portalV2Gates';

const comFlag = (ligada: boolean, loading = false) =>
  mockUseEffectiveFeatures.mockReturnValue({
    loading,
    hasFeature: (key: string) => ligada && key === PORTAL_V2_FEATURE,
  });

/** Papel do usuário autenticado (consumido só pela válvula de escape do card 108). */
const comUsuario = (roles: string[]) => mockUseAuth.mockReturnValue({ user: { roles } });

const pathsDosFilhos = (rotas: RouteObject[]): string[] =>
  (rotas.find((r) => r.path === '/gestor')?.children ?? []).map((c) =>
    c.index ? 'index' : (c.path ?? ''),
  );

/** Sonda de rota: expõe a query string efetivamente recebida em `/gestor`. */
const SondaSearch: React.FC = () => {
  const location = useLocation();
  return <div data-testid="search-recebida">{location.search}</div>;
};

const renderizarGateComPath = (gate: React.ReactElement, path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/gestor/alvo" element={gate} />
        <Route path="/gestor" element={<div>index gestor</div>} />
      </Routes>
    </MemoryRouter>,
  );

const renderizarGateComSonda = (gate: React.ReactElement, path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/gestor/alvo" element={gate} />
        <Route path="/gestor" element={<SondaSearch />} />
      </Routes>
    </MemoryRouter>,
  );

describe('gestorV2Routes — forma da árvore', () => {
  it('serve as 3 rotas novas e mantém as 5 legadas como filhas de /gestor', () => {
    expect(pathsDosFilhos(gestorV2Routes())).toEqual([
      'index',
      'visao-geral',
      'detalhamento',
      'visao-institucional',
      'diagnostico-curricular',
      'alunos',
      'insights-pedagogicos',
      'inteligencia-decisoria',
    ]);
  });

  it('preserva os redirects de compatibilidade do Desempenho Institucional', () => {
    const rotas = gestorV2Routes();
    const alvo = (path: string) =>
      (rotas.find((r) => r.path === path)?.element as React.ReactElement<{ to?: string }>)
        ?.props?.to;
    expect(alvo('/desempenho-institucional')).toBe('/gestor');
    expect(alvo('/desempenho-institucional-v2')).toBe('/gestor');
  });

  it('toda rota-filha não-index declara um gate (PortalV2Gate ou LegacyGestorGate)', () => {
    const filhas = gestorV2Routes().find((r) => r.path === '/gestor')?.children ?? [];
    for (const filha of filhas) {
      if (filha.index) continue;
      const tipo = (filha.element as React.ReactElement).type;
      expect(
        [PortalV2Gate, LegacyGestorGate].includes(tipo as never),
        `rota /gestor/${filha.path} montada sem gate`,
      ).toBe(true);
    }
  });
});

describe('GestorPortalShell — escolha do shell pela feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comUsuario(['gestor']);
  });

  it('flag ligada → shell do portal v2', async () => {
    comFlag(true);
    render(
      <MemoryRouter initialEntries={['/gestor']}>
        <GestorPortalShell />
      </MemoryRouter>,
    );
    expect(await screen.findByText('shell v2')).toBeInTheDocument();
    expect(screen.queryByText('layout legado')).not.toBeInTheDocument();
  });

  it('flag desligada → layout legado (comportamento atual, intacto)', async () => {
    comFlag(false);
    render(
      <MemoryRouter initialEntries={['/gestor']}>
        <GestorPortalShell />
      </MemoryRouter>,
    );
    expect(await screen.findByText('layout legado')).toBeInTheDocument();
    expect(screen.queryByText('shell v2')).not.toBeInTheDocument();
  });

  it('features carregando → não decide nada ainda', () => {
    comFlag(false, true);
    const { container } = render(
      <MemoryRouter initialEntries={['/gestor']}>
        <GestorPortalShell />
      </MemoryRouter>,
    );
    expect(container.textContent).toBe('');
  });
});

describe('gates das rotas exclusivas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comUsuario(['gestor']);
  });

  const renderizarGate = (gate: React.ReactElement) =>
    render(
      <MemoryRouter initialEntries={['/gestor/alvo']}>
        <Routes>
          <Route path="/gestor/alvo" element={gate} />
          <Route path="/gestor" element={<div>index gestor</div>} />
        </Routes>
      </MemoryRouter>,
    );

  it('PortalV2Gate: flag ligada renderiza; desligada volta para /gestor', () => {
    comFlag(true);
    renderizarGate(<PortalV2Gate><div>tela nova</div></PortalV2Gate>);
    expect(screen.getByText('tela nova')).toBeInTheDocument();

    comFlag(false);
    renderizarGate(<PortalV2Gate><div>tela nova 2</div></PortalV2Gate>);
    expect(screen.queryByText('tela nova 2')).not.toBeInTheDocument();
    expect(screen.getByText('index gestor')).toBeInTheDocument();
  });

  it('LegacyGestorGate: flag desligada renderiza a tela antiga; ligada volta para /gestor', () => {
    comFlag(false);
    renderizarGate(<LegacyGestorGate><div>tela antiga</div></LegacyGestorGate>);
    expect(screen.getByText('tela antiga')).toBeInTheDocument();

    comFlag(true);
    renderizarGate(<LegacyGestorGate><div>tela antiga 2</div></LegacyGestorGate>);
    expect(screen.queryByText('tela antiga 2')).not.toBeInTheDocument();
    expect(screen.getByText('index gestor')).toBeInTheDocument();
  });
});

describe('card 120 (achado 13, revisão 03/08) — redirect preserva a query string', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comUsuario(['gestor']);
  });

  it('PortalV2Gate: flag desligada redireciona para /gestor SEM perder o recorte da URL', () => {
    comFlag(false);
    renderizarGateComSonda(
      <PortalV2Gate><div>tela nova</div></PortalV2Gate>,
      '/gestor/alvo?ies=X&semestre=3&simulados=a,b',
    );
    expect(screen.getByTestId('search-recebida').textContent).toBe(
      '?ies=X&semestre=3&simulados=a,b',
    );
  });

  it('LegacyGestorGate: flag ligada redireciona para /gestor SEM perder o recorte da URL', () => {
    comFlag(true);
    renderizarGateComSonda(
      <LegacyGestorGate><div>tela antiga</div></LegacyGestorGate>,
      '/gestor/alvo?ies=X&semestre=3&simulados=a,b',
    );
    expect(screen.getByTestId('search-recebida').textContent).toBe(
      '?ies=X&semestre=3&simulados=a,b',
    );
  });
});

describe('card 108 (achado 24, revisão 03/08) — válvula de escape do admin para o legado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GestorPortalShell: admin com ?legado=1 vê o shell legado mesmo com a flag ligada', async () => {
    comFlag(true);
    comUsuario(['admin']);
    render(
      <MemoryRouter initialEntries={['/gestor?legado=1']}>
        <GestorPortalShell />
      </MemoryRouter>,
    );
    expect(await screen.findByText('layout legado')).toBeInTheDocument();
    expect(screen.queryByText('shell v2')).not.toBeInTheDocument();
  });

  it('GestorPortalShell: admin SEM ?legado=1 continua no portal v2 (escape não é o padrão)', async () => {
    comFlag(true);
    comUsuario(['admin']);
    render(
      <MemoryRouter initialEntries={['/gestor']}>
        <GestorPortalShell />
      </MemoryRouter>,
    );
    expect(await screen.findByText('shell v2')).toBeInTheDocument();
    expect(screen.queryByText('layout legado')).not.toBeInTheDocument();
  });

  it('LegacyGestorGate: admin com ?legado=1 alcança a tela legada mesmo com a flag ligada', () => {
    comFlag(true);
    comUsuario(['admin']);
    renderizarGateComPath(
      <LegacyGestorGate><div>tela antiga</div></LegacyGestorGate>,
      '/gestor/alvo?legado=1',
    );
    expect(screen.getByText('tela antiga')).toBeInTheDocument();
  });

  it('LegacyGestorGate: admin SEM ?legado=1 continua redirecionado (escape não é o padrão)', () => {
    comFlag(true);
    comUsuario(['admin']);
    renderizarGateComPath(
      <LegacyGestorGate><div>tela antiga</div></LegacyGestorGate>,
      '/gestor/alvo',
    );
    expect(screen.queryByText('tela antiga')).not.toBeInTheDocument();
    expect(screen.getByText('index gestor')).toBeInTheDocument();
  });

  it('LegacyGestorGate: gestor comum com ?legado=1 NÃO ganha acesso — a válvula é só de admin', () => {
    comFlag(true);
    comUsuario(['gestor']);
    renderizarGateComPath(
      <LegacyGestorGate><div>tela antiga</div></LegacyGestorGate>,
      '/gestor/alvo?legado=1',
    );
    expect(screen.queryByText('tela antiga')).not.toBeInTheDocument();
    expect(screen.getByText('index gestor')).toBeInTheDocument();
  });

  it('PortalV2Gate: admin com ?legado=1 é negado nas rotas exclusivas do v2 (a troca é de experiência inteira)', () => {
    comFlag(true);
    comUsuario(['admin']);
    renderizarGateComPath(
      <PortalV2Gate><div>tela nova</div></PortalV2Gate>,
      '/gestor/alvo?legado=1',
    );
    expect(screen.queryByText('tela nova')).not.toBeInTheDocument();
    expect(screen.getByText('index gestor')).toBeInTheDocument();
  });

  it('GestorIndexSwitch: admin com ?legado=1 no índice cai no GestorIndexRedirect (não no Início novo)', async () => {
    comFlag(true);
    comUsuario(['admin']);
    render(
      <MemoryRouter initialEntries={['/gestor/alvo?legado=1']}>
        <Routes>
          <Route path="/gestor/alvo" element={<GestorIndexSwitch />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('index redirect legado')).toBeInTheDocument();
  });
});
