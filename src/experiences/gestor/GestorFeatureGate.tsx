import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
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
 * Index de `/gestor`: por padrão vai direto para "Visão Institucional"
 * (preservando querystring), sem esperar o carregamento das features — a
 * própria rota filha é gated por `GestorFeatureGate`. Se essa feature estiver
 * desligada para a IES, o gate devolve para `/gestor` e aí caímos no fallback:
 * primeiro módulo liberado, senão a rota default do usuário.
 */
export const GestorIndexRedirect: React.FC = () => {
  const location = useLocation();
  const { user, access } = useAuth();
  const { accessRules } = useAccessRules();
  const { hasFeature, loading } = useEffectiveFeatures();

  // Caminho feliz: manda direto para Visão Institucional, mantendo os
  // parâmetros de URL (iesId, simuladoId, etc).
  if (loading || hasFeature('gestao.visao_institucional')) {
    return <Navigate to={{ pathname: '/gestor/visao-institucional', search: location.search }} replace />;
  }

  // Fallback: primeiro módulo do gestor liberado para a IES/usuário.
  const first = filterGestorNav(GESTOR_NAV, access, hasFeature)[0];
  if (first) {
    return <Navigate to={{ pathname: first.url, search: location.search }} replace />;
  }

  // Sem nenhum módulo do gestor liberado: sai do portal.
  return (
    <Navigate
      to={getDefaultRouteForUser(user, { ...accessRules, desempenhoInstitucional: false }, access)}
      replace
    />
  );
};

