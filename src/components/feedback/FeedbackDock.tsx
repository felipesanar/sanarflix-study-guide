import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { MessageSquareHeart, MessageSquarePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useFeedback } from './FeedbackProvider';
import { FeedbackTriggerMenu } from './FeedbackTriggerMenu';

const HINT_KEY = 'feedback_hint_seen_v1';

export const FeedbackDock: React.FC = () => {
  const { user } = useAuth();
  const { audience, open: sheetOpen } = useFeedback();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [showHint, setShowHint] = React.useState(false);
  const [unread, setUnread] = React.useState(0);

  // Não aparece no Modo Prova nem em rotas do gestor (gestor usa o botão no header)
  const isModoProva =
    location.pathname.startsWith('/simulados/') && location.pathname.includes('/prova');
  const isGestorRoute = location.pathname.startsWith('/gestor');

  // Micro-tooltip de descoberta na primeira sessão
  React.useEffect(() => {
    if (!user?.id || audience !== 'aluno') return;
    try {
      const seen = localStorage.getItem(HINT_KEY);
      if (!seen) {
        const t = window.setTimeout(() => setShowHint(true), 2500);
        const hide = window.setTimeout(() => {
          setShowHint(false);
          localStorage.setItem(HINT_KEY, '1');
        }, 8500);
        return () => {
          window.clearTimeout(t);
          window.clearTimeout(hide);
        };
      }
    } catch {}
  }, [user?.id, audience]);

  // Badge: quantas respostas dos últimos 7 dias (proxy de "não lidas")
  React.useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('user_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('admin_response', 'is', null)
        .gte('responded_at', sevenAgo);
      if (!cancelled) setUnread(count ?? 0);
    };
    load();
    const iv = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [user?.id, sheetOpen]);

  if (isModoProva || isGestorRoute || !user?.id) return null;

  const trigger = isMobile ? (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.92 }}
      aria-label="Falar com a equipe"
      className="relative inline-flex items-center justify-center h-13 w-13 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 border border-primary/40"
      style={{ height: 52, width: 52 }}
    >
      <MessageSquareHeart className="h-6 w-6" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center border-2 border-background">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </motion.button>
  ) : (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Falar com a equipe (Shift+F)"
      title="Falar com a equipe (Shift+F)"
      className="relative inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 border border-primary/40 hover:shadow-xl transition-all"
    >
      <MessageSquarePlus className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center border-2 border-background">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </motion.button>
  );

  return (
    <div
      className="fixed z-40 pointer-events-auto"
      style={{
        right: 16,
        bottom: isMobile
          ? 'calc(env(safe-area-inset-bottom, 0px) + 76px)'
          : 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
      }}
    >
      {/* Hint discreto pra descoberta */}
      <AnimatePresence>
        {showHint && !menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-full right-0 mb-2 w-64 rounded-xl bg-foreground text-background text-xs p-3 shadow-xl"
          >
            <div className="font-medium mb-0.5">Achou algo estranho? 👀</div>
            <div className="opacity-80">Fala com a gente aqui — leitura garantida pela equipe.</div>
            <span className="absolute -bottom-1 right-6 w-3 h-3 rotate-45 bg-foreground" />
          </motion.div>
        )}
      </AnimatePresence>

      {isMobile ? (
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Falar com a equipe"
            className="block"
          >
            {trigger}
          </button>
          <SheetContent side="bottom" className="rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
            <FeedbackTriggerMenu audience={audience} onClose={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={12}
            className="w-96 max-h-[75vh] overflow-auto rounded-2xl shadow-xl p-4"
          >
            <FeedbackTriggerMenu audience={audience} onClose={() => setMenuOpen(false)} />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
