import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { GestorLayout } from '@/experiences/gestor/GestorLayout';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';

// Páginas do console de Gestão (carregadas sob demanda — ver gestor/pages/).
const PanoramaPage = lazy(() => import('@/experiences/gestor/pages/PanoramaPage'));
const DiagnosticoPage = lazy(() => import('@/experiences/gestor/pages/DiagnosticoPage'));
const AlunosRiscoPage = lazy(() => import('@/experiences/gestor/pages/AlunosRiscoPage'));
const IntervencaoPage = lazy(() => import('@/experiences/gestor/pages/IntervencaoPage'));
const SimuladosQuestoesPage = lazy(() => import('@/experiences/gestor/pages/SimuladosQuestoesPage'));
const CompararIesPage = lazy(() => import('@/experiences/gestor/pages/CompararIesPage'));
const RelatoriosPage = lazy(() => import('@/experiences/gestor/pages/RelatoriosPage'));

/**
 * Rotas da experiência Gestão (`/gestor/*`) — única para Gestor IES e Gestor
 * de Grupo.
 *
 * Console com sidebar fixa (`GestorLayout`, protegido por
 * {@link ExperienceGuard}) que mantém os filtros globais montados
 * (GestorFiltersProvider) enquanto as 7 telas trocam como rotas-filhas — cada
 * uma com URL própria. Inclui os redirects de compatibilidade das URLs
 * antigas (sub-nav em pills do `/gestor` anterior e do Desempenho
 * Institucional legado).
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
      { index: true, element: <Navigate to="/gestor/panorama" replace /> },
      { path: 'panorama', element: <PanoramaPage /> },
      { path: 'diagnostico-curricular', element: <DiagnosticoPage /> },
      { path: 'alunos-risco', element: <AlunosRiscoPage /> },
      { path: 'intervencao-impacto', element: <IntervencaoPage /> },
      { path: 'simulados-questoes', element: <SimuladosQuestoesPage /> },
      { path: 'comparar-ies', element: <CompararIesPage /> },
      { path: 'relatorios', element: <RelatoriosPage /> },

      // Redirects de compatibilidade (console antigo, sub-nav em pills → console novo).
      { path: 'visao-institucional', element: <Navigate to="/gestor/panorama" replace /> },
      { path: 'alunos', element: <Navigate to="/gestor/alunos-risco" replace /> },
      { path: 'insights-pedagogicos', element: <Navigate to="/gestor/intervencao-impacto" replace /> },
      { path: 'inteligencia-decisoria', element: <Navigate to="/gestor/intervencao-impacto" replace /> },
    ],
  },

  // Redirects de compatibilidade (Desempenho Institucional → experiência Gestão).
  { path: '/desempenho-institucional', element: <Navigate to="/gestor" replace /> },
  { path: '/desempenho-institucional-v2', element: <Navigate to="/gestor" replace /> },
];
