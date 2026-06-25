import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';
import { getExperience, getDefaultRouteForUser } from '@/utils/experiences';
import type { ExperienceId } from '@/experiences/types';

interface ExperienceGuardProps {
  /** Experiência a que esta subárvore de rotas pertence. */
  experience: ExperienceId;
  children: React.ReactNode;
}

/**
 * Bloqueio de acesso cruzado entre experiências apartadas.
 *
 * Renderiza os filhos apenas quando a experiência do usuário (resolvida por
 * {@link getExperience} a partir das suas roles) corresponde à `experience`
 * guardada. Caso contrário, redireciona o usuário para o entrypoint da SUA
 * própria experiência — o mesmo destino padrão calculado por
 * {@link getDefaultRouteForUser} usado no restante do roteador —, evitando
 * que uma role acesse telas de outra experiência.
 *
 * Pressupõe que as regras de acesso já estejam carregadas (o gate de loading
 * fica em DynamicRoutes, que monta as rotas só após `useAccessRules`).
 */
export const ExperienceGuard: React.FC<ExperienceGuardProps> = ({
  experience,
  children,
}) => {
  const { user } = useAuth();
  const { accessRules } = useAccessRules();

  if (getExperience(user) !== experience) {
    return <Navigate to={getDefaultRouteForUser(user, accessRules)} replace />;
  }

  return <>{children}</>;
};
