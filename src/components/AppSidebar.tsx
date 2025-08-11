
import React from 'react';
import { BookOpen, BarChart3, LogOut, User, Zap } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { getAccessRules } from '@/utils/accessRules';

const menuItems = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: BarChart3,
    accessKey: 'dashboard' as const,
  },
  {
    title: 'Guia de Estudos',
    url: '/guia-estudos',
    icon: BookOpen,
    accessKey: 'studyGuide' as const,
  },
  {
    title: 'Intensivão ENAMED',
    url: '/intensivao-enamed',
    icon: Zap,
    accessKey: 'enamed' as const,
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { user, logout } = useAuth();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';
  const accessRules = getAccessRules(user);

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'bg-primary text-primary-foreground font-medium shadow-lg border border-primary/20'
      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-200 hover:translate-x-1';

  return (
    <Sidebar
      className={`${collapsed ? 'w-16' : 'w-64'} transition-all duration-300 border-r border-[hsl(var(--sidebar-border))] shadow-lg bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]`}
      collapsible="icon"
    >
      <SidebarHeader className={`p-4 border-b border-[hsl(var(--sidebar-border))] ${collapsed ? 'px-2' : ''}`}>>
        <div className="flex items-center gap-3">
          <img
            src="/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png"
            alt="Sanarflix - logo do site"
            className="w-10 h-10 rounded-xl shadow-lg object-contain"
          />
          {!collapsed && (
            <div className="animate-fade-in">
              <h2 className="font-bold text-lg text-[hsl(var(--sidebar-foreground))]">Sanarflix</h2>
              <p className="text-xs text-[hsl(var(--sidebar-accent-foreground))]">Guia de Estudos</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        {/* User Info */}
        {user && (
          <div className={`mb-4 p-3 bg-[hsl(var(--sidebar-accent))] rounded-lg border border-[hsl(var(--sidebar-border))] shadow-sm ${collapsed ? 'px-1' : ''}`}>>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/20 rounded-full border border-primary/30">
                <User className="h-4 w-4 text-primary-light" />
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1 animate-fade-in">
                  <p className="text-sm font-medium text-[hsl(var(--sidebar-foreground))] truncate">
                    {user.nome}
                  </p>
                  <p className="text-xs text-[hsl(var(--sidebar-accent-foreground))] truncate">
                    {user.ies_nome} - {user.semestre}º período
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className={`${collapsed ? 'sr-only' : ''} text-muted-foreground text-xs uppercase tracking-wider font-semibold`}>
            Menu Principal
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.filter(item => accessRules[item.accessKey]).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end 
                      className={getNavCls}
                    >
                      <item.icon className={`h-5 w-5 ${collapsed ? 'mx-auto' : 'mr-3'} transition-colors-smooth`} />
                      {!collapsed && (
                        <span className="animate-fade-in transition-colors-smooth">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-[hsl(var(--sidebar-border))]">
        <Button
          onClick={logout}
          variant="ghost"
          className={`w-full justify-start text-primary-light hover:text-white hover:bg-primary/20 border border-primary/20 hover:border-primary/40 transition-all duration-200 ${
            collapsed ? 'px-2' : ''
          }`}
        >
          <LogOut className={`h-4 w-4 ${collapsed ? 'mx-auto' : 'mr-2'} transition-colors-smooth`} />
          {!collapsed && <span className="font-medium">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
