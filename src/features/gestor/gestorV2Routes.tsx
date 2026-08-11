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
 * Árvore de rotas da experiência Gestão durante o rollout faseado por IES
 * (spec 2026-08-11-rollout-faseado-portal-gestor-design.md).
 *
 * Um único `/gestor`, protegido por ExperienceGuard (esse continua sendo o
 * único gate por PAPEL — separa gestão de aluno/admin/CX). Dentro dele,
 * GestorPortalShell decide, via get_gestor_portal_versao(), entre o portal
 * novo (Início/Visão Geral/Detalhamento, dentro de GestorShell) e o console
 * antigo (5 telas, dentro de GestorLayout, reaproveitando gestorRoutes()
 * inteiro — que fica intacto).
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
