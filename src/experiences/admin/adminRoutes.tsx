import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { AdminLayout } from '@/experiences/admin/AdminLayout';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';

// Páginas finas do admin (carregadas sob demanda — ver admin/pages/).
const CommandCenterPage = lazy(() => import('@/experiences/admin/pages/CommandCenterPage'));
const SimuladosPage = lazy(() => import('@/experiences/admin/pages/SimuladosPage'));
const MonitoramentoPage = lazy(() => import('@/experiences/admin/pages/MonitoramentoPage'));
const UsuariosPage = lazy(() => import('@/experiences/admin/pages/UsuariosPage'));
const IesPage = lazy(() => import('@/experiences/admin/pages/IesPage'));
const GuiaPage = lazy(() => import('@/experiences/admin/pages/GuiaPage'));
const AvisosPage = lazy(() => import('@/experiences/admin/pages/AvisosPage'));
const SanarClassPage = lazy(() => import('@/experiences/admin/pages/SanarClassPage'));
const FeedbacksPage = lazy(() => import('@/experiences/admin/pages/FeedbacksPage'));
const AnalyticsPage = lazy(() => import('@/experiences/admin/pages/AnalyticsPage'));
const AuditoriaPage = lazy(() => import('@/experiences/admin/pages/AuditoriaPage'));

/**
 * Rotas da experiência Admin (`/admin/*`).
 *
 * Uma rota-layout (`AdminLayout`, protegida por {@link ExperienceGuard}) com
 * as 11 seções do console como rotas-filhas — cada uma com URL própria
 * (deep-link, voltar/avançar e refresh funcionam). A INDEX é o Command
 * Center (home só do admin) — NÃO redireciona mais para `/admin/usuarios`.
 * Inclui os redirects de compatibilidade das URLs antigas (`/gestao-usuarios`,
 * `/analytics`) para as novas.
 */
export const adminRoutes = (): RouteObject[] => [
  {
    path: '/admin',
    element: (
      <ExperienceGuard experience="admin">
        <AdminLayout />
      </ExperienceGuard>
    ),
    children: [
      { index: true, element: <CommandCenterPage /> },
      { path: 'simulados', element: <SimuladosPage /> },
      { path: 'monitoramento', element: <MonitoramentoPage /> },
      { path: 'usuarios', element: <UsuariosPage /> },
      { path: 'ies', element: <IesPage /> },
      { path: 'guia', element: <GuiaPage /> },
      { path: 'avisos', element: <AvisosPage /> },
      { path: 'sanarclass', element: <SanarClassPage /> },
      { path: 'feedbacks', element: <FeedbacksPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'auditoria', element: <AuditoriaPage /> },
    ],
  },

  // Redirects de compatibilidade (URLs antigas → novas).
  { path: '/gestao-usuarios', element: <Navigate to="/admin/usuarios" replace /> },
  { path: '/analytics', element: <Navigate to="/admin/analytics" replace /> },
];
