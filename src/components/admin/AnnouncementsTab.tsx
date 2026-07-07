import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AnnouncementsList } from './announcements/AnnouncementsList';
import { AnnouncementEditor } from './announcements/AnnouncementEditor';
import { AdminLoading, AdminError, DangerZone } from '@/experiences/admin/ui';
import { logAdminAction } from '@/services/admin/logAction';
import { Logger } from '@/utils/logger';

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
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
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
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
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
  paleta_cores: 'flame',
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchIes, setSearchIes] = useState('');
  const [editingConfig, setEditingConfig] = useState<AnnouncementConfig | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [iesResult, announcementsResult] = await Promise.all([
        supabase.from('ies').select('id, nome').order('nome'),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      ]);

      if (iesResult.error) throw iesResult.error;
      if (announcementsResult.error) throw announcementsResult.error;

      setIesList(iesResult.data || []);
      setAnnouncements((announcementsResult.data as Announcement[]) || []);
    } catch (err) {
      Logger.error('Erro ao carregar avisos:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar avisos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const fetchAnnouncements = async () => {
    const { data, error: fetchError } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (!fetchError && data) {
      setAnnouncements(data as Announcement[]);
    }
  };

  const handleSave = async () => {
    if (!editingConfig) return;

    const { error: saveError } = await supabase.from('announcements').upsert({
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

    if (saveError) {
      toast.error('Erro ao salvar aviso');
      Logger.error('Erro ao salvar aviso', saveError);
    } else {
      toast.success(editingConfig.id ? 'Aviso atualizado!' : 'Aviso criado!');
      setEditingConfig(null);
      fetchAnnouncements();
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const { error: toggleError } = await supabase.from('announcements').update({ ativo: !currentStatus }).eq('id', id);

    if (toggleError) {
      toast.error('Erro ao alterar status');
      return;
    }

    toast.success(currentStatus ? 'Aviso desativado' : 'Aviso ativado');
    await logAdminAction('aviso_toggle', null, { announcement_id: id, ativo: !currentStatus });
    fetchAnnouncements();
  };

  const handleDelete = async () => {
    if (!announcementToDelete) return;
    const target = announcementToDelete;

    const { error: deleteError } = await supabase.from('announcements').delete().eq('id', target.id);

    if (deleteError) {
      toast.error('Erro ao excluir aviso');
      throw deleteError;
    }

    toast.success('Aviso excluído');
    await logAdminAction('aviso_delete', null, { announcement_id: target.id, titulo: target.titulo });
    setAnnouncementToDelete(null);
    fetchAnnouncements();
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

  if (loading) return <AdminLoading rows={4} rowHeight="h-24" />;
  if (error) return <AdminError message={error} onRetry={fetchAll} />;

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
        onEdit={(announcement) =>
          setEditingConfig({
            ...announcement,
            link_botao: announcement.link_botao || '',
            texto_botao: announcement.texto_botao || 'Ver mais',
          })
        }
        onToggleStatus={handleToggleStatus}
        onDelete={(id) => {
          const ann = announcements.find((a) => a.id === id);
          if (ann) setAnnouncementToDelete(ann);
        }}
        onCreateNew={() => setEditingConfig(defaultConfig)}
        totalIes={iesList.length}
      />

      <DangerZone
        open={!!announcementToDelete}
        onOpenChange={(open) => {
          if (!open) setAnnouncementToDelete(null);
        }}
        level="medium"
        title="Excluir aviso"
        impact={
          <span>
            O aviso <strong>{announcementToDelete?.titulo}</strong> será excluído permanentemente para todos os alunos que o veem hoje.
          </span>
        }
        actionLabel="Excluir aviso"
        onConfirm={handleDelete}
      />
    </>
  );
};
