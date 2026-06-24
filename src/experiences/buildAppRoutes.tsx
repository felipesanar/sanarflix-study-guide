import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import type { User, AccessRules } from '@/types';
import { getDefaultRouteForUser } from '@/utils/experiences';
import { getAlunoRoutes } from '@/experiences/aluno/alunoRoutes';
import { getAdminRoutes } from '@/experiences/admin/adminRoutes';
import { getGestorRoutes } from '@/experiences/gestor/gestorRoutes';

const AuthCallbackPage = lazy(() => import('@/pages/AuthCallback'));
const NotFound = lazy(() => import('@/pages/NotFound'));

/** Monta a árvore completa de rotas autenticadas conforme a experiência do usuário. */
export const buildAppRoutes = (
  user: User | null,
  accessRules: AccessRules,
): RouteObject[] => {
  const fallback = getDefaultRouteForUser(user, accessRules);
  return [
    { path: '/login', element: <Navigate to={fallback} replace /> },
    { path: '/auth/callback', element: <AuthCallbackPage /> },
    ...getAlunoRoutes(accessRules),
    ...getAdminRoutes(),
    ...getGestorRoutes(),
    // Fase seguinte insere aqui: atendimento.
    { path: '*', element: <NotFound /> },
  ];
};
