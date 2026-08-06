import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Index de `/gestor`: vai direto para "Visão Institucional", preservando a
 * querystring (iesId, simuladoId, etc). Os módulos não têm mais gate por
 * feature — ExperienceGuard (gestao.enabled) já é o único portão da
 * experiência inteira antes de chegar aqui.
 */
export const GestorIndexRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={{ pathname: '/gestor/visao-institucional', search: location.search }} replace />;
};
