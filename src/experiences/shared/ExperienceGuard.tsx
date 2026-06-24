import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';
import {
  getExperience,
  getDefaultRouteForUser,
  type Experience,
} from '@/utils/experiences';

interface Props {
  experience: Experience;
  children?: React.ReactNode;
}

/** Garante que o usuário só acesse a árvore de rotas da sua própria experiência. */
export const ExperienceGuard: React.FC<Props> = ({ experience, children }) => {
  const { user } = useAuth();
  const { accessRules } = useAccessRules();

  if (getExperience(user) !== experience) {
    return <Navigate to={getDefaultRouteForUser(user, accessRules)} replace />;
  }
  return <>{children}</>;
};
