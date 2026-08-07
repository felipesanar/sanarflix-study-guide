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
  // Personas que veem o aviso. O banco aceita aluno | gestor | professor
  // (CHECK announcements_publico_alvo_check); o editor expõe aluno e gestor e
  // preserva qualquer outro valor que já esteja gravado na linha.
  //
  // Opcional só para casar com a assinatura de `setConfig` do editor (que aceita
  // um config sem o campo). Quem garante que a coluna sempre chega preenchida ao
  // banco é a validação em `handleSave`, não o compilador.
  publico_alvo?: string[];
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
  publico_alvo: string[] | null;
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
  // Mesmo default do banco: aviso novo continua nascendo só para aluno.
  publico_alvo: ['aluno'],
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

  const handleSave = async (configToSave: AnnouncementConfig) => {
    // O editor já monta `configToSave` com a conversão de timezone correta
    // (data de expiração local -> UTC). Usar `editingConfig` cru aqui salvava
    // a data como string local naive (~3h de erro; o aviso expirava antes da
    // hora configurada) — bug corrigido recebendo o parâmetro.
    if (!configToSave.titulo.trim() || !configToSave.descricao.trim()) {
      toast.error('Preencha título e descrição do aviso');
      return;
    }

    // O CHECK do banco exige cardinality(publico_alvo) >= 1. Barrar aqui troca
    // um 400 opaco do PostgREST por uma mensagem que diz o que fazer — e evita
    // salvar um aviso que não apareceria para ninguém.
    if (!configToSave.publico_alvo?.length) {
      toast.error('Selecione pelo menos um público-alvo para o aviso');
      return;
    }

    const { error: saveError } = await supabase.from('announcements').upsert({
      id: configToSave.id,
      titulo: configToSave.titulo,
      descricao: configToSave.descricao,
      link_botao: configToSave.link_botao || null,
      texto_botao: configToSave.texto_botao,
      paleta_cores: configToSave.paleta_cores,
      ativo: configToSave.ativo,
      data_expiracao: configToSave.data_expiracao,
      prioridade: configToSave.prioridade,
      visibilidade: configToSave.visibilidade,
      ies_selecionadas: configToSave.ies_selecionadas,
      ies_excluidas: configToSave.ies_excluidas,
      // Sem esta coluna na lista o campo do editor não persiste: o insert cai
      // no default '{aluno}' e get_gestor_avisos, que filtra por
      // 'gestor' = ANY(publico_alvo), nunca devolve o aviso.
      publico_alvo: configToSave.publico_alvo,
    });

    if (saveError) {
      toast.error('Erro ao salvar aviso');
      Logger.error('Erro ao salvar aviso', saveError);
    } else {
      toast.success(configToSave.id ? 'Aviso atualizado!' : 'Aviso criado!');
      await logAdminAction('aviso_save', null, { id: configToSave.id ?? null, titulo: configToSave.titulo });
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
        onEdit={(announcement) => {
          // A lista trabalha com um recorte do aviso (o tipo dela não conhece
          // publico_alvo). Buscamos a linha inteira no estado para o editor não
          // perder campos no caminho até o upsert, que grava todas as colunas.
          const full = announcements.find((a) => a.id === announcement.id);
          if (!full) return;

          setEditingConfig({
            ...full,
            link_botao: full.link_botao || '',
            texto_botao: full.texto_botao || 'Ver mais',
            // Linhas anteriores ao backfill podem vir nulas; o editor não sabe
            // lidar com ausência de público.
            publico_alvo: full.publico_alvo?.length ? full.publico_alvo : ['aluno'],
          });
        }}
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
