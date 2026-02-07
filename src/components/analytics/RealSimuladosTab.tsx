import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Download, BarChart3, Target, TrendingUp, 
  AlertTriangle, FileText, Layers, Users, FileSpreadsheet, FileDown
} from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { EmptyState } from './EmptyState';
import { 
  ExecutiveKPICards, 
  SimuladosTable, 
  QuestoesProblematicasCard,
  SegmentacaoCharts,
  TemporalCharts,
  ComportamentoCard,
  SimuladoDetailsDrawer
} from './simulados';
import { useSimuladosAnalytics, type SimuladoOverview } from '@/hooks/useSimuladosAnalytics';
import { exportToCSV, exportToXLSX } from '@/utils/exportSimuladosAnalytics';
import type { AnalyticsFilters as FiltersType } from '@/pages/Analytics';

interface RealSimuladosTabProps {
  filters: FiltersType;
}

export const RealSimuladosTab: React.FC<RealSimuladosTabProps> = ({ filters }) => {
  const [selectedSimulado, setSelectedSimulado] = useState<SimuladoOverview | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Transform filters to hook format
  const hookFilters = useMemo(() => ({
    dateRange: filters.dateRange,
    iesId: filters.university || null,
    excludedIES: filters.excludedIES || [],
  }), [filters]);

  const { 
    executive, 
    temporal, 
    segmentacaoIES,
    segmentacaoSemestre,
    segmentacaoArea,
    segmentacaoEspecialidade,
    segmentacaoTema,
    segmentacaoDificuldade,
    simulados,
    questoesProblematicas,
    comportamento,
    isLoading,
    error,
    refetch,
  } = useSimuladosAnalytics(hookFilters);

  const handleSimuladoClick = (simulado: SimuladoOverview) => {
    setSelectedSimulado(simulado);
    setDrawerOpen(true);
  };

  // Export data object for reuse
  const exportData = useMemo(() => ({
    executive,
    simulados,
    segmentacaoIES,
    segmentacaoSemestre,
    segmentacaoArea,
    segmentacaoEspecialidade,
    segmentacaoTema,
    segmentacaoDificuldade,
    questoesProblematicas,
    comportamento,
  }), [executive, simulados, segmentacaoIES, segmentacaoSemestre, segmentacaoArea, segmentacaoEspecialidade, segmentacaoTema, segmentacaoDificuldade, questoesProblematicas, comportamento]);

  const handleExportCSV = () => {
    exportToCSV(exportData, filters);
  };

  const handleExportXLSX = () => {
    exportToXLSX(exportData, filters);
  };

  // Check if we have any data
  const hasData = simulados.length > 0 || executive.totalRespostas > 0;

  if (error) {
    return (
      <EmptyState
        titulo="Erro ao carregar dados"
        motivo={error}
        sugestao="Tente novamente ou verifique sua conexão"
      />
    );
  }

  if (!isLoading && !hasData) {
    return (
      <div className="space-y-6">
        <SectionHeader
          titulo="Analytics de Simulados"
          subtitulo="Visão executiva de desempenho, comportamento e oportunidades pedagógicas"
          icon={<BarChart3 className="w-5 h-5 text-primary" />}
        />
        <EmptyState
          titulo="Sem dados de simulados"
          motivo="Não há simulados configurados ou respostas registradas no período selecionado."
          sugestao="Configure simulados no painel administrativo ou ajuste o período de análise"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <SectionHeader
          titulo="Analytics de Simulados"
          subtitulo="Visão executiva de desempenho, comportamento e oportunidades pedagógicas"
          icon={<BarChart3 className="w-5 h-5 text-primary" />}
          className="mb-0"
        />
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isLoading || !hasData}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportXLSX} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Excel (.xlsx)</span>
                <Badge variant="secondary" className="ml-auto text-xs">Recomendado</Badge>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
                <FileDown className="w-4 h-4 text-muted-foreground" />
                <span>CSV (.csv)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Section A: Executive Summary */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Resumo Executivo</h3>
        </div>
        <ExecutiveKPICards kpis={executive} isLoading={isLoading} />
      </section>

      <Separator />

      {/* Section B: Temporal Evolution */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Evolução Temporal</h3>
        </div>
        <TemporalCharts data={temporal} isLoading={isLoading} />
      </section>

      <Separator />

      {/* Section C: Segmentation */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Desempenho Pedagógico (Segmentação)</h3>
        </div>
        <SegmentacaoCharts
          byIES={segmentacaoIES}
          bySemestre={segmentacaoSemestre}
          byArea={segmentacaoArea}
          byEspecialidade={segmentacaoEspecialidade}
          byTema={segmentacaoTema}
          byDificuldade={segmentacaoDificuldade}
          isLoading={isLoading}
        />
      </section>

      <Separator />

      {/* Section D: Performance by Simulado */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Performance por Simulado</h3>
          <Badge variant="outline" className="ml-2 text-xs">
            {simulados.length} simulados
          </Badge>
        </div>
        <SimuladosTable 
          simulados={simulados} 
          onSimuladoClick={handleSimuladoClick}
          isLoading={isLoading}
        />
      </section>

      <Separator />

      {/* Section E & F: Questions + Behavior (side by side on large screens) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <h3 className="font-semibold">Questões Problemáticas</h3>
          </div>
          <QuestoesProblematicasCard 
            questoes={questoesProblematicas}
            isLoading={isLoading}
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Comportamento</h3>
          </div>
          <ComportamentoCard 
            metrics={comportamento}
            isLoading={isLoading}
          />
        </div>
      </section>

      {/* Simulado Details Drawer */}
      <SimuladoDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        simulado={selectedSimulado}
        iesBreakdown={segmentacaoIES}
        areaBreakdown={segmentacaoArea}
      />
    </div>
  );
};

export default RealSimuladosTab;
