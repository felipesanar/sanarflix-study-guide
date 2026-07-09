import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';
import { hasExperience } from '@/experiences/access';
import { getDefaultRouteForUser } from '@/utils/experiences';
import type { ExperienceId } from '@/experiences/types';

interface ExperienceGuardProps {
  /** Experiência a que esta subárvore de rotas pertence. */
  experience: ExperienceId;
  children: React.ReactNode;
}

/**
 * Fronteira de autorização das experiências dedicadas.
 *
 * Renderiza os filhos apenas quando o `access` do usuário concede a
 * `experience` guardada ({@link hasExperience}). Caso contrário, redireciona
 * para o entrypoint padrão do usuário ({@link getDefaultRouteForUser}) — um
 * aluno cai em `/` (sua base); um gestor tentando `/admin` cai em `/gestor`.
 *
 * Pressupõe que as regras de acesso já estejam carregadas (o gate de loading
 * fica em DynamicRoutes).
 */
export const ExperienceGuard: React.FC<ExperienceGuardProps> = ({
  experience,
  children,
}) => {
  const { user, access } = useAuth();
  const { accessRules } = useAccessRules();

  const featureGateOk =
    experience !== 'gestao' || accessRules.desempenhoInstitucional;

  if (!hasExperience(access, experience) || !featureGateOk) {
    return <Navigate to={getDefaultRouteForUser(user, accessRules, access)} replace />;
  }

  return <>{children}</>;
};
