import * as React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, CalendarDays, Home, KanbanSquare, LogOut, Megaphone, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ExperienceSwitcher } from '@/experiences/shared/ExperienceSwitcher';
import { cn } from '@/lib/utils';
import { fetchMentorContexto } from '@/services/mentor/contexto';

/**
 * Shell do Portal do Mentor (`/mentor/*`). "Minha Turma" vira "Visão Geral"
 * para mentor b2b (sem turma própria).
 */
const NAV_ITENS = [
  { title: 'Início', url: '/mentor', icon: Home, end: true },
  { title: 'Minha Turma', url: '/mentor/turma', icon: Users, end: false },
  { title: 'Detalhamento', url: '/mentor/detalhamento', icon: BarChart3, end: false },
  { title: 'Mural', url: '/mentor/mural', icon: Megaphone, end: false },
  { title: 'Sessões', url: '/mentor/sessoes', icon: CalendarDays, end: false },
  { title: 'Intervenções', url: '/mentor/intervencoes', icon: KanbanSquare, end: false },
];

export const MentorLayout: React.FC = () => {
  const { logout } = useAuth();
  const { data: contexto } = useQuery({
    queryKey: ['mentor', 'contexto'],
    queryFn: fetchMentorContexto,
  });
  const itens = NAV_ITENS.map((item) =>
    item.url === '/mentor/turma' && contexto?.mentor?.tipo === 'b2b'
      ? { ...item, title: 'Visão Geral' }
      : item,
  );

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      {/* Abaixo de md a sidebar some: a barra do topo mantém a troca de
          experiência e o Sair ao alcance. */}
      <header className="flex items-center justify-between border-b bg-card px-4 py-2 md:hidden">
        <p className="font-semibold text-foreground">Portal do Mentor</p>
        <div className="flex items-center gap-2">
          <ExperienceSwitcher variant="compact" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void logout()} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <nav
        aria-label="Navegação do mentor"
        className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-1 md:hidden"
      >
        {itens.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm',
                isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </NavLink>
        ))}
      </nav>
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card p-4 md:flex">
        <p className="mb-4 font-semibold text-foreground">Portal do Mentor</p>
        <nav aria-label="Navegação do mentor" className="flex flex-1 flex-col gap-1">
          {itens.map((item) => (
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
      <main className="flex-1 p-4 md:p-6">
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
