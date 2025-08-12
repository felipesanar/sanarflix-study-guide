import React, { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Menu, User } from 'lucide-react';
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
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>

      <ChangePasswordDialog open={changeOpen} onOpenChange={setChangeOpen} />
    </SidebarProvider>
  );
};
