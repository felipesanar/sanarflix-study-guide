import React, { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Menu, User, Home, BookOpen, Zap, BarChart3, Calendar } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessRules } from '@/utils/accessRules';
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
  const accessRules = getAccessRules(user);

  const initials = (user?.nome || '')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Dynamic mobile navigation items based on user access
  const mobileNavItems = [
    { to: '/home', icon: Home, label: 'Início', show: true },
    { to: '/guia-estudos', icon: BookOpen, label: 'Guia', show: accessRules.studyGuide },
    { to: '/intensivao-enamed', icon: Zap, label: 'Intensivão', show: accessRules.enamed },
    { to: '/desempenho-simulado', icon: BarChart3, label: 'Desempenho', show: accessRules.SimuladoDesempenho },
    { to: '/cronograma-enamed', icon: Calendar, label: 'Cronograma', show: accessRules.cronogramaEnamed },
  ].filter(item => item.show);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header with trigger, profile and theme toggle - HIDDEN ON MOBILE */}
          <header className="hidden md:flex h-14 bg-background border-b border-border shadow-sm items-center px-4">
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

          {/* Mobile bottom navigation (below 768px) - DYNAMIC BASED ON ACCESS */}
          <nav
            aria-label="Barra de navegação móvel"
            className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 border-t border-border shadow-lg"
          >
            <div 
              className="grid gap-1 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
              style={{ gridTemplateColumns: `repeat(${Math.min(mobileNavItems.length + 1, 5)}, minmax(0, 1fr))` }}
            >
              {mobileNavItems.map((item) => (
                <NavLink 
                  key={item.to}
                  to={item.to} 
                  end 
                  className={({ isActive }) => 
                    `flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all duration-300 ${
                      isActive 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  <span className="text-[10px] font-medium truncate w-full text-center">{item.label}</span>
                </NavLink>
              ))}
              
              {/* User Profile Icon */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all duration-300 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    aria-label="Menu do perfil"
                  >
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="h-3 w-3" aria-hidden="true" />
                    </div>
                    <span className="text-[10px] font-medium">Perfil</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="mb-2">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.nome || 'Usuário'}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setChangeOpen(true)}>
                    Alterar senha
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <div className="flex items-center justify-between w-full">
                      <span>Tema</span>
                      <ThemeToggle />
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </nav>
        </div>
      </div>

      <ChangePasswordDialog open={changeOpen} onOpenChange={setChangeOpen} />
    </SidebarProvider>
  );
};
