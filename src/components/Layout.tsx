import React, { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Menu, User, Home, BookOpen, Zap } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { NavLink } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const [changeOpen, setChangeOpen] = useState(false);

  const initials = (user?.nome || '')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header with trigger, profile and theme toggle */}
          <header className="h-14 bg-background border-b border-border shadow-sm flex items-center px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="p-2 hover:bg-accent rounded-md transition-colors-smooth">
                <Menu className="h-5 w-5 text-foreground" />
              </SidebarTrigger>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="hidden sm:inline-block max-w-[160px] truncate text-sm">{user?.nome || 'Usuário'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Conta</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setChangeOpen(true)}>
                    Alterar senha
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ThemeToggle />
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto pb-16 md:pb-0 transition-all duration-300">
            {children}
          </main>

          {/* Mobile bottom navigation (below 768px) */}
          <nav
            aria-label="Barra de navegação móvel"
            className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-t border-border px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
          >
            <div className="grid grid-cols-4 gap-2">
              <NavLink to="/home" end className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-all duration-300 ${isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'}` }>
                <Home className="h-5 w-5" aria-hidden="true" />
                <span className="text-[11px]">Início</span>
              </NavLink>
              <NavLink to="/guia-estudos" end className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-all duration-300 ${isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'}` }>
                <BookOpen className="h-5 w-5" aria-hidden="true" />
                <span className="text-[11px]">Guia</span>
              </NavLink>
              <NavLink to="/intensivao-enamed" end className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-all duration-300 ${isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'}` }>
                <Zap className="h-5 w-5" aria-hidden="true" />
                <span className="text-[11px]">Intensivão</span>
              </NavLink>
              <button className="flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-all duration-300 text-muted-foreground hover:bg-accent/50" aria-label="Abrir menu">
                <SidebarTrigger className="rounded-full">
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </SidebarTrigger>
                <span className="text-[11px]">Menu</span>
              </button>
            </div>
          </nav>
        </div>
      </div>

      <ChangePasswordDialog open={changeOpen} onOpenChange={setChangeOpen} />
    </SidebarProvider>
  );
};
