import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { GestorFeatureGate, GestorIndexRedirect } from '@/experiences/gestor/GestorFeatureGate';

// Lazy de propósito (achado da revisão final do plano de 11/08): esse
// arquivo é importado estaticamente e no escopo do módulo por
// `src/features/gestor/gestorV2Routes.tsx` (`const legado = gestorRoutes();`),
// que por sua vez está sempre no grafo de import do bundle principal. Um
// import estático de GestorLayout aqui faria o bundler dobrar todo o console
// antigo (components/analytics/v2/**) no chunk principal mesmo com o
// lazy() em portalV2Gates.tsx — todo usuário, inclusive aluno, baixaria o
// console do gestor. Ver Finding 4 do relatório final.
const GestorLayout = lazy(() =>
  import('@/experiences/gestor/GestorLayout').then((m) => ({ default: m.GestorLayout })),
);

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
      { index: true, element: <GestorIndexRedirect /> },
      { path: 'visao-institucional', element: <GestorFeatureGate featureKey="gestao.visao_institucional"><VisaoInstitucionalPage /></GestorFeatureGate> },
      { path: 'diagnostico-curricular', element: <GestorFeatureGate featureKey="gestao.diagnostico_curricular"><DiagnosticoCurricularPage /></GestorFeatureGate> },
      { path: 'alunos', element: <GestorFeatureGate featureKey="gestao.alunos"><AlunosPage /></GestorFeatureGate> },
      { path: 'insights-pedagogicos', element: <GestorFeatureGate featureKey="gestao.insights_pedagogicos"><InsightsPedagogicosPage /></GestorFeatureGate> },
      { path: 'inteligencia-decisoria', element: <GestorFeatureGate featureKey="gestao.inteligencia_decisoria"><InteligenciaDecisoriaPage /></GestorFeatureGate> },
    ],
  },

  // Redirects de compatibilidade (Desempenho Institucional → experiência Gestão).
  { path: '/desempenho-institucional', element: <Navigate to="/gestor" replace /> },
  { path: '/desempenho-institucional-v2', element: <Navigate to="/gestor" replace /> },
];
