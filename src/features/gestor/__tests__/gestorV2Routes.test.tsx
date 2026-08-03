import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, type RouteObject } from 'react-router-dom';

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

const mockUseEffectiveFeatures = vi.fn();
vi.mock('@/hooks/useEffectiveFeatures', () => ({
  useEffectiveFeatures: () => mockUseEffectiveFeatures(),
}));

import {
  gestorV2Routes,
} from '@/features/gestor/gestorV2Routes';
import {
  GestorPortalShell,
  PortalV2Gate,
  LegacyGestorGate,
  PORTAL_V2_FEATURE,
} from '@/features/gestor/portalV2Gates';

const comFlag = (ligada: boolean, loading = false) =>
  mockUseEffectiveFeatures.mockReturnValue({
    loading,
    hasFeature: (key: string) => ligada && key === PORTAL_V2_FEATURE,
  });

const pathsDosFilhos = (rotas: RouteObject[]): string[] =>
  (rotas.find((r) => r.path === '/gestor')?.children ?? []).map((c) =>
    c.index ? 'index' : (c.path ?? ''),
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
  beforeEach(() => vi.clearAllMocks());

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
  beforeEach(() => vi.clearAllMocks());

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
