import * as React from 'react';
import { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { GestorIndexRedirect } from '@/experiences/gestor/GestorFeatureGate';
import { GestorShell } from '@/features/gestor/shell/GestorShell';

/** Chave nova do `feature_catalog`, sob o master `gestao.enabled` (spec §9). */
export const PORTAL_V2_FEATURE = 'gestao.portal_v2';

// O layout legado é lazy de propósito: quem tem o portal v2 ligado nunca
// baixa o bundle de `components/analytics/v2` (orçamento da spec §8.5).
const GestorLayoutLegado = lazy(() =>
  import('@/experiences/gestor/GestorLayout').then((m) => ({ default: m.GestorLayout })),
);
const Inicio = lazy(() => import('@/features/gestor/routes/Inicio'));

const Espera: React.FC = () => (
  <div className="min-h-screen bg-background" aria-busy="true" />
);

/**
 * Shell da árvore `/gestor`: com `gestao.portal_v2` ligada serve o portal novo
 * (sidebar de 240px); sem ela mantém EXATAMENTE o layout atual (spec §7.5, §9).
 *
 * Uma árvore só, porque `buildAppRoutes` é síncrono e não conhece features —
 * duas árvores irmãs no mesmo path deixariam a segunda inalcançável.
 */
export const GestorPortalShell: React.FC = () => {
  const { hasFeature, loading } = useEffectiveFeatures();
  if (loading) return null;
  return (
    <Suspense fallback={<Espera />}>
      {hasFeature(PORTAL_V2_FEATURE) ? <GestorShell /> : <GestorLayoutLegado />}
    </Suspense>
  );
};

/** Rota exclusiva do portal v2: sem a flag, volta ao index de `/gestor`. */
export const PortalV2Gate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasFeature, loading } = useEffectiveFeatures();
  if (loading) return null;
  if (!hasFeature(PORTAL_V2_FEATURE)) return <Navigate to="/gestor" replace />;
  return <>{children}</>;
};

/**
 * Rota exclusiva das 5 telas legadas: com o portal v2 ligado elas saem do ar
 * para essa IES (o shell novo não monta o GestorFiltersProvider que elas exigem).
 */
export const LegacyGestorGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasFeature, loading } = useEffectiveFeatures();
  if (loading) return null;
  if (hasFeature(PORTAL_V2_FEATURE)) return <Navigate to="/gestor" replace />;
  return <>{children}</>;
};

/** Index de `/gestor`: Início novo com a flag; `GestorIndexRedirect` atual sem ela (spec §9). */
export const GestorIndexSwitch: React.FC = () => {
  const { hasFeature, loading } = useEffectiveFeatures();
  if (loading) return null;
  if (!hasFeature(PORTAL_V2_FEATURE)) return <GestorIndexRedirect />;
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
      <Inicio />
    </Suspense>
  );
};
