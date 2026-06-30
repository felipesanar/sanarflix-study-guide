import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { AtendimentoLayout } from '@/experiences/atendimento/AtendimentoLayout';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';

// Reaproveita a página de Usuários do admin (oculta recursos de admin para CX).
const UsuariosPage = lazy(() => import('@/experiences/admin/pages/UsuariosPage'));

/**
 * Rotas da experiência Atendimento / CX (`/atendimento/*`).
 *
 * Rota-layout (`AtendimentoLayout`, protegida por {@link ExperienceGuard}) com a
 * única seção do CX — Usuários — como rota-filha. Inclui o redirect de
 * compatibilidade de `/gestao-usuarios` (que o CX usava) para a nova URL.
 */
export const atendimentoRoutes = (): RouteObject[] => [
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

  // Redirect de compatibilidade (URL antiga usada pelo CX → nova).
  { path: '/gestao-usuarios', element: <Navigate to="/atendimento/usuarios" replace /> },
];
