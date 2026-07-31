import * as React from 'react';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarIes } from '@/features/gestor/shell/SidebarIes';
import { SidebarNav } from '@/features/gestor/shell/SidebarNav';

/** Iniciais do nome (até 2), para o avatar do rodapé. */
const iniciaisDe = (nome: string | undefined): string =>
  (nome ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Shell do Portal do Gestor v2 (spec §8.3).
 *
 * Sidebar fixa de 240px (`w-60`), SEM header no topo do conteúdo. De cima para
 * baixo: lockup SanarFlix Academy (48px) → instituição → nav de 3 itens →
 * rodapé com tema, perfil e sair. A área de conteúdo é a única que rola.
 *
 * Marca: duas `<img>` (clara/branca) alternadas por `dark:` — nunca
 * `filter: invert()`, nunca redesenho, nunca sombra colorida.
 */
export const GestorShell: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex h-full w-60 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar py-4 text-sidebar-foreground">
        <div className="flex min-h-[3.5rem] items-center px-4">
          <img
            src="/sanarflix-academy-lockup.svg"
            alt="SanarFlix Academy"
            className="h-12 w-auto dark:hidden"
          />
          <img
            src="/sanarflix-academy-lockup-white.svg"
            alt=""
            aria-hidden="true"
            className="hidden h-12 w-auto dark:block"
          />
        </div>

        <div className="px-3">
          <SidebarIes />
        </div>

        <SidebarNav />

        <div className="mt-auto space-y-2 border-t border-sidebar-border px-3 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
              >
                {iniciaisDe(user?.nome)}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium">{user?.nome ?? '—'}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user?.email ?? ''}</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start gap-2 text-xs text-muted-foreground"
            onClick={() => logout()}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="h-full flex-1 overflow-y-auto">
        <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
};
