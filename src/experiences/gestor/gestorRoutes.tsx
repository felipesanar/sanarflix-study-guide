import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';

const GestorLayout = lazy(() => import('@/experiences/gestor/GestorLayout'));
const VisaoInstitucionalPage = lazy(
  () => import('@/experiences/gestor/pages/VisaoInstitucionalPage'),
);
const DiagnosticoCurricularPage = lazy(
  () => import('@/experiences/gestor/pages/DiagnosticoCurricularPage'),
);
const AlunosPage = lazy(() => import('@/experiences/gestor/pages/AlunosPage'));
const InsightsPedagogicosPage = lazy(
  () => import('@/experiences/gestor/pages/InsightsPedagogicosPage'),
);
const InteligenciaDecisoriaPage = lazy(
  () => import('@/experiences/gestor/pages/InteligenciaDecisoriaPage'),
);

/** Rotas da experiência de Gestão (gestor IES e de grupo). */
export const getGestorRoutes = (): RouteObject[] => [
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
  { path: '/desempenho-institucional', element: <Navigate to="/gestor" replace /> },
  { path: '/desempenho-institucional-v2', element: <Navigate to="/gestor" replace /> },
];
