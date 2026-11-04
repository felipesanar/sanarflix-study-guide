import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { GuardPortalMentor } from '@/features/mentor/shell/GuardPortalMentor';
import { MentorShell } from '@/features/mentor/shell/MentorShell';
import { SoModalidade } from '@/features/mentor/shell/SoModalidade';

const Inicio = lazy(() => import('@/features/mentor/routes/v2/Inicio'));
const MinhaTurma = lazy(() => import('@/features/mentor/routes/v2/MinhaTurma'));
const VisaoGeral = lazy(() => import('@/features/mentor/routes/v2/VisaoGeral'));
const Detalhamento = lazy(() => import('@/features/mentor/routes/v2/Detalhamento'));
const Mural = lazy(() => import('@/features/mentor/routes/v2/Mural'));
const Sessoes = lazy(() => import('@/features/mentor/routes/v2/Sessoes'));
const Canais = lazy(() => import('@/features/mentor/routes/v2/Canais'));
const Intervencoes = lazy(() => import('@/features/mentor/routes/v2/Intervencoes'));

/** Rotas da experiência Mentor (`/mentor/*`). */
export const mentorRoutes = (): RouteObject[] => [
  {
    path: '/mentor',
    element: (
      <ExperienceGuard experience="mentor">
        <GuardPortalMentor><MentorShell /></GuardPortalMentor>
      </ExperienceGuard>
    ),
    children: [
      { index: true, element: <Inicio /> },
      { path: 'turma', element: <SoModalidade b2c><MinhaTurma /></SoModalidade> },
      { path: 'visao-geral', element: <SoModalidade b2b><VisaoGeral /></SoModalidade> },
      { path: 'detalhamento', element: <Detalhamento /> },
      { path: 'mural', element: <SoModalidade b2c><Mural /></SoModalidade> },
      { path: 'sessoes', element: <Sessoes /> },
      { path: 'canais', element: <SoModalidade b2b><Canais /></SoModalidade> },
      { path: 'intervencoes', element: <Intervencoes /> },
      { path: '*', element: <Navigate to="/mentor" replace /> },
    ],
  },
];
