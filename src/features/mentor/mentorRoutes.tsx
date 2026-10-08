import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { MentorLayout } from '@/features/mentor/MentorLayout';

const InicioMentor = lazy(() => import('@/features/mentor/routes/InicioMentor'));

/** Rotas da experiência Mentor (`/mentor/*`). */
export const mentorRoutes = (): RouteObject[] => [
  {
    path: '/mentor',
    element: (
      <ExperienceGuard experience="mentor">
        <MentorLayout />
      </ExperienceGuard>
    ),
    children: [{ index: true, element: <InicioMentor /> }],
  },
];
