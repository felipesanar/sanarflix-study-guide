import * as React from 'react';
import { Suspense, lazy } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { isAdmin } from '@/utils/accessRules';
import { GestorIndexRedirect } from '@/experiences/gestor/GestorFeatureGate';
import { GestorShell } from '@/features/gestor/shell/GestorShell';

/** Chave nova do `feature_catalog`, sob o master `gestao.enabled` (spec §9). */
export const PORTAL_V2_FEATURE = 'gestao.portal_v2';

/** Parâmetro de URL da válvula de escape do card 108 — ver {@link useEscapeParaLegado}. */
const ESCAPE_LEGADO_PARAM = 'legado';

/**
 * Válvula de escape SOMENTE para quem tem role `admin`: força a experiência
 * legada mesmo com `gestao.portal_v2` ligada, quando a URL tem `?legado=1`.
 *
 * POR QUE EXISTE (card 108, achado 24 da revisão de 03/08): `get_effective_features`
 * devolve TODAS as features como `true`, incondicional, para quem tem bypass de
 * papel — admin OU atendimento (migration 20260709155703). Isso significa que a
 * PRÓPRIA sessão do admin nunca reflete o estado real de `ies_features` de uma
 * IES: o rollback da spec §9 (`admin_set_ies_features` desligando
 * `gestao.portal_v2` para uma IES) fica invisível para quem o executa — a conta
 * que fez o rollback continua caindo direto no portal v2 e nunca alcança as 5
 * telas legadas "por URL" para confirmar que o desligamento funcionou.
 *
 * POR QUE SÓ ADMIN, não atendimento (que também tem bypass): o achado é sobre
 * quem executa/verifica o rollback, não sobre todo bypass — atendimento puro
 * nem ganha a experiência `gestao` (fora do escopo deste achado). `isAdmin` lê
 * `user.roles` do `AuthContext`, não a query string: um gestor comum que cole
 * `?legado=1` na URL não ganha nada, porque a checagem de role continua vindo
 * do cliente autenticado — o parâmetro sem a role real é só ignorado. Isto
 * NUNCA decide quem PODE acessar (isso é 100% servidor); só decide, para quem
 * JÁ passou pelo `ExperienceGuard`, qual das duas UIs mostrar.
 *
 * POR QUE UM PARÂMETRO DE URL (e não um toggle persistido/sessão): é opt-in e
 * por navegação — o admin continua dogfoodando o portal v2 por padrão (mesma
 * experiência que o gestor real vê) e só cai no legado quando precisa
 * verificar uma IES específica, sem afetar a sessão inteira nem outras abas.
 */
function useEscapeParaLegado(search: string): boolean {
  const { user } = useAuth();
  if (!isAdmin(user)) return false;
  return new URLSearchParams(search).get(ESCAPE_LEGADO_PARAM) === '1';
}

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
  const location = useLocation();
  const escapeLegado = useEscapeParaLegado(location.search);
  if (loading) return null;
  const portalV2Ligado = hasFeature(PORTAL_V2_FEATURE) && !escapeLegado;
  return (
    <Suspense fallback={<Espera />}>
      {portalV2Ligado ? <GestorShell /> : <GestorLayoutLegado />}
    </Suspense>
  );
};

/** Rota exclusiva do portal v2: sem a flag, volta ao index de `/gestor`. */
export const PortalV2Gate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasFeature, loading } = useEffectiveFeatures();
  const location = useLocation();
  const escapeLegado = useEscapeParaLegado(location.search);
  if (loading) return null;
  // Card 120: preserva a query string no redirect — perder o recorte
  // (?ies=X&semestre=3&simulados=a,b) no meio de um rollback (spec §9) forçaria
  // o gestor a remontar o filtro do zero.
  if (!hasFeature(PORTAL_V2_FEATURE) || escapeLegado) {
    return <Navigate to={{ pathname: '/gestor', search: location.search }} replace />;
  }
  return <>{children}</>;
};

/**
 * Rota exclusiva das 5 telas legadas: com o portal v2 ligado elas saem do ar
 * para essa IES (o shell novo não monta o GestorFiltersProvider que elas exigem).
 * Exceção: admin com a válvula de escape do card 108 (`?legado=1`) sempre alcança.
 */
export const LegacyGestorGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasFeature, loading } = useEffectiveFeatures();
  const location = useLocation();
  const escapeLegado = useEscapeParaLegado(location.search);
  if (loading) return null;
  // Card 120: mesmo cuidado de preservar a search no redirect (ver PortalV2Gate acima).
  if (hasFeature(PORTAL_V2_FEATURE) && !escapeLegado) {
    return <Navigate to={{ pathname: '/gestor', search: location.search }} replace />;
  }
  return <>{children}</>;
};

/** Index de `/gestor`: Início novo com a flag; `GestorIndexRedirect` atual sem ela (spec §9). */
export const GestorIndexSwitch: React.FC = () => {
  const { hasFeature, loading } = useEffectiveFeatures();
  const location = useLocation();
  const escapeLegado = useEscapeParaLegado(location.search);
  if (loading) return null;
  const portalV2Ligado = hasFeature(PORTAL_V2_FEATURE) && !escapeLegado;
  if (!portalV2Ligado) return <GestorIndexRedirect />;
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
      <Inicio />
    </Suspense>
  );
};
