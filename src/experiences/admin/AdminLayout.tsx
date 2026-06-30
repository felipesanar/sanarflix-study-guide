import * as React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/accessRules';
import { cn } from '@/lib/utils';
import { ADMIN_NAV, filterAdminNav } from '@/experiences/admin/AdminNav';

/**
 * Layout do Portal do Admin (`/admin/*`).
 *
 * Renderiza o cabeçalho do portal e a sub-navegação por rota (NavLink), com o
 * conteúdo da seção ativa no {@link Outlet}. Cada seção tem URL própria — o que
 * habilita deep-link, voltar/avançar e refresh. O Atendimento (CX) enxerga
 * apenas a seção "Usuários" (ver {@link filterAdminNav}).
 */
export const AdminLayout: React.FC = () => {
  const { user } = useAuth();
  const navItems = filterAdminNav(ADMIN_NAV, { isAdmin: isAdmin(user) });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-10 w-10 text-primary" />
            Portal do Administrador
          </h1>
          <p className="text-muted-foreground">
            Gerencie usuários, configurações e todos os aspectos da plataforma
          </p>
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

        {/* Conteúdo da seção ativa */}
        <Outlet />
      </div>
    </div>
  );
};
