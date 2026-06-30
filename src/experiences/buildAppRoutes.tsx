import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import type { AccessRules, User } from '@/types';
import { getExperience, getDefaultRouteForUser } from '@/utils/experiences';
import { ExperiencePage } from '@/experiences/shared/ExperiencePage';
import { alunoRoutes } from '@/experiences/aluno/alunoRoutes';
import { adminRoutes } from '@/experiences/admin/adminRoutes';
import { gestorRoutes } from '@/experiences/gestor/gestorRoutes';

const NotFound = lazy(() => import('@/pages/NotFound'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));

/**
 * Monta a lista de rotas (RouteObject[]) da aplicação para o usuário atual.
 *
 * Função pura de `(user, accessRules)`: resolve a experiência do usuário
 * ({@link getExperience}) e delega ao módulo de rotas da experiência. Além das
 * rotas da experiência, inclui as rotas compartilhadas da área autenticada
 * (`/login` → entrypoint do usuário e `/auth/callback`) e sempre encerra com o
 * catch-all (`*`) que renderiza o NotFound.
 *
 * Nesta fase as experiências Aluno + Professor, Admin e Gestão possuem módulo
 * de rotas próprio; Atendimento (CX) recebe o seu na fase seguinte (F4) e, por
 * ora, conta apenas com as rotas compartilhadas e o catch-all.
 */
export const buildAppRoutes = (
  user: User | null,
  accessRules: AccessRules,
): RouteObject[] => {
  const experience = getExperience(user);

  const experienceRoutes: RouteObject[] =
    experience === 'aluno_professor'
      ? alunoRoutes(user, accessRules)
      : experience === 'admin'
        ? adminRoutes()
        : experience === 'gestao'
          ? gestorRoutes()
          : [];

  return [
    // Rotas compartilhadas da área autenticada.
    {
      path: '/login',
      element: (
        <Navigate to={getDefaultRouteForUser(user, accessRules)} replace />
      ),
    },
    {
      path: '/auth/callback',
      element: (
        <ExperiencePage waitForData={false}>
          <AuthCallback />
        </ExperiencePage>
      ),
    },

    ...experienceRoutes,

    {
      path: '*',
      element: (
        <ExperiencePage waitForData={false}>
          <NotFound />
        </ExperiencePage>
      ),
    },
  ];
};
