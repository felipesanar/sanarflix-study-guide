import * as React from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, Edit, Trash2, Power } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getBrazilDate, toBrazilDate } from '@/utils/timezone';
import { StatusPill, MonoValue, AdminEmpty, type StatusPillVariant } from '@/experiences/admin/ui';
import { cn } from '@/lib/utils';

interface Announcement {
  id: string;
  titulo: string;
  descricao: string;
  link_botao: string | null;
  texto_botao: string;
  ativo: boolean;
  prioridade: 'baixa' | 'media' | 'alta' | 'critica';
  visibilidade: 'todas' | 'seletivo' | 'exceto';
  ies_selecionadas: string[];
  ies_excluidas: string[];
  data_expiracao: string | null;
  created_at: string;
  paleta_cores: string;
}

interface Props {
  announcements: Announcement[];
  onEdit: (announcement: Announcement) => void;
  onToggleStatus: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
  totalIes: number;
}

/** Cor sólida da barra lateral (identidade visual do aviso) por `paleta_cores`. */
const PALETTE_BAR_CLASS: Record<string, string> = {
  flame: 'bg-red-500',
  flameSoft: 'bg-red-400',
  emerald: 'bg-emerald-500',
  emeraldSoft: 'bg-emerald-400',
  royal: 'bg-blue-500',
  royalSoft: 'bg-blue-400',
  sunset: 'bg-orange-500',
  sunsetSoft: 'bg-orange-400',
  amethyst: 'bg-violet-500',
  amethystSoft: 'bg-violet-400',
};

const PRIORITY_PILL: Record<Announcement['prioridade'], { label: string; variant: StatusPillVariant }> = {
  critica: { label: 'Crítica', variant: 'red' },
  alta: { label: 'Alta', variant: 'amber' },
  media: { label: 'Média', variant: 'blue' },
  baixa: { label: 'Baixa', variant: 'muted' },
};

export const AnnouncementsList: React.FC<Props> = ({
  announcements,
  onEdit,
  onToggleStatus,
  onDelete,
  onCreateNew,
  totalIes,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'title'>('date');

  const isExpired = (ann: Announcement) =>
    !!ann.data_expiracao && toBrazilDate(ann.data_expiracao) < getBrazilDate();

  const getStatusPill = (ann: Announcement) => {
    if (isExpired(ann)) return <StatusPill variant="muted">Expirado</StatusPill>;
    return ann.ativo ? (
      <StatusPill variant="emerald" dot>
        Ativo
      </StatusPill>
    ) : (
      <StatusPill variant="muted">Inativo</StatusPill>
    );
  };

  const getVisibilityText = (ann: Announcement) => {
    if (ann.visibilidade === 'todas') return `Todas as IES (${totalIes})`;
    if (ann.visibilidade === 'seletivo') return `${ann.ies_selecionadas.length} de ${totalIes} IES`;
    return `${totalIes - ann.ies_excluidas.length} de ${totalIes} IES`;
  };

  const filteredAnnouncements = announcements
    .filter((ann) => {
      const matchesSearch =
        ann.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ann.descricao.toLowerCase().includes(searchTerm.toLowerCase());

      const expired = isExpired(ann);
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = ann.ativo && !expired;
      if (statusFilter === 'inactive') matchesStatus = !ann.ativo && !expired;
      if (statusFilter === 'expired') matchesStatus = expired;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'date') return toBrazilDate(b.created_at).getTime() - toBrazilDate(a.created_at).getTime();
      if (sortBy === 'priority') {
        const priorityOrder: Record<Announcement['prioridade'], number> = { critica: 4, alta: 3, media: 2, baixa: 1 };
        return priorityOrder[b.prioridade] - priorityOrder[a.prioridade];
      }
      return a.titulo.localeCompare(b.titulo);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Avisos</h2>
          <MonoValue muted>{announcements.length}</MonoValue>
        </div>
        <Button onClick={onCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo aviso
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar avisos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v: 'all' | 'active' | 'inactive' | 'expired') => setStatusFilter(v)}>
          <SelectTrigger>
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v: 'date' | 'priority' | 'title') => setSortBy(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Data de criação</SelectItem>
            <SelectItem value="priority">Prioridade</SelectItem>
            <SelectItem value="title">Título</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filteredAnnouncements.length === 0 ? (
          <AdminEmpty
            title="Nenhum aviso encontrado"
            description={
              searchTerm || statusFilter !== 'all' ? 'Tente ajustar os filtros de busca.' : 'Clique em "Novo aviso" para começar.'
            }
            action={
              announcements.length === 0 ? (
                <Button onClick={onCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeiro aviso
                </Button>
              ) : undefined
            }
          />
        ) : (
          filteredAnnouncements.map((announcement) => {
            // Fallback para valores legados (ex.: 'Muito Alta', gravados antes da
            // normalização do vocabulário) — sem isso, um valor fora do enum
            // canônico faz `PRIORITY_PILL[prioridade]` retornar undefined e
            // `.variant` crasha a lista inteira.
            const priorityPill = PRIORITY_PILL[announcement.prioridade] ?? PRIORITY_PILL.media;
            return (
              <div key={announcement.id} className="flex overflow-hidden rounded-xl border">
                <div className={cn('w-1.5 shrink-0', PALETTE_BAR_CLASS[announcement.paleta_cores] ?? 'bg-muted-foreground')} />
                <div className="flex-1 space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusPill(announcement)}
                      <StatusPill variant={priorityPill.variant}>{priorityPill.label}</StatusPill>
                      <h3 className="font-semibold">{announcement.titulo}</h3>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(announcement)} aria-label="Editar aviso">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onToggleStatus(announcement.id, announcement.ativo)}
                        aria-label={announcement.ativo ? 'Desativar aviso' : 'Ativar aviso'}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(announcement.id)} aria-label="Excluir aviso">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2">{announcement.descricao}</p>

                  <MonoValue muted className="block text-xs">
                    {getVisibilityText(announcement)}
                    {' · '}
                    {announcement.data_expiracao
                      ? `expira ${format(toBrazilDate(announcement.data_expiracao), "dd/MM/yyyy", { locale: ptBR })}`
                      : 'sem expiração'}
                  </MonoValue>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
