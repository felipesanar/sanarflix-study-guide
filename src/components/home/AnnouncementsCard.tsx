import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bell, ChevronRight, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Announcement {
  id: string;
  titulo: string;
  descricao: string;
  link_botao: string | null;
  texto_botao: string;
  paleta_cores: string;
  prioridade: string;
}

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
      .select('id, titulo, descricao, link_botao, texto_botao, paleta_cores, prioridade')
      .eq('ativo', true)
      .order('prioridade', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar avisos:', error);
      return;
    }

    if (data && data.length > 0) {
      setAnnouncements(data);
    }
  };

  // Removed popup functionality for now - will be added when migration is applied


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

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
        className="h-full"
      >
        <Card className={`h-full border-0 bg-gradient-to-br ${palette.gradient} shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group`}>
          <div className="absolute top-4 right-4 z-10">
            <Badge variant="default" className={palette.badge}>
              <Bell className="h-3 w-3 mr-1" />
              Novo
            </Badge>
          </div>

          <CardHeader className="pb-4 space-y-2">
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br ${palette.gradient} rounded-xl flex items-center justify-center ring-1 ring-border`}>
                <Bell className={`h-6 w-6 ${palette.text}`} />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <CardTitle className="text-xl font-semibold leading-tight">
                  {mainAnnouncement.titulo}
                </CardTitle>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-border via-border/50 to-transparent" />
          </CardHeader>

          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {mainAnnouncement.descricao}
            </p>

            <Button 
              className={`w-full group/btn ${palette.text} bg-card hover:bg-accent shadow-sm hover:shadow-md transition-all duration-300`}
              onClick={() => handleAnnouncementClick(mainAnnouncement)}
              variant="outline"
            >
              <span className="flex-1">{mainAnnouncement.texto_botao}</span>
              <ChevronRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform duration-300" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>

    </>
  );
};
