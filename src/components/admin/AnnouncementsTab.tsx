import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AnnouncementsList } from './announcements/AnnouncementsList';
import { AnnouncementEditor } from './announcements/AnnouncementEditor';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface IES {
  id: string;
  nome: string;
}

interface AnnouncementConfig {
  id?: string;
  titulo: string;
  descricao: string;
  link_botao: string;
  texto_botao: string;
  paleta_cores: string;
  ativo: boolean;
  data_expiracao: string | null;
  prioridade: 'baixa' | 'media' | 'alta';
  visibilidade: 'todas' | 'seletivo' | 'exceto';
  ies_selecionadas: string[];
  ies_excluidas: string[];
}

interface Announcement {
  id: string;
  titulo: string;
  descricao: string;
  link_botao: string | null;
  texto_botao: string;
  paleta_cores: string;
  ativo: boolean;
  data_expiracao: string | null;
  prioridade: 'baixa' | 'media' | 'alta';
  visibilidade: 'todas' | 'seletivo' | 'exceto';
  ies_selecionadas: string[];
  ies_excluidas: string[];
  created_at: string;
}

const defaultConfig: AnnouncementConfig = {
  titulo: '',
  descricao: '',
  link_botao: '',
  texto_botao: 'Ver mais',
  paleta_cores: 'primary',
  ativo: false,
  data_expiracao: null,
  prioridade: 'media',
  visibilidade: 'todas',
  ies_selecionadas: [],
  ies_excluidas: [],
};

export const AnnouncementsTab: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [iesList, setIesList] = useState<IES[]>([]);
  const [searchIes, setSearchIes] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingConfig, setEditingConfig] = useState<AnnouncementConfig | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchIesList();
    fetchAnnouncements();
  }, []);

  const fetchIesList = async () => {
    const { data, error } = await supabase
      .from('ies')
      .select('id, nome')
      .order('nome');
    
    if (!error && data) {
      setIesList(data);
    }
  };

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setAnnouncements(data as Announcement[]);
    }
  };

  const handleSave = async () => {
    if (!editingConfig) return;

    const { error } = await supabase
      .from('announcements')
      .upsert({
        id: editingConfig.id,
        titulo: editingConfig.titulo,
        descricao: editingConfig.descricao,
        link_botao: editingConfig.link_botao || null,
        texto_botao: editingConfig.texto_botao,
        paleta_cores: editingConfig.paleta_cores,
        ativo: editingConfig.ativo,
        data_expiracao: editingConfig.data_expiracao,
        prioridade: editingConfig.prioridade,
        visibilidade: editingConfig.visibilidade,
        ies_selecionadas: editingConfig.ies_selecionadas,
        ies_excluidas: editingConfig.ies_excluidas,
      });

    if (error) {
      toast.error('Erro ao salvar aviso');
      console.error(error);
    } else {
      toast.success(editingConfig.id ? 'Aviso atualizado!' : 'Aviso criado!');
      setEditingConfig(null);
      fetchAnnouncements();
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('announcements')
      .update({ ativo: !currentStatus })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao alterar status');
    } else {
      toast.success(currentStatus ? 'Aviso desativado' : 'Aviso ativado');
      fetchAnnouncements();
    }
  };

  const handleDelete = async () => {
    if (!announcementToDelete) return;

    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', announcementToDelete);

    if (error) {
      toast.error('Erro ao excluir aviso');
    } else {
      toast.success('Aviso excluído');
      fetchAnnouncements();
    }

    setDeleteDialogOpen(false);
    setAnnouncementToDelete(null);
  };

  const handleDuplicate = () => {
    if (!editingConfig) return;
    
    setEditingConfig({
      ...editingConfig,
      id: undefined,
      titulo: `${editingConfig.titulo} (Cópia)`,
      ativo: false,
    });
    
    toast.info('Aviso duplicado. Edite e salve.');
  };

  if (editingConfig) {
    return (
      <AnnouncementEditor
        config={editingConfig}
        setConfig={setEditingConfig}
        iesList={iesList}
        searchIes={searchIes}
        setSearchIes={setSearchIes}
        onSave={handleSave}
        onCancel={() => setEditingConfig(null)}
        onDuplicate={editingConfig.id ? handleDuplicate : undefined}
      />
    );
  }

  return (
    <>
      <AnnouncementsList
        announcements={announcements}
        selectedIds={selectedIds}
        onSelectAnnouncement={(id) => {
          const ann = announcements.find(a => a.id === id);
          if (ann) setEditingConfig({
            ...ann,
            link_botao: ann.link_botao || '',
          });
        }}
        onToggleSelect={(id) => {
          setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
          );
        }}
        onSelectAll={() => {
          setSelectedIds(prev => 
            prev.length === announcements.length ? [] : announcements.map(a => a.id)
          );
        }}
        onEdit={(announcement) => setEditingConfig({
          ...announcement,
          link_botao: announcement.link_botao || '',
          texto_botao: announcement.texto_botao || 'Ver mais',
        })}
        onToggleStatus={handleToggleStatus}
        onDelete={(id) => {
          setAnnouncementToDelete(id);
          setDeleteDialogOpen(true);
        }}
        onCreateNew={() => setEditingConfig(defaultConfig)}
        totalIes={iesList.length}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este aviso? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
