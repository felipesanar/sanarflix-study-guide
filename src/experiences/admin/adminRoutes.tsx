import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';

const AdminLayout = lazy(() => import('@/experiences/admin/AdminLayout'));
const UsuariosPage = lazy(() => import('@/experiences/admin/pages/UsuariosPage'));
const AvisosPage = lazy(() => import('@/experiences/admin/pages/AvisosPage'));
const IesPage = lazy(() => import('@/experiences/admin/pages/IesPage'));
const GuiaPage = lazy(() => import('@/experiences/admin/pages/GuiaPage'));
const SanarClassPage = lazy(() => import('@/experiences/admin/pages/SanarClassPage'));
const SimuladosPage = lazy(() => import('@/experiences/admin/pages/SimuladosPage'));
const FeedbacksPage = lazy(() => import('@/experiences/admin/pages/FeedbacksPage'));
const AnalyticsPage = lazy(() => import('@/experiences/admin/pages/AnalyticsPage'));

/** Rotas da experiência Admin (mesma casca usada por Atendimento, ver atendimentoRoutes). */
export const getAdminRoutes = (): RouteObject[] => [
  {
    path: '/admin',
    element: (
      <ExperienceGuard experience="admin">
        <AdminLayout />
      </ExperienceGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/usuarios" replace /> },
      { path: 'usuarios', element: <UsuariosPage /> },
      { path: 'avisos', element: <AvisosPage /> },
      { path: 'ies', element: <IesPage /> },
      { path: 'guia', element: <GuiaPage /> },
      { path: 'sanarclass', element: <SanarClassPage /> },
      { path: 'simulados', element: <SimuladosPage /> },
      { path: 'feedbacks', element: <FeedbacksPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
    ],
  },
  // Compat
  { path: '/gestao-usuarios', element: <Navigate to="/admin/usuarios" replace /> },
  { path: '/analytics', element: <Navigate to="/admin/analytics" replace /> },
];
