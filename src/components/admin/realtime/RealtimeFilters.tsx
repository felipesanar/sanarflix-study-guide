import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Filter } from 'lucide-react';
import { Logger } from '@/utils/logger';

interface IES {
  id: string;
  nome: string;
}

interface Simulado {
  id: string;
  nome: string;
}

export interface RealtimeFiltersState {
  iesId: string | null;
  simuladoId: string | null;
}

interface RealtimeFiltersProps {
  filters: RealtimeFiltersState;
  onFiltersChange: (filters: RealtimeFiltersState) => void;
}

export const RealtimeFilters = ({ filters, onFiltersChange }: RealtimeFiltersProps) => {
  const [iesList, setIesList] = useState<IES[]>([]);
  const [simuladosList, setSimuladosList] = useState<Simulado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    try {
      const [iesResult, simuladosResult] = await Promise.all([
        supabase.from('ies').select('id, nome').order('nome'),
        supabase.from('simulados_admin').select('id, nome').eq('status', 'ativo').order('nome')
      ]);

      if (iesResult.data) setIesList(iesResult.data);
      if (simuladosResult.data) setSimuladosList(simuladosResult.data);
    } catch (error) {
      Logger.error('Erro ao carregar filtros:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIesChange = (value: string) => {
    onFiltersChange({
      ...filters,
      iesId: value === 'all' ? null : value
    });
  };

  const handleSimuladoChange = (value: string) => {
    onFiltersChange({
      ...filters,
      simuladoId: value === 'all' ? null : value
    });
  };

  const clearFilters = () => {
    onFiltersChange({ iesId: null, simuladoId: null });
  };

  const hasActiveFilters = filters.iesId || filters.simuladoId;

  const getIesName = (id: string) => iesList.find(i => i.id === id)?.nome || id;
  const getSimuladoName = (id: string) => simuladosList.find(s => s.id === id)?.nome || id;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Filtros:</span>
        </div>
        
        <Select
          value={filters.iesId || 'all'}
          onValueChange={handleIesChange}
          disabled={loading}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Selecionar IES" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as IES</SelectItem>
            {iesList.map(ies => (
              <SelectItem key={ies.id} value={ies.id}>
                {ies.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.simuladoId || 'all'}
          onValueChange={handleSimuladoChange}
          disabled={loading}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Selecionar Simulado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Simulados</SelectItem>
            {simuladosList.map(sim => (
              <SelectItem key={sim.id} value={sim.id}>
                {sim.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Badges de filtros ativos */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.iesId && (
            <Badge variant="secondary" className="gap-1">
              IES: {getIesName(filters.iesId)}
              <button
                onClick={() => onFiltersChange({ ...filters, iesId: null })}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.simuladoId && (
            <Badge variant="secondary" className="gap-1">
              Simulado: {getSimuladoName(filters.simuladoId)}
              <button
                onClick={() => onFiltersChange({ ...filters, simuladoId: null })}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
