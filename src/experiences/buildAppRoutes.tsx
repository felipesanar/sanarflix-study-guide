import React, { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import type { AccessRules, User } from '@/types';
import { getDefaultRouteForUser } from '@/utils/experiences';
import { hasExperience, type Access } from '@/experiences/access';
import { ExperiencePage } from '@/experiences/shared/ExperiencePage';
import { NoAccessPage } from '@/experiences/shared/NoAccessPage';
import { alunoRoutes } from '@/experiences/aluno/alunoRoutes';
import { adminRoutes } from '@/experiences/admin/adminRoutes';
import { gestorRoutes } from '@/experiences/gestor/gestorRoutes';
import { atendimentoRoutes } from '@/experiences/atendimento/atendimentoRoutes';

const NotFound = lazy(() => import('@/pages/NotFound'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));

/**
 * Monta a lista de rotas (RouteObject[]) do usuário atual — árvores IRMÃS por
 * experiência.
 *
 * Função pura de `(user, accessRules, access)`:
 *  - Rotas compartilhadas da área autenticada (`/login`, `/home` → entrypoint do
 *    usuário; `/auth/callback`).
 *  - BASE: a experiência de aluno é montada para TODOS (a Home vive em `/`; as
 *    telas seguem controladas por AccessRules). É isso que dá à camada de
 *    gestão "ver e ter a experiência como aluno" e elimina o 404 da raiz.
 *  - POR CIMA: cada portal dedicado (árvore IRMÃ, com shell próprio e
 *    independente) é montado apenas quando `access.experiences` o concede
 *    (admin/gestao/atendimento), evitando colisão de paths de compat.
 *  - Catch-all (`*`) com o NotFound.
 *
 * A autorização fina de cada portal fica no ExperienceGuard (por `access`).
 */
export const buildAppRoutes = (
  user: User | null,
  accessRules: AccessRules,
  access: Access,
): RouteObject[] => {
  const defaultRoute = getDefaultRouteForUser(user, accessRules, access);

  // Negação consistente: quem digita a rota de um portal que não tem volta ao
  // próprio entrypoint (mesmo comportamento do ExperienceGuard), em vez de 404.
  const deniedPortal = (base: string): RouteObject[] => [
    { path: base, element: <Navigate to={defaultRoute} replace /> },
    { path: `${base}/*`, element: <Navigate to={defaultRoute} replace /> },
  ];

  return [
    { path: '/login', element: <Navigate to={defaultRoute} replace /> },
    // Compat: /home é o destino pós-login do LoginForm para TODA experiência.
    // Devolve cada usuário ao entrypoint da sua experiência (portal p/ privilegiado).
    // Exceção: quando o próprio defaultRoute é '/home' (usuário sem NENHUMA
    // tela liberada), um <Navigate to="/home"> se auto-redirecionaria — loop
    // infinito. Renderiza a NoAccessPage em vez de redirecionar.
    {
      path: '/home',
      element:
        defaultRoute === '/home' ? (
          <ExperiencePage waitForData={false}>
            <NoAccessPage />
          </ExperiencePage>
        ) : (
          <Navigate to={defaultRoute} replace />
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

    // BASE: experiência de aluno — para TODOS os usuários.
    ...alunoRoutes(user, accessRules, access),

    // POR CIMA: árvores IRMÃS dos portais dedicados, montadas conforme
    // `access.experiences` (aditivo — um usuário pode ter várias).
    ...(hasExperience(access, 'admin') ? adminRoutes() : deniedPortal('/admin')),
    ...(hasExperience(access, 'gestao') ? gestorRoutes() : deniedPortal('/gestor')),
    ...(hasExperience(access, 'atendimento')
      ? atendimentoRoutes()
      : deniedPortal('/atendimento')),

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
