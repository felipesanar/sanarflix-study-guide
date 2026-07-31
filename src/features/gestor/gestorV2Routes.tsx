import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { gestorRoutes } from '@/experiences/gestor/gestorRoutes';
import {
  GestorPortalShell,
  GestorIndexSwitch,
  LegacyGestorGate,
  PortalV2Gate,
} from '@/features/gestor/portalV2Gates';

const VisaoGeral = lazy(() => import('@/features/gestor/routes/VisaoGeral'));
const Detalhamento = lazy(() => import('@/features/gestor/routes/Detalhamento'));

/**
 * Árvore de rotas da experiência Gestão durante a coexistência (spec §7.5, §9).
 *
 * Um único `/gestor`, protegido por {@link ExperienceGuard}. O shell e cada
 * filha decidem pela feature `gestao.portal_v2`:
 *  - ligada  → Início/Visão Geral/Detalhamento dentro do `GestorShell`;
 *  - desligada → as 5 telas atuais dentro do `GestorLayout`, com os gates de
 *    feature originais (reusados de `gestorRoutes()`, que fica INTACTO).
 */
export const gestorV2Routes = (): RouteObject[] => {
  const legado = gestorRoutes();
  const portalLegado = legado.find((rota) => rota.path === '/gestor');
  const compat = legado.filter((rota) => rota.path !== '/gestor');

  const telasLegadas: RouteObject[] = (portalLegado?.children ?? [])
    .filter((filha) => !filha.index)
    .map((filha) => ({
      ...filha,
      element: <LegacyGestorGate>{filha.element}</LegacyGestorGate>,
    }));

  return [
    {
      path: '/gestor',
      element: (
        <ExperienceGuard experience="gestao">
          <GestorPortalShell />
        </ExperienceGuard>
      ),
      children: [
        { index: true, element: <GestorIndexSwitch /> },
        { path: 'visao-geral', element: <PortalV2Gate><VisaoGeral /></PortalV2Gate> },
        { path: 'detalhamento', element: <PortalV2Gate><Detalhamento /></PortalV2Gate> },
        ...telasLegadas,
      ],
    },
    ...compat,
  ];
};
