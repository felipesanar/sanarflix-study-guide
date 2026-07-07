import * as React from 'react';
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ADMIN_NAV, filterAdminNav } from '@/experiences/admin/AdminNav';
import { GoToStudentButton } from '@/experiences/shared/GoToStudentButton';
import { getPortalEntries } from '@/experiences/shared/globalNav';

/**
 * Layout do Portal do Admin (`/admin/*`) — shell full-page independente.
 *
 * Renderiza o cabeçalho do portal, os links para os outros portais que o
 * usuário tenha (derivados de `access.experiences`) e a sub-navegação por
 * rota (NavLink), com o conteúdo da seção ativa no {@link Outlet}. Cada seção
 * tem URL própria — o que habilita deep-link, voltar/avançar e refresh. As
 * seções visíveis dependem das capabilities do usuário (ver
 * {@link filterAdminNav}) — o Atendimento (CX), que também monta esta árvore,
 * só enxerga "Usuários" (`users.support` não concede as demais).
 */
export const AdminLayout: React.FC = () => {
  const { access } = useAuth();
  const navItems = filterAdminNav(ADMIN_NAV, access);
  // Outros portais do usuário, exceto o Admin (já estamos nele).
  const otherPortals = getPortalEntries(access).filter((entry) => entry.url !== '/admin/usuarios');

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
              <Shield className="h-10 w-10 text-primary" />
              Portal do Administrador
            </h1>
            <p className="text-muted-foreground">
              Gerencie usuários, configurações e todos os aspectos da plataforma
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {otherPortals.map(({ title, url, icon: Icon }) => (
              <NavLink
                key={url}
                to={url}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                {title}
              </NavLink>
            ))}
            <GoToStudentButton />
          </div>
        </div>

        {/* Sub-navegação por rota */}
        <nav
          aria-label="Seções do Portal do Admin"
          className="flex gap-1 overflow-x-auto border-b border-border pb-px"
        >
          {navItems.map(({ title, url, icon: Icon }) => (
            <NavLink
              key={url}
              to={url}
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-t-md px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )
              }
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
              {title}
            </NavLink>
          ))}
        </nav>

        {/* Conteúdo da seção ativa (carregada sob demanda) */}
        <Suspense
          fallback={<div className="min-h-[40vh]" aria-busy="true" />}
        >
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
};
