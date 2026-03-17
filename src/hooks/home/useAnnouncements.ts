import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getBrazilDate, toBrazilDate } from '@/utils/timezone';
import { AlertCircle, AlertTriangle, Bell, Info, LucideIcon } from 'lucide-react';

export interface Announcement {
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

export const priorityIcons: Record<string, LucideIcon> = {
  'Muito Alta': AlertCircle,
  'Alta': AlertTriangle,
  'Media': Bell,
  'Baixa': Info,
};

export const gradientConfigs: Record<string, { bg: string; hover: string }> = {
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

export const getGradient = (palette: string) => {
  return gradientConfigs[palette] || gradientConfigs.royal;
};

export const useAnnouncements = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [popupAnnouncement, setPopupAnnouncement] = useState<Announcement | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
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
      const active = data.filter((a: Announcement) => !a.data_expiracao || toBrazilDate(a.data_expiracao) >= now);
      const weight = (p: string) => {
        const x = (p || '').toLowerCase();
        if (x.includes('muito')) return 3;
        if (x.includes('alta')) return 2;
        if (x.includes('med')) return 1;
        return 0;
      };
      const sorted = active.sort((a: Announcement, b: Announcement) => {
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
  }, [user]);

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

  const handleClosePopup = useCallback(async () => {
    if (!popupAnnouncement || !user) return;

    await supabase
      .from('announcements_viewed')
      .insert({
        announcement_id: popupAnnouncement.id,
        user_id: user.id,
      });

    setShowPopup(false);
    setPopupAnnouncement(null);
  }, [popupAnnouncement, user]);

  const handleAnnouncementClick = useCallback((announcement: Announcement) => {
    if (announcement.link_botao) {
      let url = announcement.link_botao;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      window.open(url, '_blank');
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchAnnouncements();
    }
  }, [user, fetchAnnouncements]);

  const mainAnnouncement = announcements[0] || null;
  const hasAnnouncement = !!mainAnnouncement;
  const IconComponent = mainAnnouncement 
    ? (priorityIcons[mainAnnouncement.prioridade as keyof typeof priorityIcons] || Bell)
    : Bell;
  const gradient = mainAnnouncement ? getGradient(mainAnnouncement.paleta_cores) : gradientConfigs.royal;

  return {
    announcements,
    mainAnnouncement,
    hasAnnouncement,
    IconComponent,
    gradient,
    popupAnnouncement,
    showPopup,
    handleClosePopup,
    handleAnnouncementClick,
    getGradient,
    priorityIcons,
  };
};
