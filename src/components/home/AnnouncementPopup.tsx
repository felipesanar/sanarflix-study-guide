import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Info, GraduationCap, Megaphone } from 'lucide-react';
import { motion } from 'framer-motion';

interface Announcement {
  id: string;
  titulo: string;
  descricao: string;
  paleta_cores: string;
  prioridade: string;
  semestre_destino: number | null;
}

const colorPalettes = {
  primary: {
    gradient: 'from-primary to-primary-dark',
    icon: 'text-primary',
    iconBg: 'bg-primary/10',
  },
  danger: {
    gradient: 'from-destructive to-red-700',
    icon: 'text-destructive',
    iconBg: 'bg-destructive/10',
  },
  info: {
    gradient: 'from-uscs-blue to-uscs-blue-dark',
    icon: 'text-uscs-blue',
    iconBg: 'bg-uscs-blue/10',
  },
  success: {
    gradient: 'from-green-600 to-green-800',
    icon: 'text-green-600',
    iconBg: 'bg-green-600/10',
  },
  warning: {
    gradient: 'from-uscs-orange to-yellow-700',
    icon: 'text-uscs-orange',
    iconBg: 'bg-uscs-orange/10',
  },
};

const iconMap = {
  danger: AlertCircle,
  info: Info,
  success: GraduationCap,
  warning: Megaphone,
  primary: Megaphone,
};

export const AnnouncementPopup = ({ userSemester }: { userSemester?: number }) => {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchImportantAnnouncement();
  }, [userSemester]);

  const fetchImportantAnnouncement = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Busca avisos não visualizados com prioridade "muito_alta"
      const { data: announcements, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('ativo', true)
        .eq('prioridade', 'muito_alta')
        .or(`data_expiracao.is.null,data_expiracao.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtra por semestre se disponível
      const filteredAnnouncements = announcements?.filter(ann => {
        if (ann.semestre_destino === null) return true;
        if (!userSemester) return ann.semestre_destino === null;
        return ann.semestre_destino === userSemester;
      });

      if (!filteredAnnouncements || filteredAnnouncements.length === 0) return;

      // Verifica se já foi visualizado
      const { data: viewed } = await supabase
        .from('announcements_viewed')
        .select('id')
        .eq('user_id', user.id)
        .eq('announcement_id', filteredAnnouncements[0].id)
        .single();

      if (!viewed) {
        setAnnouncement(filteredAnnouncements[0]);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Erro ao buscar avisos importantes:', error);
    }
  };

  const handleAcknowledge = async () => {
    if (!announcement) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('announcements_viewed')
        .insert({
          user_id: user.id,
          announcement_id: announcement.id,
        });

      setIsOpen(false);
    } catch (error) {
      console.error('Erro ao marcar aviso como visualizado:', error);
      setIsOpen(false);
    }
  };

  if (!announcement) return null;

  const palette = colorPalettes[announcement.paleta_cores as keyof typeof colorPalettes] || colorPalettes.primary;
  const Icon = iconMap[announcement.paleta_cores as keyof typeof iconMap] || Megaphone;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className={`absolute top-0 left-0 right-0 h-2 rounded-t-lg bg-gradient-to-r ${palette.gradient}`} />
          
          <DialogHeader className="mt-4">
            <div className="flex items-center gap-4 mb-4">
              <div className={`${palette.iconBg} p-4 rounded-2xl`}>
                <Icon className={`h-8 w-8 ${palette.icon}`} />
              </div>
              <DialogTitle className="text-2xl font-bold">{announcement.titulo}</DialogTitle>
            </div>
            <DialogDescription className="text-base text-foreground leading-relaxed">
              {announcement.descricao}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-6">
            <Button 
              onClick={handleAcknowledge}
              className={`w-full bg-gradient-to-r ${palette.gradient} text-white hover:opacity-90`}
            >
              Estou ciente
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
