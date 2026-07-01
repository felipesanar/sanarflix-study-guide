import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import type { AccessRules, User } from '@/types';
import { getExperience, getDefaultRouteForUser } from '@/utils/experiences';
import { ExperiencePage } from '@/experiences/shared/ExperiencePage';
import { alunoRoutes } from '@/experiences/aluno/alunoRoutes';
import { adminRoutes } from '@/experiences/admin/adminRoutes';
import { gestorRoutes } from '@/experiences/gestor/gestorRoutes';
import { atendimentoRoutes } from '@/experiences/atendimento/atendimentoRoutes';

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
 * Todas as quatro experiências (Aluno + Professor, Admin, Gestão e Atendimento)
 * possuem módulo de rotas próprio. Cada usuário recebe apenas as rotas da SUA
 * experiência, mais as compartilhadas e o catch-all — o que, por si só, impede
 * o acesso cruzado (reforçado pelos ExperienceGuard em cada layout).
 */
export const buildAppRoutes = (
  user: User | null,
  accessRules: AccessRules,
): RouteObject[] => {
  const experience = getExperience(user);
  const isAluno = experience === 'aluno_professor';

  const experienceRoutes: RouteObject[] =
    experience === 'aluno_professor'
      ? alunoRoutes(user, accessRules)
      : experience === 'admin'
        ? adminRoutes()
        : experience === 'gestao'
          ? gestorRoutes()
          : experience === 'atendimento'
            ? atendimentoRoutes()
            : [];

  return [
    // Rotas compartilhadas da área autenticada.
    {
      path: '/login',
      element: (
        <Navigate to={getDefaultRouteForUser(user, accessRules)} replace />
      ),
    },
    // Compat: /home foi a home histórica de TODAS as roles e ainda é o destino
    // pós-login do LoginForm. Como cada usuário monta apenas as rotas da sua
    // experiência, /home precisa ser compartilhada — senão admin/gestor/CX caem
    // no catch-all (NotFound). Devolve cada um ao entrypoint da sua experiência.
    {
      path: '/home',
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

    // Raiz autenticada: o aluno monta '/' (Home) no seu módulo de rotas; as
    // demais experiências (admin/gestão/CX) NÃO têm '/'. Sem este redirect,
    // um não-aluno que abre a raiz cai no catch-all (NotFound). Devolve cada um
    // ao entrypoint da sua experiência.
    ...(isAluno
      ? []
      : [
          {
            path: '/',
            element: (
              <Navigate
                to={getDefaultRouteForUser(user, accessRules)}
                replace
              />
            ),
          },
        ]),

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
