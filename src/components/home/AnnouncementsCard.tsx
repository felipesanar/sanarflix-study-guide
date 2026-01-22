import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, ChevronRight, Bell, AlertCircle, AlertTriangle, Info, Megaphone } from 'lucide-react';
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

  // Gradient configurations
  const getGradient = (palette: string) => {
    const gradients: Record<string, { bg: string; hover: string }> = {
      flame: { 
        bg: 'from-red-500 via-orange-500 to-amber-500', 
        hover: 'from-red-600 via-orange-600 to-amber-600' 
      },
      emerald: { 
        bg: 'from-emerald-500 via-teal-500 to-cyan-500', 
        hover: 'from-emerald-600 via-teal-600 to-cyan-600' 
      },
      royal: { 
        bg: 'from-blue-500 via-indigo-500 to-purple-500', 
        hover: 'from-blue-600 via-indigo-600 to-purple-600' 
      },
      sunset: { 
        bg: 'from-orange-500 via-rose-500 to-pink-500', 
        hover: 'from-orange-600 via-rose-600 to-pink-600' 
      },
      amethyst: { 
        bg: 'from-violet-500 via-purple-500 to-fuchsia-500', 
        hover: 'from-violet-600 via-purple-600 to-fuchsia-600' 
      },
    };
    return gradients[palette] || gradients.royal;
  };

  const mainAnnouncement = announcements[0];
  
  if (!mainAnnouncement) {
    // Fallback card - Premium style
    return (
      <div className="relative overflow-hidden rounded-2xl h-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 dark:from-slate-900 dark:via-slate-950 dark:to-black">
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
        
        {/* Decorative elements */}
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
        
        <div className="relative p-6 h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/90 text-base font-semibold">Pesquisa de Satisfação</span>
            </div>
            <p className="text-white/60 text-sm leading-relaxed">
              Sua opinião molda o futuro da plataforma. Ajude-nos a melhorar sua experiência.
            </p>
          </div>
          
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              variant="secondary"
              className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-sm rounded-xl h-11"
            >
              Responder agora
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  const IconComponent = priorityIcons[mainAnnouncement.prioridade as keyof typeof priorityIcons] || Bell;
  const gradient = getGradient(mainAnnouncement.paleta_cores);

  return (
    <>
      <motion.div 
        whileHover={{ scale: 1.01, y: -2 }}
        className={`relative overflow-hidden rounded-2xl h-full bg-gradient-to-br ${gradient.bg} hover:${gradient.hover} transition-all duration-300 cursor-pointer group`}
        onClick={() => handleAnnouncementClick(mainAnnouncement)}
      >
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
        
        {/* Animated glow */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/10 blur-3xl rounded-full" />
        </div>
        
        {/* Decorative blur circles */}
        <div className="pointer-events-none absolute -bottom-16 -right-16 w-40 h-40 bg-white/10 blur-3xl rounded-full" />
        <div className="pointer-events-none absolute -top-16 -left-16 w-32 h-32 bg-black/10 blur-3xl rounded-full" />
        
        <div className="relative p-6 h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <IconComponent className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-semibold text-base line-clamp-1 flex-1">
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
            className="mt-4"
          >
            <Button 
              variant="secondary"
              className="w-full bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm font-medium rounded-xl h-11 group-hover:bg-white/25 transition-colors"
            >
              {mainAnnouncement.texto_botao}
              <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Pop-up Modal */}
      <AnimatePresence>
        {showPopup && popupAnnouncement && (
          <Dialog open={showPopup} onOpenChange={handleClosePopup}>
            <DialogContent className="sm:max-w-md rounded-2xl border-0 glass-strong">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br ${getGradient(popupAnnouncement.paleta_cores).bg} rounded-xl flex items-center justify-center shadow-lg`}>
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
                  className={`w-full rounded-xl h-11 bg-gradient-to-r ${getGradient(popupAnnouncement.paleta_cores).bg} hover:opacity-90`}
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
