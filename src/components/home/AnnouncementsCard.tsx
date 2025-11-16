import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bell, ChevronRight, X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
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

// Ícones por prioridade
const priorityIcons = {
  'Muito Alta': AlertCircle,
  'Alta': AlertTriangle,
  'Media': Bell,
  'Baixa': Info,
};

const colorPalettes: Record<string, { gradient: string; badge: string; text: string }> = {
  flame: {
    gradient: 'from-red-600 via-red-500 to-orange-500 dark:from-red-700 dark:via-red-600 dark:to-orange-600',
    badge: 'bg-white/10 text-white border-white/20',
    text: 'text-white'
  },
  emerald: {
    gradient: 'from-emerald-600 via-emerald-500 to-teal-500 dark:from-emerald-700 dark:via-emerald-600 dark:to-teal-600',
    badge: 'bg-white/10 text-white border-white/20',
    text: 'text-white'
  },
  royal: {
    gradient: 'from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-700 dark:via-indigo-700 dark:to-purple-700',
    badge: 'bg-white/10 text-white border-white/20',
    text: 'text-white'
  },
  sunset: {
    gradient: 'from-orange-500 via-pink-500 to-rose-500 dark:from-orange-600 dark:via-pink-600 dark:to-rose-600',
    badge: 'bg-white/10 text-white border-white/20',
    text: 'text-white'
  },
  amethyst: {
    gradient: 'from-violet-600 via-purple-600 to-fuchsia-600 dark:from-violet-700 dark:via-purple-700 dark:to-fuchsia-700',
    badge: 'bg-white/10 text-white border-white/20',
    text: 'text-white'
  },
  flameSoft: {
    gradient: 'from-red-500/60 via-red-400/50 to-orange-400/40 dark:from-red-600/60 dark:via-red-500/50 dark:to-orange-500/40',
    badge: 'bg-white/20 text-white border-white/30',
    text: 'text-white'
  },
  emeraldSoft: {
    gradient: 'from-emerald-500/60 via-emerald-400/50 to-teal-400/40 dark:from-emerald-600/60 dark:via-emerald-500/50 dark:to-teal-500/40',
    badge: 'bg-white/20 text-white border-white/30',
    text: 'text-white'
  },
  royalSoft: {
    gradient: 'from-blue-500/60 via-indigo-500/50 to-purple-500/40 dark:from-blue-600/60 dark:via-indigo-600/50 dark:to-purple-600/40',
    badge: 'bg-white/20 text-white border-white/30',
    text: 'text-white'
  },
  sunsetSoft: {
    gradient: 'from-orange-400/60 via-pink-400/50 to-rose-400/40 dark:from-orange-500/60 dark:via-pink-500/50 dark:to-rose-500/40',
    badge: 'bg-white/20 text-white border-white/30',
    text: 'text-white'
  },
  amethystSoft: {
    gradient: 'from-violet-500/60 via-purple-500/50 to-fuchsia-500/40 dark:from-violet-600/60 dark:via-purple-600/50 dark:to-fuchsia-600/40',
    badge: 'bg-white/20 text-white border-white/30',
    text: 'text-white'
  },
};

const normalizePriority = (p: string): 'low' | 'medium' | 'high' | 'critical' => {
  const x = (p || '').toLowerCase();
  if (x.includes('muito') || x.includes('crític') || x.includes('crit')) return 'critical';
  if (x.includes('alta')) return 'high';
  if (x.includes('med')) return 'medium';
  return 'low';
};

const priorityStyles = {
  low: { icon: 'text-white', container: '' },
  medium: { icon: 'text-white fill-white/20', container: '' },
  high: { icon: 'text-white fill-white/50 drop-shadow', container: 'ring-2 ring-white/30 dark:ring-black/30' },
  critical: { icon: 'text-white fill-white animate-pulse', container: 'ring-2 ring-white/40 dark:ring-black/40 shadow-[0_0_30px_rgba(255,255,255,0.15)] dark:shadow-[0_0_30px_rgba(0,0,0,0.25)]' },
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
      
      // Verifica se há aviso com prioridade "Muito Alta" para mostrar popup
      const highPriorityAnnouncement = data.find(a => a.prioridade === 'Muito Alta');
      if (highPriorityAnnouncement) {
        checkAndShowPopup(highPriorityAnnouncement);
      }
    }
  };

  const checkAndShowPopup = async (announcement: Announcement) => {
    if (!user) return;

    // Verifica se o usuário já visualizou este aviso
    const { data: viewed } = await supabase
      .from('announcements_viewed')
      .select('id')
      .eq('announcement_id', announcement.id)
      .eq('user_id', user.id)
      .single();

    // Se não visualizou, mostra o popup
    if (!viewed) {
      setPopupAnnouncement(announcement);
      setShowPopup(true);
    }
  };

  const handleClosePopup = async () => {
    if (!popupAnnouncement || !user) return;

    // Marca como visualizado
    await supabase
      .from('announcements_viewed')
      .insert({
        announcement_id: popupAnnouncement.id,
        user_id: user.id,
      });

    setShowPopup(false);
    setPopupAnnouncement(null);
  };

  // Verifica se o aviso é "novo" (criado há menos de 24h)
  const isNewAnnouncement = (announcement: Announcement): boolean => {
    if (!announcement.created_at) return false;
    const createdAt = new Date(announcement.created_at);
    const now = new Date();
    const diffInHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return diffInHours < 24;
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
  if (!mainAnnouncement) return null;

  const palette = colorPalettes[mainAnnouncement.paleta_cores] || colorPalettes.flame;
  const IconComponent = priorityIcons[mainAnnouncement.prioridade as keyof typeof priorityIcons] || Bell;
  const pr = normalizePriority(mainAnnouncement.prioridade);
  const isNew = isNewAnnouncement(mainAnnouncement);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
        className="h-full"
        whileHover={{ y: -2 }}
      >
        <Card className={`relative h-full border-0 bg-gradient-to-br ${palette.gradient} shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group`}>
          {/* brilho ambiente */}
          <div className="pointer-events-none absolute -bottom-20 -right-20 w-72 h-72 bg-white/10 dark:bg-black/20 blur-3xl rounded-full" />
          {isNew && (
            <div className="absolute top-4 right-4 z-10">
              <Badge variant="default" className={palette.badge}>
                <Bell className="h-3 w-3 mr-1" />
                Novo
              </Badge>
            </div>
          )}

          <CardHeader className="pb-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br ${palette.gradient} rounded-xl flex items-center justify-center ${priorityStyles[pr].container}`}>
                <IconComponent className={`h-6 w-6 ${priorityStyles[pr].icon}`} />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className={`text-xl font-semibold leading-tight ${palette.text}`}>
                  {mainAnnouncement.titulo}
                </CardTitle>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-border via-border/50 to-transparent" />
          </CardHeader>

          <CardContent className="space-y-5">
            <p className={`text-sm leading-relaxed ${palette.text}`}>
              {mainAnnouncement.descricao}
            </p>

            <Button 
              className={`relative w-full group/btn text-white bg-black/30 hover:bg-black/40 dark:bg-black/40 dark:hover:bg-black/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden`}
              onClick={() => handleAnnouncementClick(mainAnnouncement)}
              variant="outline"
            >
              <span className="pointer-events-none absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity">
                <span className="absolute -left-10 top-0 h-full w-16 rotate-12 bg-white/15 dark:bg-white/10 blur-sm" />
              </span>
              <span className="flex-1">{mainAnnouncement.texto_botao}</span>
              <ChevronRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform duration-300" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Pop-up Modal para avisos de prioridade "Muito Alta" */}
      <AnimatePresence>
        {showPopup && popupAnnouncement && (
          <Dialog open={showPopup} onOpenChange={handleClosePopup}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`flex-shrink-0 w-14 h-14 bg-gradient-to-br ${colorPalettes[popupAnnouncement.paleta_cores]?.gradient || colorPalettes.primary.gradient} rounded-xl flex items-center justify-center ring-1 ring-border`}>
                    {(() => {
                      const PopupIcon = priorityIcons[popupAnnouncement.prioridade as keyof typeof priorityIcons] || Bell;
                      const popupPalette = colorPalettes[popupAnnouncement.paleta_cores] || colorPalettes.primary;
                      return <PopupIcon className={`h-7 w-7 ${popupPalette.text}`} />;
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
                  className="w-full"
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
