import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { useMe } from '@/features/mentor/api/queries';
import '@/features/gestor/gestor-theme.css';
import '@/features/gestor/dende-icons.css';
import './mentor-shell.css';

export function GuardPortalMentor({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.data?.portalMentor === false) return <Navigate to="/" replace />;
  // Falha de refetch com identidade em cache não desmonta as telas operacionais.
  if (me.data) return <>{children}</>;
  return (
    <div className="gestor-portal mentor-portal">
      {me.isError ? (
        <main className="mentor-main">
          <EstadoErro
            titulo="Não foi possível carregar o portal do mentor."
            onRetry={() => void me.refetch()}
            tentandoNovamente={me.isFetching}
          />
        </main>
      ) : (
        <div className="mentor-shell-loading" role="status" aria-label="Carregando o portal do mentor" aria-busy="true">
          <div className="mentor-sidebar-loading" aria-hidden="true">
            <GestorSkeleton altura={30} />
            <GestorSkeleton altura={64} />
            <GestorSkeleton altura={240} />
          </div>
          <div className="mentor-main">
            <GestorSkeleton altura={80} rotulo="Carregando contexto" />
            <GestorSkeleton altura={104} rotulo="Carregando indicadores" />
            <GestorSkeleton altura={280} rotulo="Carregando conteúdo" />
          </div>
        </div>
      )}
    </div>
  );
}
