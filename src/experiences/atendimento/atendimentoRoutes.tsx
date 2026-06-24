import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';

const AtendimentoLayout = lazy(
  () => import('@/experiences/atendimento/AtendimentoLayout'),
);
// Reusa a página de Usuários do admin (sem o BulkEmailUpdateTab, que é só admin).
const UsuariosPage = lazy(() => import('@/experiences/admin/pages/UsuariosPage'));

/** Rotas da experiência de Atendimento (CX). */
export const getAtendimentoRoutes = (): RouteObject[] => [
  {
    path: '/atendimento',
    element: (
      <ExperienceGuard experience="atendimento">
        <AtendimentoLayout />
      </ExperienceGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/atendimento/usuarios" replace /> },
      { path: 'usuarios', element: <UsuariosPage /> },
    ],
  },
];
