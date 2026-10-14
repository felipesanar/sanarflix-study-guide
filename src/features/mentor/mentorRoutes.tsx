import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { MentorLayout } from '@/features/mentor/MentorLayout';

const InicioMentor = lazy(() => import('@/features/mentor/routes/InicioMentor'));
const MinhaTurma = lazy(() => import('@/features/mentor/routes/MinhaTurma'));
const Mural = lazy(() => import('@/features/mentor/routes/Mural'));
const Sessoes = lazy(() => import('@/features/mentor/routes/Sessoes'));
const Intervencoes = lazy(() => import('@/features/mentor/routes/Intervencoes'));

/** Rotas da experiência Mentor (`/mentor/*`). */
export const mentorRoutes = (): RouteObject[] => [
  {
    path: '/mentor',
    element: (
      <ExperienceGuard experience="mentor">
        <MentorLayout />
      </ExperienceGuard>
    ),
    children: [
      { index: true, element: <InicioMentor /> },
      { path: 'turma', element: <MinhaTurma /> },
      { path: 'mural', element: <Mural /> },
      { path: 'sessoes', element: <Sessoes /> },
      { path: 'intervencoes', element: <Intervencoes /> },
    ],
  },
];
