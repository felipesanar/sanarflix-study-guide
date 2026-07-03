import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import type { AccessRules, User } from '@/types';
import { getDefaultRouteForUser } from '@/utils/experiences';
import { isAdmin, isGestor, isAtendimento } from '@/utils/accessRules';
import { ExperiencePage } from '@/experiences/shared/ExperiencePage';
import { alunoRoutes } from '@/experiences/aluno/alunoRoutes';
import { adminRoutes } from '@/experiences/admin/adminRoutes';
import { gestorRoutes } from '@/experiences/gestor/gestorRoutes';
import { atendimentoRoutes } from '@/experiences/atendimento/atendimentoRoutes';

const NotFound = lazy(() => import('@/pages/NotFound'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));

/**
 * Monta a lista de rotas (RouteObject[]) do usuário atual — modelo HÍBRIDO.
 *
 * Função pura de `(user, accessRules)`:
 *  - Rotas compartilhadas da área autenticada (`/login`, `/home` → entrypoint do
 *    usuário; `/auth/callback`).
 *  - BASE: a experiência de aluno/professor é montada para TODOS (a Home vive em
 *    `/`; as telas seguem controladas por AccessRules). É isso que dá à camada de
 *    gestão "ver e ter a experiência como aluno" e elimina o 404 da raiz.
 *  - POR CIMA: cada portal dedicado é montado apenas quando a role do usuário o
 *    concede (admin/gestor/atendimento), evitando colisão de paths de compat.
 *  - Catch-all (`*`) com o NotFound.
 *
 * A autorização fina de cada portal fica no ExperienceGuard (por role).
 */
export const buildAppRoutes = (
  user: User | null,
  accessRules: AccessRules,
): RouteObject[] => {
  const defaultRoute = getDefaultRouteForUser(user, accessRules);

  return [
    { path: '/login', element: <Navigate to={defaultRoute} replace /> },
    // Compat: /home é o destino pós-login do LoginForm para TODA role. Devolve
    // cada usuário ao entrypoint da sua experiência (portal p/ privilegiado).
    { path: '/home', element: <Navigate to={defaultRoute} replace /> },
    {
      path: '/auth/callback',
      element: (
        <ExperiencePage waitForData={false}>
          <AuthCallback />
        </ExperiencePage>
      ),
    },

    // BASE: experiência de aluno/professor — para TODOS os usuários.
    ...alunoRoutes(user, accessRules),

    // POR CIMA: portais dedicados, montados conforme as roles do usuário.
    ...(isAdmin(user) ? adminRoutes() : []),
    ...(isGestor(user) ? gestorRoutes() : []),
    ...(isAtendimento(user) ? atendimentoRoutes() : []),

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
