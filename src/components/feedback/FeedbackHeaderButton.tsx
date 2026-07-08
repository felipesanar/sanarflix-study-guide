import React from 'react';
import { LifeBuoy } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useFeedback } from './FeedbackProvider';
import { FeedbackTriggerMenu } from './FeedbackTriggerMenu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Botão de "Suporte" para o header do GestorLayout — variante executiva,
 * sem FAB pulsante. Abre o mesmo drawer/menu, adaptado para o público gestor.
 */
export const FeedbackHeaderButton: React.FC<{ className?: string }> = ({ className }) => {
  const { user } = useAuth();
  const { audience, open: sheetOpen } = useFeedback();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);

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

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 text-xs gap-1.5 text-muted-foreground relative ${className ?? ''}`}
        >
          <LifeBuoy className="h-3.5 w-3.5" /> Suporte
          {unread > 0 && (
            <span className="ml-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-96 max-h-[75vh] overflow-auto rounded-2xl shadow-xl p-4"
      >
        <FeedbackTriggerMenu audience={audience} onClose={() => setMenuOpen(false)} />
      </PopoverContent>
    </Popover>
  );
};
