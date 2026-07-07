import * as React from 'react';
import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
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
    note: 'Inclui nomes de alunos — disponível para gestores com permissão de dados nominais.',
    checked: false,
  },
  { id: 'plano-intervencao', label: 'Plano de intervenção', checked: true },
  { id: 'anexo-dados', label: 'Anexo de dados', checked: false },
];

/**
 * Módulos que o `ExportReportDrawer` sabe gerar, na mesma união de tipo usada
 * lá dentro (não exportada — replicada aqui deliberadamente para não alterar
 * a superfície pública do drawer além das novas props opcionais).
 */
type DrawerModule = 'visao-institucional' | 'diagnostico-curricular' | 'visao-alunos' | 'inteligencia-decisoria';

/**
 * Mapeamento seção do builder → módulo do drawer. "Anexo de dados" não tem
 * módulo equivalente no drawer hoje (o drawer não gera um anexo de dados
 * brutos à parte) — fica documentado aqui e é ignorado na conversão.
 */
const SECTION_TO_MODULE: Partial<Record<string, DrawerModule>> = {
  sumario: 'visao-institucional',
  diagnostico: 'diagnostico-curricular',
  'alunos-risco': 'visao-alunos',
  'plano-intervencao': 'inteligencia-decisoria',
  // 'anexo-dados': sem módulo equivalente no ExportReportDrawer.
};

function sectionsToModules(sections: ReportSection[]): DrawerModule[] {
  const modules = sections
    .filter((s) => s.checked)
    .map((s) => SECTION_TO_MODULE[s.id])
    .filter((m): m is DrawerModule => Boolean(m));
  // dedup preservando ordem, caso duas seções mapeiem pro mesmo módulo
  return Array.from(new Set(modules));
}

/** O drawer só sabe gerar pdf/xlsx; "link" (em breve, hoje desabilitado no seletor) cai em pdf. */
function formatToDrawerFormat(fmt: ReportFormat): 'pdf' | 'xlsx' {
  return fmt === 'xlsx' ? 'xlsx' : 'pdf';
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

/**
 * Módulo "Relatórios" (`/gestor/relatorios`) — construtor de seções +
 * seletor de formato + prévia da capa. O botão "Gerar relatório" aciona o
 * fluxo do `ExportReportDrawer` já usado no `GestorLayout` (Exportar da
 * topbar), aqui renderizado localmente e controlado por estado próprio da
 * página. As seções marcadas e o formato escolhido nesta tela são
 * convertidos (`sectionsToModules` / `formatToDrawerFormat`) e passados via
 * `initialModules`/`initialFormat`, que reinicializam o estado interno do
 * drawer a cada abertura — o que o usuário monta aqui é o que abre
 * pré-selecionado lá. O `GestorLayout` continua usando o drawer sem essas
 * props (comportamento padrão inalterado).
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

      <motion.div
        className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.85fr]"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div className="space-y-4" variants={itemVariants}>
          <ReportSectionsBuilder sections={sections} onToggle={toggleSection} />
          <ReportFormatSelector value={format} onChange={setFormat} />
          <Button
            className="group w-full gap-2 rounded-xl bg-gradient-to-r from-primary/90 to-primary/80 shadow-md transition-all duration-300 hover:from-primary hover:to-primary/90 hover:shadow-lg sm:w-auto"
            onClick={() => setExportOpen(true)}
          >
            <Download className="h-4 w-4" />
            Gerar relatório
          </Button>
        </motion.div>

        <motion.div variants={itemVariants}>
          <ReportCoverPreview
            iesNome={iesNome}
            simuladoNome={simuladoNome}
            baseLabel={headerSummary.baseLabel}
            conceito={headerSummary.notaScoped}
            percentProficientes={headerSummary.percentProficientes}
            triMedio={meta.proficienciaAtual ?? null}
          />
        </motion.div>
      </motion.div>

      <ExportReportDrawer
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        data={data}
        filters={filters}
        simuladoNome={simuladoNome}
        initialModules={sectionsToModules(sections)}
        initialFormat={formatToDrawerFormat(format)}
        autoFocusGenerate
      />
    </div>
  );
};
