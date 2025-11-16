import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Menu, User, Home, BookOpen, Zap, GraduationCap, ClipboardCheck, FileText, TrendingUp, ArrowUp, Bell, AlertTriangle, Info, X, BarChart3 } from 'lucide-react';
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
import { PasswordDialogProvider, usePasswordDialog } from '@/contexts/PasswordDialogContext';
import { NavLink, useLocation } from 'react-router-dom';
import { isB2BUser } from '@/utils/accessRules';
import { QuickActionsDock } from '@/components/home/QuickActionsDock';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const isModoProva = location.pathname.startsWith('/simulados/') && location.pathname.includes('/prova');
  const [showScrollTop, setShowScrollTop] = useState(false);

  const initials = (user?.nome || '')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <PasswordDialogProvider>
      <SidebarProvider>
        {!isModoProva && <AppSidebar />}
        <SidebarInset className="flex-1 flex flex-col min-h-screen w-full transition-all duration-300">
        {/* Header with trigger, profile and theme toggle */}
        {!isModoProva && (
        <header className="sticky top-0 z-50 h-14 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border shadow-sm flex items-center px-4 w-full">
            {/* Desktop - Menu Trigger */}
            {!isModoProva && (
              <div className="hidden md:flex items-center gap-2">
                <SidebarTrigger className="p-2 hover:bg-accent rounded-md transition-colors">
                  <Menu className="h-5 w-5 text-foreground" />
                </SidebarTrigger>
              </div>
            )}
            
            {/* Mobile - Logo */}
            <div className="flex md:hidden items-center gap-2">
              <img 
                src="/lovable-uploads/efb6cdcc-7e6b-4bd1-acc1-0dec71e055ff.png" 
                alt="Sanarflix" 
                className="h-8 w-auto"
              />
            </div>
            
            <div className="ml-auto flex items-center gap-2">
              <NotificationsCenter />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="md:hidden flex items-center justify-center gap-2 py-2 px-2 rounded-md transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out text-muted-foreground hover:bg-accent/60 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label="Perfil do usuário">
                    <User className="h-5 w-5" aria-hidden="true" />
                    <span className="text-xs font-medium">Conta</span>
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="mt-2">
                  <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <ChangePasswordMenuItem />
                  <DropdownMenuItem onClick={() => {
                    const msg = encodeURIComponent('Olá, o meu semestre na plataforma Sanarflix Academy está errado.');
                    const url = `https://wa.me/5571993120049?text=${msg}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}>
                    Semestre errado
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ThemeToggle />
            </div>
          </header>
        )}

          {/* Main content area */}
          <main className="flex-1 overflow-auto pb-20 md:pb-0">
            {children}
          </main>

          {/* Mobile bottom navigation (below 768px) */}
          {!isModoProva && (
          <nav
            aria-label="Barra de navegação móvel"
            className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-lg"
          >
            <div className="grid grid-cols-5 gap-1">
              <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.3, ease: 'easeInOut' }}>
                <NavLink to="/home" end className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'}` }>
                  <Home className="h-5 w-5" aria-hidden="true" />
                  <span className="text-[10px] font-medium">Início</span>
                </NavLink>
              </motion.div>
              <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.3, ease: 'easeInOut' }}>
                <NavLink to="/guia-estudos" end className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'}` }>
                  <BookOpen className="h-5 w-5" aria-hidden="true" />
                  <span className="text-[10px] font-medium">Guia</span>
                </NavLink>
              </motion.div>
              <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.3, ease: 'easeInOut' }}>
                <NavLink to="/simulados" end className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'}` }>
                  <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
                  <span className="text-[10px] font-medium">Simulados</span>
                </NavLink>
              </motion.div>
              <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.3, ease: 'easeInOut' }}>
                <NavLink to="/sanarclass" end className={({ isActive }) => `flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'}` }>
                  <GraduationCap className="h-5 w-5" aria-hidden="true" />
                  <span className="text-[10px] font-medium">Class</span>
                </NavLink>
              </motion.div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.button whileHover={{ y: -2 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out text-muted-foreground hover:bg-accent/60 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label="Mais">
                    <Menu className="h-5 w-5" aria-hidden="true" />
                    <span className="text-[10px] font-medium">Mais</span>
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="mb-2 min-w-[220px]">
                  <DropdownMenuItem asChild>
                    <NavLink to="/intensivao-enamed" end className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Intensivão ENAMED
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <NavLink to="/dashboard" end className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Progresso
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <NavLink to="/cronograma-enamed" end className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Cronograma ENAMED
                    </NavLink>
                  </DropdownMenuItem>
                  {isB2BUser(user) && (
                    <DropdownMenuItem asChild>
                      <NavLink to="/analytics" end className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Analytics
                      </NavLink>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </nav>
          )}
          {/* Floating actions (global) */}
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

function ChangePasswordMenuItem() {
  const { setOpen } = usePasswordDialog();
  return (
    <DropdownMenuItem onClick={() => setOpen(true)}>
      Alterar senha
    </DropdownMenuItem>
  );
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
    <div className="fixed right-4 md:right-6 bottom-24 md:bottom-6 z-40 flex items-center gap-2 md:gap-4">
      {showScrollTop && (
        <Button
          variant="default"
          size="icon"
          className="h-9 w-9 md:h-10 md:w-10 rounded-full shadow-lg"
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
import { supabase } from '@/integrations/supabase/client';
import { getBrazilDate, toBrazilDate } from '@/utils/timezone';
function NotificationsCenter() {
  const { user } = useAuth();
  const [items, setItems] = React.useState<Array<{ id: string; titulo: string; prioridade: string; created_at?: string; link_botao?: string | null }>>([]);
  const isExpired = (exp?: string) => (exp ? toBrazilDate(exp) < getBrazilDate() : false);
  React.useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, titulo, descricao, prioridade, created_at, data_expiracao, link_botao, ativo')
        .eq('ativo', true)
        .order('prioridade', { ascending: false })
        .order('created_at', { ascending: false });
      if (!mounted || !data) return;
      let filtered = data.filter((a: any) => !isExpired(a.data_expiracao));
      // Excluir avisos já vistos pelo usuário
      try {
        const { data: viewed } = await supabase
          .from('announcements_viewed')
          .select('announcement_id')
          .eq('user_id', user?.id);
        const viewedSet = new Set((viewed || []).map((v: any) => v.announcement_id));
        filtered = filtered.filter((a: any) => !viewedSet.has(a.id));
      } catch {}
      setItems(filtered);
    };
    fetchData();
    return () => {
      mounted = false;
    };
  }, [user]);
  const count = items.length;
  const markViewed = async (id: string) => {
    if (!user) return;
    try {
      await supabase.from('announcements_viewed').insert({ announcement_id: id, user_id: user.id });
    } catch (e) {
      // ignore errors (e.g., duplicate)
    }
    setItems(prev => prev.filter(i => i.id !== id));
  };
  const handleItemClick = async (a: { id: string; link_botao?: string | null }) => {
    await markViewed(a.id);
    let url = a.link_botao || '';
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="relative flex items-center justify-center gap-2 py-2 px-2 rounded-md transition-[background-color,border-color,box-shadow,transform] duration-300 ease-in-out text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">{count}</span>
          )}
        </motion.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px] p-2">
        {count === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
            <Info className="h-4 w-4" />
            Sem avisos ativos
          </div>
        ) : (
          <div className="max-h-72 overflow-auto pr-1">
            {items.map((a) => {
              const desc = a.descricao ? (a.descricao.length > 120 ? a.descricao.slice(0, 120) + '…' : a.descricao) : '';
              const isHigh = (a.prioridade?.toLowerCase().includes('alta') || a.prioridade?.toLowerCase().includes('muito'));
              return (
                <DropdownMenuItem key={a.id} className="flex items-start gap-3" onClick={() => handleItemClick(a)}>
                  {isHigh ? (
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  ) : (
                    <Bell className="h-5 w-5 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-tight line-clamp-1">{a.titulo}</div>
                    {desc && (
                      <div className="text-xs text-muted-foreground leading-snug line-clamp-2 mt-0.5">{desc}</div>
                    )}
                  </div>
                  <button className="ml-2 rounded-sm p-1 hover:bg-accent/50" onClick={(e) => { e.stopPropagation(); markViewed(a.id); }} aria-label="Dispensar aviso">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
