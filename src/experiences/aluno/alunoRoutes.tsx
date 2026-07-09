import * as React from 'react';
import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import type { AccessRules, User } from '@/types';
import { getDefaultRouteForUser } from '@/utils/experiences';
import type { Access } from '@/experiences/access';
import { ExperiencePage } from '@/experiences/shared/ExperiencePage';
import { Layout } from '@/components/Layout';
import {
  HomePageSkeleton,
  StudyGuideSkeleton,
  DashboardSkeleton,
} from '@/components/skeletons';

// Páginas da experiência Aluno + Professor (carregadas sob demanda).
const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })));
const StudyGuide = lazy(() =>
  import('@/pages/StudyGuide').then((m) => ({ default: m.StudyGuide })),
);
const Dashboard = lazy(() =>
  import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })),
);
const Simulados = lazy(() => import('@/pages/Simulados'));
const ModoProva = lazy(() => import('@/pages/ModoProva'));
const SimuladoDesempenho = lazy(() =>
  import('@/pages/SimuladoDesempenho').then((m) => ({
    default: m.SimuladoDesempenho,
  })),
);
const SanarClass = lazy(() => import('@/pages/SanarClass'));
const CadernoErros = lazy(() => import('@/pages/CadernoErros'));
const CadernoRevisao = lazy(() =>
  import('@/pages/CadernoRevisao').then((m) => ({ default: m.CadernoRevisao })),
);
const CadernoTriagem = lazy(() =>
  import('@/pages/CadernoTriagem').then((m) => ({ default: m.CadernoTriagem })),
);
const CadernoRetaFinal = lazy(() =>
  import('@/pages/CadernoRetaFinal').then((m) => ({
    default: m.CadernoRetaFinal,
  })),
);
const MeusFeedbacks = lazy(() => import('@/pages/MeusFeedbacks'));

/**
 * Envolve o conteúdo da experiência de aluno no seu shell exclusivo (sidebar
 * desktop + header + bottom-nav mobile). O Layout já trata o Modo Prova
 * internamente (esconde a chrome quando a rota é `/simulados/:id/prova`).
 */
const withAlunoLayout = (element: React.ReactNode): React.ReactNode => (
  <Layout>{element}</Layout>
);

/**
 * Monta uma rota controlada por uma regra de acesso: quando liberada renderiza
 * o elemento (dentro do shell de aluno); quando bloqueada redireciona para o
 * entrypoint da experiência (mantendo o "bloqueio de acesso cruzado volta
 * para a sua tela inicial" — sem shell, é um redirect imediato).
 */
const gated = (
  enabled: boolean,
  path: string,
  element: React.ReactNode,
  fallback: string,
): RouteObject => ({
  path,
  element: enabled ? withAlunoLayout(element) : <Navigate to={fallback} replace />,
});

/**
 * Rotas da experiência Aluno + Professor.
 *
 * A Home passa a viver na raiz (`/`); a rota legada `/home` redireciona para
 * `/`. As demais telas seguem controladas dinamicamente pelas `ies_features`
 * (via AccessRules), redirecionando para o entrypoint quando bloqueadas. Toda
 * tela de conteúdo é envolvida pelo shell exclusivo do aluno ({@link Layout}).
 */
export const alunoRoutes = (
  user: User | null,
  accessRules: AccessRules,
  access?: Access,
): RouteObject[] => {
  const fallback = getDefaultRouteForUser(user, accessRules, access);

  return [
    {
      path: '/',
      element: accessRules.home ? (
        withAlunoLayout(
          <ExperiencePage
            loadingMessage="Carregando início..."
            skeleton={<HomePageSkeleton />}
          >
            <Home />
          </ExperiencePage>,
        )
      ) : (
        <Navigate to={fallback} replace />
      ),
    },
    gated(
      accessRules.studyGuide,
      '/guia-estudos',
      <ExperiencePage
        loadingMessage="Carregando guia de estudos..."
        skeleton={<StudyGuideSkeleton />}
      >
        <StudyGuide />
      </ExperiencePage>,
      fallback,
    ),

    gated(
      accessRules.dashboard,
      '/dashboard',
      <ExperiencePage
        loadingMessage="Carregando dashboard..."
        skeleton={<DashboardSkeleton />}
      >
        <Dashboard />
      </ExperiencePage>,
      fallback,
    ),

    gated(
      accessRules.simulados,
      '/simulados',
      <ExperiencePage loadingMessage="Carregando simulados...">
        <Simulados />
      </ExperiencePage>,
      fallback,
    ),

    // Modo Prova segue o gate de simulados da IES. Roda em tela cheia (sem
    // aguardar dados de página); ainda passa pelo Layout — que esconde
    // sidebar/bottom-nav internamente (isModoProva) — para preservar
    // ImpersonationBanner/FeedbackFab do App.
    gated(
      accessRules.simulados,
      '/simulados/:id/prova',
      <ExperiencePage waitForData={false}>
        <ModoProva />
      </ExperiencePage>,
      fallback,
    ),

    gated(
      accessRules.SimuladoDesempenho,
      '/desempenho-simulado',
      <ExperiencePage loadingMessage="Carregando desempenho...">
        <SimuladoDesempenho />
      </ExperiencePage>,
      fallback,
    ),

    gated(
      accessRules.sanarclass,
      '/sanarclass',
      <ExperiencePage loadingMessage="Carregando SanarClass...">
        <SanarClass />
      </ExperiencePage>,
      fallback,
    ),

    gated(
      accessRules.errorNotebook,
      '/caderno-de-erros',
      <ExperiencePage loadingMessage="Carregando caderno de erros...">
        <CadernoErros />
      </ExperiencePage>,
      fallback,
    ),
    gated(
      accessRules.errorNotebook,
      '/caderno-de-erros/revisao',
      <ExperiencePage loadingMessage="Carregando revisão..." waitForData={false}>
        <CadernoRevisao />
      </ExperiencePage>,
      fallback,
    ),
    gated(
      accessRules.errorNotebook,
      '/caderno-de-erros/triagem',
      <ExperiencePage loadingMessage="Carregando triagem..." waitForData={false}>
        <CadernoTriagem />
      </ExperiencePage>,
      fallback,
    ),
    gated(
      accessRules.errorNotebook,
      '/caderno-de-erros/reta-final',
      <ExperiencePage loadingMessage="Carregando reta final..." waitForData={false}>
        <CadernoRetaFinal />
      </ExperiencePage>,
      fallback,
    ),

    {
      path: '/meus-feedbacks',
      element: withAlunoLayout(
        <ExperiencePage loadingMessage="Carregando…" waitForData={false}>
          <MeusFeedbacks />
        </ExperiencePage>,
      ),
    },
  ];
};
