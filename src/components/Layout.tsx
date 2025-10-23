import React, { useState } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
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
      <AppSidebar />
      <SidebarInset className="flex-1 flex flex-col min-h-screen w-full transition-all duration-300">
        {/* Header with trigger, profile and theme toggle */}
        <header className="sticky top-0 z-50 h-14 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border shadow-sm flex items-center px-4 w-full">
            {/* Desktop - Menu Trigger */}
            <div className="hidden md:flex items-center gap-2">
              <SidebarTrigger className="p-2 hover:bg-accent rounded-md transition-colors">
                <Menu className="h-5 w-5 text-foreground" />
              </SidebarTrigger>
            </div>
            
            {/* Mobile - Logo */}
            <div className="flex md:hidden items-center gap-2">
              <img 
                src="/lovable-uploads/efb6cdcc-7e6b-4bd1-acc1-0dec71e055ff.png" 
                alt="Sanarflix" 
                className="h-8 w-auto"
              />
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

          {/* Main content area */}
          <main className="flex-1 overflow-auto pb-20 md:pb-0">
            {children}
          </main>

          {/* Mobile bottom navigation (below 768px) */}
          <nav
            aria-label="Barra de navegação móvel"
            className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-lg"
          >
            <div className="grid grid-cols-4 gap-1">
              <NavLink to="/home" end className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-all duration-200 ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground active:scale-95'}` }>
                <Home className="h-5 w-5" aria-hidden="true" />
                <span className="text-[10px] font-medium">Início</span>
              </NavLink>
              <NavLink to="/guia-estudos" end className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-all duration-200 ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground active:scale-95'}` }>
                <BookOpen className="h-5 w-5" aria-hidden="true" />
                <span className="text-[10px] font-medium">Guia</span>
              </NavLink>
              <NavLink to="/intensivao-enamed" end className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-all duration-200 ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground active:scale-95'}` }>
                <Zap className="h-5 w-5" aria-hidden="true" />
                <span className="text-[10px] font-medium">Intensivão</span>
              </NavLink>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-all duration-200 text-muted-foreground hover:bg-accent/60 hover:text-foreground active:scale-95" aria-label="Perfil do usuário">
                    <User className="h-5 w-5" aria-hidden="true" />
                    <span className="text-[10px] font-medium">Conta</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="mb-2">
                  <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setChangeOpen(true)}>
                    Alterar senha
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </nav>
      </SidebarInset>

      <ChangePasswordDialog open={changeOpen} onOpenChange={setChangeOpen} />
    </SidebarProvider>
  );
};
