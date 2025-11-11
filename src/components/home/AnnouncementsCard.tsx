import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bell, ChevronRight, X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Announcement {
  id: string;
  titulo: string;
  descricao: string;
  link_botao: string | null;
  texto_botao: string;
  paleta_cores: string;
  prioridade: string;
  created_at?: string;
}

// Ícones por prioridade
const priorityIcons = {
  'Muito Alta': AlertCircle,
  'Alta': AlertTriangle,
  'Media': Bell,
  'Baixa': Info,
};

const colorPalettes: Record<string, { gradient: string; badge: string; text: string }> = {
  primary: { 
    gradient: 'from-primary/20 via-primary/10 to-primary/5', 
    badge: 'bg-primary/10 text-primary border-primary/20',
    text: 'text-primary'
  },
  success: { 
    gradient: 'from-green-500/20 via-green-500/10 to-green-500/5', 
    badge: 'bg-green-500/10 text-green-600 border-green-500/20',
    text: 'text-green-600'
  },
  warning: { 
    gradient: 'from-orange-500/20 via-orange-500/10 to-orange-500/5', 
    badge: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    text: 'text-orange-600'
  },
  danger: { 
    gradient: 'from-red-500/20 via-red-500/10 to-red-500/5', 
    badge: 'bg-red-500/10 text-red-600 border-red-500/20',
    text: 'text-red-600'
  },
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
      .select('id, titulo, descricao, link_botao, texto_botao, paleta_cores, prioridade, created_at')
      .eq('ativo', true)
      .order('prioridade', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar avisos:', error);
      return;
    }

    if (data && data.length > 0) {
      setAnnouncements(data);
      
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

  const palette = colorPalettes[mainAnnouncement.paleta_cores] || colorPalettes.primary;
  const IconComponent = priorityIcons[mainAnnouncement.prioridade as keyof typeof priorityIcons] || Bell;
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
          <div className="pointer-events-none absolute -bottom-20 -right-20 w-72 h-72 bg-white/20 blur-3xl rounded-full" />
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
              <div className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br ${palette.gradient} rounded-xl flex items-center justify-center ring-1 ring-border`}>
                <IconComponent className={`h-6 w-6 ${palette.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl font-semibold leading-tight">
                  {mainAnnouncement.titulo}
                </CardTitle>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-border via-border/50 to-transparent" />
          </CardHeader>

          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {mainAnnouncement.descricao}
            </p>

            <Button 
              className={`relative w-full group/btn ${palette.text} bg-card hover:bg-accent shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden`}
              onClick={() => handleAnnouncementClick(mainAnnouncement)}
              variant="outline"
            >
              <span className="pointer-events-none absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity">
                <span className="absolute -left-10 top-0 h-full w-16 rotate-12 bg-current/10 blur-sm" />
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
