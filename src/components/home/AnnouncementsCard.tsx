import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
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
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (user) {
      fetchAnnouncements();
    }
  }, [user]);

  const fetchAnnouncements = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('announcements')
      .select('id, titulo, descricao, link_botao, texto_botao, paleta_cores, prioridade, created_at, data_expiracao, visibilidade, ies_selecionadas, ies_excluidas')
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar avisos:', error);
      return;
    }

    if (data && data.length > 0) {
      const now = getBrazilDate();
      const userIesId = user.id_ies;
      const filtered = data.filter((a: any) => {
        if (a.data_expiracao && toBrazilDate(a.data_expiracao) < now) return false;
        if (a.visibilidade === 'seletivo') {
          const selected: string[] = a.ies_selecionadas || [];
          return userIesId ? selected.includes(userIesId) : false;
        }
        if (a.visibilidade === 'exceto') {
          const excluded: string[] = a.ies_excluidas || [];
          return userIesId ? !excluded.includes(userIesId) : true;
        }
        return true;
      });
      const active = filtered;
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
    // Fallback card - Premium style with min-height
    return (
      <div className="relative overflow-hidden rounded-xl sm:rounded-2xl h-full min-h-[180px] sm:min-h-[200px] lg:min-h-[220px] bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 dark:from-slate-900 dark:via-slate-950 dark:to-black">
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
        
        {/* Decorative elements */}
        <div className="absolute -top-10 -right-10 w-24 sm:w-32 h-24 sm:h-32 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-32 sm:w-40 h-32 sm:h-40 rounded-full bg-primary/10 blur-3xl" />
        
        <div className="relative p-4 sm:p-5 lg:p-6 h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-white/90 text-sm sm:text-base font-semibold line-clamp-1">Pesquisa de Satisfação</span>
            </div>
            <p className="text-white/60 text-xs sm:text-sm leading-relaxed line-clamp-2 sm:line-clamp-3">
              Sua opinião molda o futuro da plataforma. Ajude-nos a melhorar sua experiência.
            </p>
          </div>
          
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              variant="secondary"
              className="w-full mt-3 sm:mt-4 bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-sm rounded-lg sm:rounded-xl h-10 sm:h-11 text-xs sm:text-sm"
            >
              Responder agora
              <ChevronRight className="ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
        className={`relative overflow-hidden rounded-xl sm:rounded-2xl h-full min-h-[180px] sm:min-h-[200px] lg:min-h-[220px] bg-gradient-to-br ${gradient.bg} hover:${gradient.hover} transition-all duration-300 cursor-pointer group`}
        onClick={() => setExpandedAnnouncement(mainAnnouncement)}
      >
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
        
        {/* Animated glow */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/10 blur-3xl rounded-full" />
        </div>
        
        {/* Decorative blur circles */}
        <div className="pointer-events-none absolute -bottom-12 -right-12 sm:-bottom-16 sm:-right-16 w-32 sm:w-40 h-32 sm:h-40 bg-white/10 blur-3xl rounded-full" />
        <div className="pointer-events-none absolute -top-12 -left-12 sm:-top-16 sm:-left-16 w-24 sm:w-32 h-24 sm:h-32 bg-black/10 blur-3xl rounded-full" />
        
        <div className="relative p-4 sm:p-5 lg:p-6 h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <span className="text-white font-semibold text-sm sm:text-base flex-1 line-clamp-2">
                {mainAnnouncement.titulo}
              </span>
            </div>
            <p className="text-white/80 text-xs sm:text-sm leading-relaxed line-clamp-2 sm:line-clamp-3">
              {mainAnnouncement.descricao}
            </p>
          </div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-3 sm:mt-4"
            onClick={(e) => {
              e.stopPropagation();
              handleAnnouncementClick(mainAnnouncement);
            }}
          >
            <Button 
              variant="secondary"
              className="w-full bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm font-medium rounded-lg sm:rounded-xl h-10 sm:h-11 text-xs sm:text-sm group-hover:bg-white/25 transition-colors"
            >
              {mainAnnouncement.texto_botao}
              <ChevronRight className="ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Expanded announcement modal */}
      <Dialog open={!!expandedAnnouncement} onOpenChange={(open) => !open && setExpandedAnnouncement(null)}>
        {expandedAnnouncement && (() => {
          const expGradient = getGradient(expandedAnnouncement.paleta_cores);
          const ExpIcon = priorityIcons[expandedAnnouncement.prioridade as keyof typeof priorityIcons] || Bell;
          return (
            <DialogContent className="sm:max-w-lg p-0 border-0 overflow-hidden rounded-xl sm:rounded-2xl">
              <div className={`bg-gradient-to-br ${expGradient.bg} p-5 sm:p-6`}>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                      <ExpIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <DialogTitle className="text-lg sm:text-xl font-semibold text-white flex-1">
                      {expandedAnnouncement.titulo}
                    </DialogTitle>
                  </div>
                </DialogHeader>
                <p className="text-white/90 text-sm sm:text-base leading-relaxed whitespace-pre-wrap mt-2">
                  {expandedAnnouncement.descricao}
                </p>
                {expandedAnnouncement.link_botao && (
                  <Button
                    className="w-full mt-5 bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm font-medium rounded-xl h-11 text-sm"
                    onClick={() => handleAnnouncementClick(expandedAnnouncement)}
                  >
                    {expandedAnnouncement.texto_botao}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </DialogContent>
          );
        })()}

      </Dialog>
      <AnimatePresence>
        {showPopup && popupAnnouncement && (
          <Dialog open={showPopup} onOpenChange={handleClosePopup}>
            <DialogContent className="sm:max-w-md rounded-xl sm:rounded-2xl border-0 glass-strong">
              <DialogHeader>
                <div className="flex items-center gap-2.5 sm:gap-3 mb-2">
                  <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${getGradient(popupAnnouncement.paleta_cores).bg} rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg`}>
                    {(() => {
                      const PopupIcon = priorityIcons[popupAnnouncement.prioridade as keyof typeof priorityIcons] || Bell;
                      return <PopupIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />;
                    })()}
                  </div>
                  <DialogTitle className="text-base sm:text-lg font-semibold flex-1">
                    {popupAnnouncement.titulo}
                  </DialogTitle>
                </div>
              </DialogHeader>

              <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {popupAnnouncement.descricao}
                </p>

                <Button 
                  className={`w-full rounded-lg sm:rounded-xl h-10 sm:h-11 text-sm bg-gradient-to-r ${getGradient(popupAnnouncement.paleta_cores).bg} hover:opacity-90`}
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
