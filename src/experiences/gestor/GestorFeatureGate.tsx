import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { GESTOR_NAV, filterGestorNav } from '@/experiences/gestor/GestorNav';
import { getDefaultRouteForUser } from '@/utils/experiences';

interface GestorFeatureGateProps {
  featureKey: string;
  children: React.ReactNode;
}

/**
 * Gate por feature das rotas-filhas de `/gestor`. Feature desligada para a
 * IES → volta ao index do portal (que resolve a primeira tela ligada via
 * GestorIndexRedirect — sem loop: se nada estiver ligado, o index sai do
 * portal).
 */
export const GestorFeatureGate: React.FC<GestorFeatureGateProps> = ({
  featureKey,
  children,
}) => {
  const { hasFeature, loading } = useEffectiveFeatures();
  if (loading) return null;
  if (!hasFeature(featureKey)) return <Navigate to="/gestor" replace />;
  return <>{children}</>;
};

/**
 * Index de `/gestor`: redireciona para a primeira tela ligada (nav já
 * filtrada por capability+feature). Sem nenhuma tela ligada, sai do portal
 * para a experiência base do usuário (sem considerar gestao, para não
 * voltar aqui).
 */
export const GestorIndexRedirect: React.FC = () => {
  const { user, access } = useAuth();
  const { accessRules } = useAccessRules();
  const { hasFeature, loading } = useEffectiveFeatures();
  if (loading) return null;
  const first = filterGestorNav(GESTOR_NAV, access, hasFeature)[0];
  if (first) return <Navigate to={first.url} replace />;
  return (
    <Navigate
      to={getDefaultRouteForUser(user, { ...accessRules, desempenhoInstitucional: false }, access)}
      replace
    />
  );
};
