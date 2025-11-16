import * as React from 'react';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, Search, Filter, Calendar, Target, Bell, 
  Edit, Trash2, Power, Check, X, Clock 
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getBrazilDate, toBrazilDate } from '@/utils/timezone';

interface Announcement {
  id: string;
  titulo: string;
  descricao: string;
  link_botao: string | null;
  texto_botao: string;
  ativo: boolean;
  prioridade: 'baixa' | 'media' | 'alta';
  visibilidade: 'todas' | 'seletivo' | 'exceto';
  ies_selecionadas: string[];
  ies_excluidas: string[];
  data_expiracao: string | null;
  created_at: string;
  paleta_cores: string;
}

interface Props {
  announcements: Announcement[];
  selectedIds: string[];
  onSelectAnnouncement: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onEdit: (announcement: Announcement) => void;
  onToggleStatus: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
  totalIes: number;
}

export const AnnouncementsList: React.FC<Props> = ({
  announcements,
  selectedIds,
  onSelectAnnouncement,
  onToggleSelect,
  onSelectAll,
  onEdit,
  onToggleStatus,
  onDelete,
  onCreateNew,
  totalIes
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'title'>('date');

  const getPriorityColor = (prioridade: string) => {
    switch (prioridade) {
      case 'alta': return 'border-l-red-500';
      case 'media': return 'border-l-orange-500';
      case 'baixa': return 'border-l-blue-500';
      default: return 'border-l-gray-500';
    }
  };

  const getPriorityBadge = (prioridade: string) => {
    switch (prioridade) {
      case 'alta': return <Badge variant="destructive">Alta</Badge>;
      case 'media': return <Badge className="bg-orange-500">Média</Badge>;
      case 'baixa': return <Badge variant="secondary">Baixa</Badge>;
      default: return null;
    }
  };

  const getStatusBadge = (announcement: Announcement) => {
    const isExpired = announcement.data_expiracao && toBrazilDate(announcement.data_expiracao) < getBrazilDate();
    
    if (isExpired) {
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          Expirado
        </Badge>
      );
    }
    
    return announcement.ativo ? (
      <Badge className="bg-green-500 gap-1">
        <Check className="h-3 w-3" />
        Ativo
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1">
        <X className="h-3 w-3" />
        Inativo
      </Badge>
    );
  };

  const getVisibilityText = (announcement: Announcement) => {
    if (announcement.visibilidade === 'todas') {
      return `Todas as IES (${totalIes})`;
    } else if (announcement.visibilidade === 'seletivo') {
      return `${announcement.ies_selecionadas.length} de ${totalIes} IES`;
    } else {
      return `${totalIes - announcement.ies_excluidas.length} de ${totalIes} IES`;
    }
  };

  const filteredAnnouncements = announcements
    .filter(ann => {
      // Filtro de busca
      const matchesSearch = ann.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           ann.descricao.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtro de status
      const isExpired = ann.data_expiracao && toBrazilDate(ann.data_expiracao) < getBrazilDate();
      let matchesStatus = true;
      
      if (statusFilter === 'active') matchesStatus = ann.ativo && !isExpired;
      if (statusFilter === 'inactive') matchesStatus = !ann.ativo && !isExpired;
      if (statusFilter === 'expired') matchesStatus = !!isExpired;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return toBrazilDate(b.created_at).getTime() - toBrazilDate(a.created_at).getTime();
      } else if (sortBy === 'priority') {
        const priorityOrder = { alta: 3, media: 2, baixa: 1 };
        return priorityOrder[b.prioridade] - priorityOrder[a.prioridade];
      } else {
        return a.titulo.localeCompare(b.titulo);
      }
    });

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Avisos</h2>
          <Badge variant="secondary">{announcements.length}</Badge>
        </div>
        <Button onClick={onCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Aviso
        </Button>
      </div>

      {/* Filtros e Busca */}
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

        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger>
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Data de Criação</SelectItem>
            <SelectItem value="priority">Prioridade</SelectItem>
            <SelectItem value="title">Título</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Ações em Lote */}
      {selectedIds.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox checked={true} onCheckedChange={onSelectAll} />
                <span className="text-sm font-medium">
                  {selectedIds.length} {selectedIds.length === 1 ? 'aviso selecionado' : 'avisos selecionados'}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Check className="h-4 w-4 mr-1" />
                  Ativar
                </Button>
                <Button variant="outline" size="sm">
                  <X className="h-4 w-4 mr-1" />
                  Desativar
                </Button>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Avisos */}
      <div className="space-y-3">
        {filteredAnnouncements.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum aviso encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Tente ajustar os filtros de busca'
                  : 'Clique em "Novo Aviso" para começar'}
              </p>
              {announcements.length === 0 && (
                <Button onClick={onCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Aviso
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredAnnouncements.map(announcement => (
            <Card 
              key={announcement.id} 
              className={`border-l-4 ${getPriorityColor(announcement.prioridade)} hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => onSelectAnnouncement(announcement.id)}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Checkbox 
                    checked={selectedIds.includes(announcement.id)}
                    onCheckedChange={() => onToggleSelect(announcement.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(announcement)}
                        <h3 className="font-semibold text-lg">{announcement.titulo}</h3>
                      </div>
                      {getPriorityBadge(announcement.prioridade)}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {announcement.descricao}
                    </p>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(toBrazilDate(announcement.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {getVisibilityText(announcement)}
                      </div>

                      {announcement.data_expiracao && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expira: {format(toBrazilDate(announcement.data_expiracao), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onEdit(announcement)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onToggleStatus(announcement.id, announcement.ativo)}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => onDelete(announcement.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
