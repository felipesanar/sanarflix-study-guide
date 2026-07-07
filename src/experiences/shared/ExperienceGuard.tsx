import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';
import { canAccessExperience, getDefaultRouteForUser } from '@/utils/experiences';
import type { ExperienceId } from '@/experiences/types';

interface ExperienceGuardProps {
  /** Experiência a que esta subárvore de rotas pertence. */
  experience: ExperienceId;
  children: React.ReactNode;
}

/**
 * Fronteira de autorização das experiências dedicadas.
 *
 * Renderiza os filhos apenas quando a role do usuário concede a `experience`
 * guardada ({@link canAccessExperience}). Caso contrário, redireciona para o
 * entrypoint padrão do usuário ({@link getDefaultRouteForUser}) — um aluno cai
 * em `/` (sua base); um gestor tentando `/admin` cai em `/gestor`.
 *
 * Pressupõe que as regras de acesso já estejam carregadas (o gate de loading
 * fica em DynamicRoutes).
 */
export const ExperienceGuard: React.FC<ExperienceGuardProps> = ({
  experience,
  children,
}) => {
  const { user } = useAuth();
  const { accessRules } = useAccessRules();

  if (!canAccessExperience(user, experience)) {
    return <Navigate to={getDefaultRouteForUser(user, accessRules)} replace />;
  }

  return <>{children}</>;
};
