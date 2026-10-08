import * as React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ExperienceSwitcher } from '@/experiences/shared/ExperienceSwitcher';
import { cn } from '@/lib/utils';

/**
 * Shell mínimo do Portal do Mentor (`/mentor/*`). Onda 1: só o Início.
 * As seções Minha Turma / Visão Geral, Mural, Sessões e Intervenções entram
 * nas próximas ondas, cada uma como item novo em NAV_ITENS.
 */
const NAV_ITENS = [{ title: 'Início', url: '/mentor', icon: Home, end: true }];

export const MentorLayout: React.FC = () => {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card p-4 md:flex">
        <p className="mb-4 font-semibold text-foreground">Portal do Mentor</p>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITENS.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                  isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t pt-3">
          <ExperienceSwitcher variant="compact" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void logout()} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6">
        {/* O Suspense do shell (DynamicRoutes) envolve o layout inteiro; este
            mantém a sidebar montada enquanto a rota filha lazy carrega — mesmo
            padrão de AdminLayout e GestorLayout. */}
        <React.Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
          <Outlet />
        </React.Suspense>
      </main>
    </div>
  );
};
