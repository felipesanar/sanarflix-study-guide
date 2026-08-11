import * as React from 'react';
import { Suspense, lazy } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/accessRules';
import { useGestorPortalVersao } from '@/features/gestor/hooks/useGestorPortalVersao';
import { GestorIndexRedirect } from '@/experiences/gestor/GestorFeatureGate';
import { GestorShell } from '@/features/gestor/shell/GestorShell';

/** Parâmetro de URL da válvula de escape, só para admin — ver useEscapeParaLegado. */
const ESCAPE_LEGADO_PARAM = 'legado';

/**
 * Válvula de escape SOMENTE para quem tem role `admin`: força a experiência
 * legada mesmo com o rollout aprovado, quando a URL tem `?legado=1`.
 *
 * Admin sempre recebe portalNovo=true de get_gestor_portal_versao() (linha de
 * dogfooding da RPC) — sem isso, quem está operando o rollout nunca consegue
 * ver o console antigo de uma IES específica para confirmar visualmente como
 * ela está antes de aprovar. Isto NUNCA decide quem PODE acessar (isso é
 * 100% servidor); só decide, para quem já passou pelo ExperienceGuard, qual
 * das duas UIs mostrar.
 */
function useEscapeParaLegado(search: string): boolean {
  const { user } = useAuth();
  if (!isAdmin(user)) return false;
  return new URLSearchParams(search).get(ESCAPE_LEGADO_PARAM) === '1';
}

// O layout legado é lazy de propósito: quem está no portal novo nunca baixa o
// bundle de components/analytics/v2.
const GestorLayoutLegado = lazy(() =>
  import('@/experiences/gestor/GestorLayout').then((m) => ({ default: m.GestorLayout })),
);
const Inicio = lazy(() => import('@/features/gestor/routes/Inicio'));

const Espera: React.FC = () => (
  <div className="min-h-screen bg-background" aria-busy="true" />
);

/**
 * Shell da árvore `/gestor`: com o rollout aprovado para a(s) IES do usuário,
 * serve o portal novo (GestorShell); senão, o console antigo (GestorLayout).
 *
 * Uma árvore só, porque `buildAppRoutes` é síncrono e não conhece o resultado
 * da RPC — duas árvores irmãs no mesmo path deixariam a segunda inalcançável.
 */
export const GestorPortalShell: React.FC = () => {
  const { portalNovo, loading } = useGestorPortalVersao();
  const location = useLocation();
  const escapeLegado = useEscapeParaLegado(location.search);
  if (loading) return <Espera />;
  const mostraPortalNovo = portalNovo && !escapeLegado;
  return (
    <Suspense fallback={<Espera />}>
      {mostraPortalNovo ? <GestorShell /> : <GestorLayoutLegado />}
    </Suspense>
  );
};

/** Rota exclusiva do portal v2: sem o rollout aprovado, volta ao index de `/gestor`. */
export const PortalV2Gate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { portalNovo, loading } = useGestorPortalVersao();
  const location = useLocation();
  const escapeLegado = useEscapeParaLegado(location.search);
  if (loading) return <Espera />;
  if (!portalNovo || escapeLegado) {
    return <Navigate to={{ pathname: '/gestor', search: location.search }} replace />;
  }
  return <>{children}</>;
};

/**
 * Rota exclusiva das 5 telas legadas: com o rollout aprovado elas saem do ar
 * para essa IES (o shell novo não monta o GestorFiltersProvider que elas
 * exigem). Exceção: admin com `?legado=1` sempre alcança.
 */
export const LegacyGestorGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { portalNovo, loading } = useGestorPortalVersao();
  const location = useLocation();
  const escapeLegado = useEscapeParaLegado(location.search);
  if (loading) return <Espera />;
  if (portalNovo && !escapeLegado) {
    return <Navigate to={{ pathname: '/gestor', search: location.search }} replace />;
  }
  return <>{children}</>;
};

/** Index de `/gestor`: Início novo com o rollout aprovado; GestorIndexRedirect (antigo) sem ele. */
export const GestorIndexSwitch: React.FC = () => {
  const { portalNovo, loading } = useGestorPortalVersao();
  const location = useLocation();
  const escapeLegado = useEscapeParaLegado(location.search);
  if (loading) return <Espera />;
  const mostraPortalNovo = portalNovo && !escapeLegado;
  if (!mostraPortalNovo) return <GestorIndexRedirect />;
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
      <Inicio />
    </Suspense>
  );
};
