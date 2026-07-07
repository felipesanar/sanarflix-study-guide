import * as React from "react";
import { Suspense, useMemo } from "react";
import { useRoutes } from "react-router-dom";
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';
import { buildAppRoutes } from '@/experiences/buildAppRoutes';
import { PasswordChangeModal } from '@/components/PasswordChangeModal';
import { HomePageSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Roteador da área autenticada.
 *
 * As rotas são montadas por {@link buildAppRoutes}(user, accessRules) — função
 * pura que resolve a experiência do usuário e devolve os RouteObject[] da sua
 * experiência (aluno+professor com a Home na raiz, etc.) mais as rotas
 * compartilhadas — e aplicadas via `useRoutes`.
 *
 * Segmentação de login: cada role cai na sua experiência e tentativas de
 * acesso fora dela voltam ao entrypoint correto (redirects embutidos nas
 * rotas). O gate de loading evita "flash" de redirecionamento enquanto as
 * `ies_features` ainda estão sendo carregadas.
 */
export const DynamicRoutes: React.FC = () => {
  const { user, needsPasswordChange } = useAuth();
  const { accessRules, loading } = useAccessRules();

  // useRoutes é um hook: deve ser chamado incondicionalmente, antes de
  // qualquer retorno antecipado (o gate de loading abaixo).
  const routeObjects = useMemo(
    () => buildAppRoutes(user, accessRules),
    [user, accessRules],
  );
  const element = useRoutes(routeObjects);

  // Mostrar skeleton enquanto carrega as features do banco.
  // Isso evita "flash" de redirecionamento incorreto.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-48 mx-auto" />
            <Skeleton className="h-3 w-32 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PasswordChangeModal isOpen={needsPasswordChange} />
      <Suspense fallback={<HomePageSkeleton />}>{element}</Suspense>
    </>
  );
};
