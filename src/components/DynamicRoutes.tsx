import * as React from "react";
import { Suspense, useMemo } from "react";
import { useRoutes } from "react-router-dom";
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';
import { buildAppRoutes } from '@/experiences/buildAppRoutes';
import { PasswordChangeModal } from '@/components/PasswordChangeModal';
import { PhoneCollectionModal } from '@/components/PhoneCollectionModal';
import { HomePageSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

/**
 * Roteador da área autenticada.
 *
 * As rotas são montadas por {@link buildAppRoutes}(user, accessRules, access) —
 * função pura que resolve as experiências do usuário (`access.experiences`) e
 * devolve os RouteObject[] das árvores irmãs (aluno na base + portais
 * dedicados por cima) mais as rotas compartilhadas — e aplicadas via
 * `useRoutes`.
 *
 * Segmentação de login: cada role cai na sua experiência e tentativas de
 * acesso fora dela voltam ao entrypoint correto (redirects embutidos nas
 * rotas). O gate de loading evita "flash" de redirecionamento enquanto as
 * `ies_features` ainda estão sendo carregadas.
 */
export const DynamicRoutes: React.FC = () => {
  const { user, access, needsPasswordChange, isImpersonating } = useAuth();
  const { accessRules, loading, refetching, error, refetch } = useAccessRules();

  // useRoutes é um hook: deve ser chamado incondicionalmente, antes de
  // qualquer retorno antecipado (o gate de loading abaixo).
  const routeObjects = useMemo(
    () => buildAppRoutes(user, accessRules, access),
    [user, accessRules, access],
  );
  const element = useRoutes(routeObjects);

  // Erro ao carregar as permissões (RPC falhou após os retries do React
  // Query): sem isso, accessRules cairia todo em `false` e o usuário entraria
  // num loop de redirecionamento silencioso em /home — sem UI de erro.
  if (error && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-xl font-semibold">
            Não foi possível carregar suas permissões
          </h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => refetch()} disabled={refetching}>
            {refetching ? 'Tentando novamente…' : 'Tentar novamente'}
          </Button>
        </div>
      </div>
    );
  }

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
