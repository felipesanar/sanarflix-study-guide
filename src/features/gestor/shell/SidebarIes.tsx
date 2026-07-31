import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Instituição em foco na sidebar.
 *
 * Nesta versão é sempre rótulo estático — o caso do papel `gestor` (spec §3).
 * A Task 26 generaliza para `admin` e `gestor_grupo` (dropdown), lendo
 * `podeTrocarIes` do servidor em vez de checar role no cliente.
 */
export const SidebarIes: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="px-1">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Instituição
      </p>
      <p
        className="truncate text-sm font-semibold text-sidebar-foreground"
        title={user?.ies_nome ?? ''}
      >
        {user?.ies_nome ?? '—'}
      </p>
    </div>
  );
};
