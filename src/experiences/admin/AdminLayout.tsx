import * as React from 'react';
import { Suspense } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, UserCog } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { hasExperience } from '@/experiences/access';
import { cn } from '@/lib/utils';
import { isRouteActive } from '@/experiences/shared/navActive';
import { GoToStudentButton } from '@/experiences/shared/GoToStudentButton';
import { ADMIN_NAV_GROUPS, CX_NAV_GROUPS, filterAdminNav, type AdminNavGroup } from '@/experiences/admin/AdminNav';
import { useAdminAttention } from '@/services/admin/useAdminAttention';

/** Portal renderizado pelo {@link ConsoleShell} — o admin e o CX (Atendimento) reusam o MESMO shell. */
export type ConsolePortal = 'admin' | 'cx';

const PORTAL_ROOT: Record<ConsolePortal, string> = { admin: '/admin', cx: '/atendimento' };
const PORTAL_LABEL: Record<ConsolePortal, string> = { admin: 'PORTAL DO ADMIN', cx: 'ATENDIMENTO · CX' };
const PORTAL_USER_SUBTITLE: Record<ConsolePortal, string> = { admin: 'Operações · Admin', cx: 'Atendimento · CX' };

/** É o item raiz do console (`/admin` ou `/atendimento`) — usa correspondência exata para não ficar sempre ativo. */
const isConsoleRoot = (url: string): boolean => url === '/admin' || url === '/atendimento';

const isNavItemActive = (pathname: string, url: string): boolean =>
  isConsoleRoot(url) ? pathname === url : isRouteActive(pathname, url);

const initialsOf = (nome: string | undefined): string =>
  (nome ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Shell compartilhado dos consoles Admin e Atendimento (CX) — sidebar shadcn
 * agrupada (largura ~260px, colapsável em Sheet no mobile), SEM topbar (cada
 * página renderiza o próprio header).
 *
 * Reusado por {@link AdminLayout} (`portal="admin"`) e
 * `AtendimentoLayout` (`portal="cx"`) — mesma árvore de componentes, nav e
 * capabilities diferentes. O portal switch (Admin|CX) só aparece quando o
 * usuário tem AMBAS as experiências.
 */
export const ConsoleShell: React.FC<{ portal: ConsolePortal }> = ({ portal }) => {
  const { user, access, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const showPortalSwitch = hasExperience(access, 'admin') && hasExperience(access, 'atendimento');
  // A RPC `admin_command_center` exige role admin — o CX não a chama.
  const { attention } = useAdminAttention({ enabled: portal === 'admin' });

  const rawGroups: AdminNavGroup[] = portal === 'admin' ? ADMIN_NAV_GROUPS : CX_NAV_GROUPS;
  const navGroups = filterAdminNav(rawGroups, access);

  const initials = initialsOf(user?.nome);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">S</span>
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm">
                <span className="font-bold">Sanar</span>{' '}
                <span className="text-muted-foreground">Academy</span>
              </p>
              <p className="truncate font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {PORTAL_LABEL[portal]}
              </p>
            </div>
          </div>

          {showPortalSwitch && (
            <div className="flex rounded-lg border border-border bg-muted p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => navigate(PORTAL_ROOT.admin)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 transition-colors',
                  portal === 'admin' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => navigate(PORTAL_ROOT.cx)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 transition-colors',
                  portal === 'cx' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                CX
              </button>
            </div>
          )}
        </SidebarHeader>

        <SidebarContent className="px-2">
          {navGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = isNavItemActive(location.pathname, item.url);
                    const badgeCount = item.badgeKey ? attention?.[item.badgeKey] : undefined;
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          className={active ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary' : undefined}
                        >
                          <NavLink to={item.url} end>
                            {item.icon && <item.icon className="h-4 w-4" aria-hidden="true" />}
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                        {!!badgeCount && <SidebarMenuBadge>{badgeCount}</SidebarMenuBadge>}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="gap-3 px-3 py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" disabled>
                  <UserCog className="h-4 w-4" aria-hidden="true" />
                  Acessar como aluno
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">Selecione um usuário em Usuários para impersonar.</TooltipContent>
          </Tooltip>

          <GoToStudentButton className="w-full justify-start" />

          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials || <UserIcon className="h-4 w-4" aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.nome ?? '—'}</p>
              <p className="truncate text-xs text-muted-foreground">{PORTAL_USER_SUBTITLE[portal]}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <ThemeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void logout()} aria-label="Sair">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Sair</TooltipContent>
            </Tooltip>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold">Sanar Academy</span>
        </div>

        <div className="flex-1 p-4 md:p-8">
          <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
            <Outlet />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

/**
 * Layout do Portal do Admin (`/admin/*`) — {@link ConsoleShell} parametrizado
 * como `portal="admin"`. O Atendimento (CX) reusa o MESMO shell (ver
 * `AtendimentoLayout`), com a navegação e capabilities do portal CX.
 */
export const AdminLayout: React.FC = () => <ConsoleShell portal="admin" />;
