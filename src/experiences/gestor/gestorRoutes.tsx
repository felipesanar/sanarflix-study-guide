import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { GestorLayout } from '@/experiences/gestor/GestorLayout';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';

// Páginas-módulo do gestor (carregadas sob demanda — ver gestor/pages/).
const VisaoInstitucionalPage = lazy(() => import('@/experiences/gestor/pages/VisaoInstitucionalPage'));
const DiagnosticoCurricularPage = lazy(() => import('@/experiences/gestor/pages/DiagnosticoCurricularPage'));
const AlunosPage = lazy(() => import('@/experiences/gestor/pages/AlunosPage'));
const InsightsPedagogicosPage = lazy(() => import('@/experiences/gestor/pages/InsightsPedagogicosPage'));
const InteligenciaDecisoriaPage = lazy(() => import('@/experiences/gestor/pages/InteligenciaDecisoriaPage'));

/**
 * Rotas da experiência Gestão (`/gestor/*`) — única para Gestor IES e Gestor de
 * Grupo.
 *
 * Uma rota-layout (`GestorLayout`, protegida por {@link ExperienceGuard}) que
 * mantém os filtros globais montados (GestorFiltersProvider) enquanto os
 * módulos trocam como rotas-filhas — cada um com URL própria. Inclui os
 * redirects de compatibilidade das URLs antigas do Desempenho Institucional.
 */
export const gestorRoutes = (): RouteObject[] => [
  {
    path: '/gestor',
    element: (
      <ExperienceGuard experience="gestao">
        <GestorLayout />
      </ExperienceGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/gestor/visao-institucional" replace /> },
      { path: 'visao-institucional', element: <VisaoInstitucionalPage /> },
      { path: 'diagnostico-curricular', element: <DiagnosticoCurricularPage /> },
      { path: 'alunos', element: <AlunosPage /> },
      { path: 'insights-pedagogicos', element: <InsightsPedagogicosPage /> },
      { path: 'inteligencia-decisoria', element: <InteligenciaDecisoriaPage /> },
    ],
  },

  // Redirects de compatibilidade (Desempenho Institucional → experiência Gestão).
  { path: '/desempenho-institucional', element: <Navigate to="/gestor" replace /> },
  { path: '/desempenho-institucional-v2', element: <Navigate to="/gestor" replace /> },
];
