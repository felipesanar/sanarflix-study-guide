import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, FileSearch, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GestorV2NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Navegação canônica do Portal do Gestor v2 — 3 itens, nada mais (spec §2.1, §8.3). */
export const GESTOR_V2_NAV: GestorV2NavItem[] = [
  { title: 'Início', url: '/gestor', icon: Home },
  { title: 'Visão Geral', url: '/gestor/visao-geral', icon: BarChart3 },
  { title: 'Detalhamento', url: '/gestor/detalhamento', icon: FileSearch },
];

/**
 * Navegação da sidebar. Cada link carrega a query string atual, para que o
 * recorte global (semestre/simulados/IES) sobreviva à troca de tela — caso de
 * teste 12 da spec §12.
 *
 * `end` no item raiz (`/gestor`) evita que o Início fique sempre ativo — mesmo
 * cuidado que o `isConsoleRoot` do ConsoleShell do admin.
 */
export const SidebarNav: React.FC = () => {
  const location = useLocation();

  return (
    <nav aria-label="Seções do portal do gestor" className="flex flex-col gap-1 px-3">
      {GESTOR_V2_NAV.map(({ title, url, icon: Icon }) => (
        <NavLink
          key={url}
          to={{ pathname: url, search: location.search }}
          end={url === '/gestor'}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          {title}
        </NavLink>
      ))}
    </nav>
  );
};
