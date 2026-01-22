import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, ChevronRight, Bell, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getBrazilDate, toBrazilDate } from '@/utils/timezone';

interface Announcement {
  id: string;
  titulo: string;
  descricao: string;
  link_botao: string | null;
  texto_botao: string;
  paleta_cores: string;
  prioridade: string;
  created_at?: string;
  data_expiracao?: string;
}

const priorityIcons = {
  'Muito Alta': AlertCircle,
  'Alta': AlertTriangle,
  'Media': Bell,
  'Baixa': Info,
};

export const AnnouncementsCard: React.FC = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [popupAnnouncement, setPopupAnnouncement] = useState<Announcement | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAnnouncements();
    }
  }, [user]);

  const fetchAnnouncements = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('announcements')
      .select('id, titulo, descricao, link_botao, texto_botao, paleta_cores, prioridade, created_at, data_expiracao')
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar avisos:', error);
      return;
    }

    if (data && data.length > 0) {
      const now = getBrazilDate();
      const active = data.filter((a: any) => !a.data_expiracao || toBrazilDate(a.data_expiracao) >= now);
      const weight = (p: string) => {
        const x = (p || '').toLowerCase();
        if (x.includes('muito')) return 3;
        if (x.includes('alta')) return 2;
        if (x.includes('med')) return 1;
        return 0;
      };
      const sorted = active.sort((a: any, b: any) => {
        const dw = weight(b.prioridade) - weight(a.prioridade);
        if (dw !== 0) return dw;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        return bt - at;
      });
      setAnnouncements(sorted);
      
      const highPriorityAnnouncement = data.find(a => a.prioridade === 'Muito Alta');
      if (highPriorityAnnouncement) {
        checkAndShowPopup(highPriorityAnnouncement);
      }
    }
  };

  const checkAndShowPopup = async (announcement: Announcement) => {
    if (!user) return;

    const { data: viewed } = await supabase
      .from('announcements_viewed')
      .select('id')
      .eq('announcement_id', announcement.id)
      .eq('user_id', user.id)
      .single();

    if (!viewed) {
      setPopupAnnouncement(announcement);
      setShowPopup(true);
    }
  };

  const handleClosePopup = async () => {
    if (!popupAnnouncement || !user) return;

    await supabase
      .from('announcements_viewed')
      .insert({
        announcement_id: popupAnnouncement.id,
        user_id: user.id,
      });

    setShowPopup(false);
    setPopupAnnouncement(null);
  };

  const handleAnnouncementClick = (announcement: Announcement) => {
    if (announcement.link_botao) {
      let url = announcement.link_botao;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      window.open(url, '_blank');
    }
  };

  const mainAnnouncement = announcements[0];
  
  if (!mainAnnouncement) {
    // Fallback card when no announcements
    return (
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 shadow-sm hover:shadow-md transition-shadow duration-300 h-full">
        <CardContent className="p-6 h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-white/80 text-sm font-medium">Pesquisa de Satisfação</span>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Sua opinião molda o futuro da plataforma. Ajude-nos a melhorar sua experiência.
            </p>
          </div>
          <Button 
            variant="secondary"
            className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white border-0"
          >
            Responder agora
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const IconComponent = priorityIcons[mainAnnouncement.prioridade as keyof typeof priorityIcons] || Bell;

  // Determine gradient based on palette
  const getGradient = (palette: string) => {
    const gradients: Record<string, string> = {
      flame: 'from-red-600 to-orange-500 dark:from-red-700 dark:to-orange-600',
      emerald: 'from-emerald-600 to-teal-500 dark:from-emerald-700 dark:to-teal-600',
      royal: 'from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700',
      sunset: 'from-orange-500 to-rose-500 dark:from-orange-600 dark:to-rose-600',
      amethyst: 'from-violet-600 to-fuchsia-600 dark:from-violet-700 dark:to-fuchsia-700',
    };
    return gradients[palette] || gradients.royal;
  };

  return (
    <>
      <Card className={`relative overflow-hidden border-0 bg-gradient-to-br ${getGradient(mainAnnouncement.paleta_cores)} shadow-sm hover:shadow-md transition-shadow duration-300 h-full`}>
        <CardContent className="p-6 h-full flex flex-col justify-between relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <IconComponent className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-semibold text-base">
                {mainAnnouncement.titulo}
              </span>
            </div>
            <p className="text-white/80 text-sm leading-relaxed line-clamp-3">
              {mainAnnouncement.descricao}
            </p>
          </div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button 
              onClick={() => handleAnnouncementClick(mainAnnouncement)}
              variant="secondary"
              className="w-full mt-4 bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm font-medium"
            >
              {mainAnnouncement.texto_botao}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </CardContent>
        
        {/* Decorative blur */}
        <div className="pointer-events-none absolute -bottom-20 -right-20 w-48 h-48 bg-white/10 blur-3xl rounded-full" />
      </Card>

      {/* Pop-up Modal */}
      <AnimatePresence>
        {showPopup && popupAnnouncement && (
          <Dialog open={showPopup} onOpenChange={handleClosePopup}>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br ${getGradient(popupAnnouncement.paleta_cores)} rounded-xl flex items-center justify-center`}>
                    {(() => {
                      const PopupIcon = priorityIcons[popupAnnouncement.prioridade as keyof typeof priorityIcons] || Bell;
                      return <PopupIcon className="h-6 w-6 text-white" />;
                    })()}
                  </div>
                  <DialogTitle className="text-lg font-semibold flex-1">
                    {popupAnnouncement.titulo}
                  </DialogTitle>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {popupAnnouncement.descricao}
                </p>

                <Button 
                  className="w-full rounded-xl"
                  onClick={handleClosePopup}
                >
                  Estou ciente
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
};
