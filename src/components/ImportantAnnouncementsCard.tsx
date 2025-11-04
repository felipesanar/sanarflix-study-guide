import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

interface Announcement {
  id: string;
  titulo: string;
  descricao: string;
  link_botao: string | null;
  texto_botao: string;
  paleta_cores: string;
}

const colorPalettes: Record<string, { from: string; to: string; badge: string }> = {
  primary: { from: 'from-primary/20', to: 'to-primary/10', badge: 'bg-primary/10 text-primary border-primary/20' },
  success: { from: 'from-green-500/20', to: 'to-green-500/10', badge: 'bg-green-500/10 text-green-600 border-green-500/20' },
  warning: { from: 'from-orange-500/20', to: 'to-orange-500/10', badge: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  danger: { from: 'from-red-500/20', to: 'to-red-500/10', badge: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

export const ImportantAnnouncementsCard: React.FC = () => {
  const { user } = useAuth();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    fetchAnnouncement();
  }, [user]);

  const fetchAnnouncement = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('announcements')
      .select('id, titulo, descricao, link_botao, texto_botao, paleta_cores')
      .eq('ativo', true)
      .order('prioridade', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar avisos:', error);
      return;
    }

    if (data) {
      setAnnouncement(data);
    }
  };

  if (!announcement) {
    return null;
  }

  const palette = colorPalettes[announcement.paleta_cores] || colorPalettes.primary;

  const handleClick = () => {
    if (announcement.link_botao) {
      let url = announcement.link_botao;
      
      // Adicionar https:// se a URL não começar com http:// ou https://
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      
      window.open(url, '_blank');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
      className="h-full"
    >
      <Card className={`h-full border-0 bg-gradient-to-br ${palette.from} ${palette.to} shadow-[0_8px_30px_rgb(0,0,0,0.04),0_1px_3px_rgb(0,0,0,0.02)] hover:shadow-[0_10px_40px_rgb(0,0,0,0.06),0_2px_4px_rgb(0,0,0,0.03)] transition-all duration-300 ease-in-out overflow-hidden group`}>
        {/* Decorative badge */}
        <div className="absolute top-4 right-4 z-10">
          <Badge variant="default" className={palette.badge}>
            <Bell className="h-3 w-3 mr-1" />
            Novo
          </Badge>
        </div>

        <CardHeader className="pb-4 space-y-2">
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br ${palette.from} ${palette.to} rounded-xl flex items-center justify-center ring-1 ring-primary/10`}>
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <CardTitle className="text-xl font-semibold leading-tight">
                {announcement.titulo}
              </CardTitle>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-border via-border/50 to-transparent" />
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {announcement.descricao}
            </p>
          </div>

          <Button 
            className="w-full group/btn bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md transition-all duration-300 ease-in-out rounded-lg"
            onClick={handleClick}
          >
            <span className="flex-1">{announcement.texto_botao}</span>
            <ChevronRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform duration-300 ease-in-out" />
          </Button>
        </CardContent>

        {/* Decorative gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-br ${palette.from} via-transparent to-transparent pointer-events-none opacity-50`} />
      </Card>
    </motion.div>
  );
};
