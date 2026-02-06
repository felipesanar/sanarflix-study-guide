import React, { useState } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Menu, ArrowUp } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { OfflineIndicator } from './OfflineIndicator';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { PasswordDialogProvider, usePasswordDialog } from '@/contexts/PasswordDialogContext';
import { useLocation } from 'react-router-dom';
import { QuickActionsDock } from '@/components/home/QuickActionsDock';
import { useSessionTracker } from '@/hooks/useSessionTracker';
import { MobileBottomNav, MobileHeader } from '@/components/navigation';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const authContext = useAuth();
  const location = useLocation();
  const isModoProva = location.pathname.startsWith('/simulados/') && location.pathname.includes('/prova');
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Session tracking
  useSessionTracker();
  
  if (!authContext) {
    return <>{children}</>;
  }
  
  const { user } = authContext;

  return (
    <PasswordDialogProvider>
      <OfflineIndicator />
      <SidebarProvider>
        {/* Desktop Sidebar */}
        {!isModoProva && <AppSidebar />}
        
        <SidebarInset className="flex-1 flex flex-col min-h-screen min-w-0 w-full transition-all duration-300 overflow-x-clip">
          {/* Desktop Header */}
          {!isModoProva && (
            <header className="sticky top-0 z-30 h-14 hidden md:flex items-center px-4 w-full shrink-0 bg-background/80 backdrop-blur-lg border-b border-border/30">
              <SidebarTrigger className="p-2 hover:bg-accent rounded-lg transition-colors">
                <Menu className="h-5 w-5 text-foreground" />
              </SidebarTrigger>
              
              <div className="ml-auto flex items-center gap-2">
                <ThemeToggle />
              </div>
            </header>
          )}

          {/* Mobile Header */}
          {!isModoProva && <MobileHeader />}

          {/* Main content */}
          <main className="flex-1 min-w-0 overflow-auto overflow-x-clip pb-24 md:pb-0">
            {children}
          </main>

          {/* Mobile Bottom Navigation */}
          {!isModoProva && <MobileBottomNav />}

          {/* Floating actions */}
          {!isModoProva && (
            <FloatingActions showScrollTop={showScrollTop} />
          )}
          <ScrollTopWatcher setShowScrollTop={setShowScrollTop} />
        </SidebarInset>

        <PasswordDialogConsumer />
      </SidebarProvider>
    </PasswordDialogProvider>
  );
};

function PasswordDialogConsumer() {
  const { open, setOpen } = usePasswordDialog();
  return <ChangePasswordDialog open={open} onOpenChange={setOpen} />;
}

function ScrollTopWatcher({ setShowScrollTop }: { setShowScrollTop: (v: boolean) => void }) {
  React.useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [setShowScrollTop]);
  return null;
}

function FloatingActions({ showScrollTop }: { showScrollTop: boolean }) {
  return (
    <div className="fixed right-4 md:right-6 bottom-28 md:bottom-6 z-30 flex items-center gap-2 md:gap-4">
      {showScrollTop && (
        <Button
          variant="default"
          size="icon"
          className="h-10 w-10 rounded-full shadow-lg"
          aria-label="Voltar ao topo"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
      <QuickActionsDock position="inline" />
    </div>
  );
}
