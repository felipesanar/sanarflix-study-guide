import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import type { AccessRules } from '@/types';
import { ExperiencePage } from '@/experiences/shared/ExperiencePage';
import {
  HomePageSkeleton,
  StudyGuideSkeleton,
  DashboardSkeleton,
} from '@/components/skeletons';

const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })));
const StudyGuide = lazy(() =>
  import('@/pages/StudyGuide').then((m) => ({ default: m.StudyGuide })),
);
const Simulados = lazy(() => import('@/pages/Simulados'));
const ModoProva = lazy(() => import('@/pages/ModoProva'));
const SimuladoDesempenho = lazy(() =>
  import('@/pages/SimuladoDesempenho').then((m) => ({
    default: m.SimuladoDesempenho,
  })),
);
const Dashboard = lazy(() =>
  import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })),
);
const CadernoErros = lazy(() => import('@/pages/CadernoErros'));
const SanarClass = lazy(() => import('@/pages/SanarClass'));
const MeusFeedbacks = lazy(() => import('@/pages/MeusFeedbacks'));

/** Rotas da experiência Aluno + Professor (raiz, sem prefixo). */
export const getAlunoRoutes = (accessRules: AccessRules): RouteObject[] => {
  const r: RouteObject[] = [];
  if (accessRules.home)
    r.push({
      path: '/',
      element: (
        <ExperiencePage loadingMessage="Carregando início..." skeleton={<HomePageSkeleton />}>
          <Home />
        </ExperiencePage>
      ),
    });
  r.push({ path: '/home', element: <Navigate to="/" replace /> });
  if (accessRules.studyGuide)
    r.push({
      path: '/guia-estudos',
      element: (
        <ExperiencePage loadingMessage="Carregando guia de estudos..." skeleton={<StudyGuideSkeleton />}>
          <StudyGuide />
        </ExperiencePage>
      ),
    });
  if (accessRules.simulados)
    r.push({
      path: '/simulados',
      element: (
        <ExperiencePage loadingMessage="Carregando simulados...">
          <Simulados />
        </ExperiencePage>
      ),
    });
  r.push({ path: '/simulados/:id/prova', element: <ModoProva /> });
  if (accessRules.SimuladoDesempenho)
    r.push({
      path: '/desempenho-simulado',
      element: (
        <ExperiencePage loadingMessage="Carregando desempenho...">
          <SimuladoDesempenho />
        </ExperiencePage>
      ),
    });
  if (accessRules.dashboard)
    r.push({
      path: '/dashboard',
      element: (
        <ExperiencePage loadingMessage="Carregando dashboard..." skeleton={<DashboardSkeleton />}>
          <Dashboard />
        </ExperiencePage>
      ),
    });
  if (accessRules.errorNotebook)
    r.push({
      path: '/caderno-de-erros',
      element: (
        <ExperiencePage loadingMessage="Carregando caderno de erros...">
          <CadernoErros />
        </ExperiencePage>
      ),
    });
  if (accessRules.sanarclass)
    r.push({
      path: '/sanarclass',
      element: (
        <ExperiencePage loadingMessage="Carregando SanarClass...">
          <SanarClass />
        </ExperiencePage>
      ),
    });
  r.push({
    path: '/meus-feedbacks',
    element: (
      <ExperiencePage loadingMessage="Carregando…" waitForData={false}>
        <MeusFeedbacks />
      </ExperiencePage>
    ),
  });
  return r;
};
