
import React from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Menu } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header with trigger and theme toggle */}
          <header className="h-14 bg-background border-b border-border shadow-sm flex items-center px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="p-2 hover:bg-accent rounded-md transition-colors-smooth">
                <Menu className="h-5 w-5 text-foreground" />
              </SidebarTrigger>
            </div>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
