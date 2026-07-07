import * as React from 'react';
import { useState, useCallback } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader, GestorLoading, GestorError, GestorEmpty } from '@/experiences/gestor/ui';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';
import { useAuth } from '@/contexts/AuthContext';
import { ExportReportDrawer } from '@/components/analytics/v2/shared/ExportReportDrawer';
import { ReportSectionsBuilder, type ReportSection } from './ReportSectionsBuilder';
import { ReportFormatSelector, type ReportFormat } from './ReportFormatSelector';
import { ReportCoverPreview } from './ReportCoverPreview';

const DEFAULT_SECTIONS: ReportSection[] = [
  { id: 'sumario', label: 'Sumário executivo', checked: true },
  { id: 'diagnostico', label: 'Diagnóstico curricular', checked: true },
  {
    id: 'alunos-risco',
    label: 'Alunos em risco (nominal)',
    note: 'dado nominal — restrito',
    checked: false,
  },
  { id: 'plano-intervencao', label: 'Plano de intervenção', checked: true },
  { id: 'anexo-dados', label: 'Anexo de dados', checked: false },
];

/**
 * Módulo "Relatórios" (`/gestor/relatorios`) — construtor de seções +
 * seletor de formato + prévia da capa. O botão "Gerar relatório" aciona o
 * fluxo do `ExportReportDrawer` já usado no `GestorLayout` (Exportar da
 * topbar), aqui renderizado localmente e controlado por estado próprio da
 * página — o drawer é um componente reusável independente que só depende de
 * props (`data`, `filters`, `simuladoNome`), então não há necessidade de
 * tocar no layout para reusá-lo.
 */
export const RelatoriosModule: React.FC = () => {
  const { user } = useAuth();
  const { filteredData: data, loading, error, refetch, filters, simuladoNome } = useGestorFilters();

  const [sections, setSections] = useState<ReportSection[]>(DEFAULT_SECTIONS);
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [exportOpen, setExportOpen] = useState(false);

  const toggleSection = useCallback((id: string) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, checked: !s.checked } : s)));
  }, []);

  const accessibleIes = user?.accessible_ies ?? [];
  const isMultiIes = accessibleIes.length > 1;
  const activeIesNome = isMultiIes
    ? (accessibleIes.find((ies) => ies.id === filters.iesId)?.nome ?? accessibleIes[0]?.nome ?? user?.ies_nome)
    : user?.ies_nome;
  const iesNome = activeIesNome ?? 'Sua IES';

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Relatórios" title="Relatório para a mantenedora / MEC" />
        <GestorLoading metricCards={0} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Relatórios" title="Relatório para a mantenedora / MEC" />
        <GestorError message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Relatórios" title="Relatório para a mantenedora / MEC" />
        <GestorEmpty
          title="Selecione um simulado"
          description="Escolha um simulado nos filtros acima para montar o relatório."
        />
      </div>
    );
  }

  const { headerSummary, meta } = data;

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Relatórios" title="Relatório para a mantenedora / MEC" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.85fr]">
        <div className="space-y-4">
          <ReportSectionsBuilder sections={sections} onToggle={toggleSection} />
          <ReportFormatSelector value={format} onChange={setFormat} />
          <Button className="w-full gap-2 sm:w-auto" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" />
            Gerar relatório
          </Button>
        </div>

        <ReportCoverPreview
          iesNome={iesNome}
          simuladoNome={simuladoNome}
          baseLabel={headerSummary.baseLabel}
          conceito={headerSummary.notaScoped}
          percentProficientes={headerSummary.percentProficientes}
          triMedio={meta.proficienciaAtual ?? null}
        />
      </div>

      <ExportReportDrawer
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        data={data}
        filters={filters}
        simuladoNome={simuladoNome}
      />
    </div>
  );
};
