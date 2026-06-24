import { NavLink, Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/utils/accessRules';
import { adminNav } from './AdminNav';

/** Casca do Portal do Admin: header + abas-como-rotas (NavLink) + Outlet. */
export default function AdminLayout() {
  const { user } = useAuth();
  // Atendimento (CX) só enxerga Usuários; admin vê tudo.
  const nav = isAdmin(user)
    ? adminNav
    : adminNav.filter((i) => i.url === '/admin/usuarios');

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-10 w-10 text-primary" /> Portal do Administrador
          </h1>
        </header>
        <nav className="flex flex-wrap gap-2 border-b">
          {nav.map(({ title, url, icon: Icon }) => (
            <NavLink
              key={url}
              to={url}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-t-md text-sm ${
                  isActive
                    ? 'bg-card border-b-2 border-primary font-medium'
                    : 'text-muted-foreground'
                }`
              }
            >
              {Icon && <Icon className="h-4 w-4" />}
              {title}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
