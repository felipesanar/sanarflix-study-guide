import React, { useState, useCallback } from 'react';
import {
  FileDown, FileText, Table2, CheckCircle2, Loader2,
  Filter, BarChart3, Users, Target, Sparkles, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import type { InstitutionalViewModel, DesempenhoV2Filters } from '@/types/desempenhoV2';
import { generateInstitutionalPDF } from '@/utils/institutionalReportPdf';
import { generateInstitutionalXLSX } from '@/utils/institutionalReportXlsx';
import { format } from 'date-fns';

type ExportFormat = 'pdf' | 'xlsx';
type ExportModule = 'visao-institucional' | 'diagnostico-curricular' | 'visao-alunos' | 'inteligencia-decisoria';

const MODULE_CONFIG: { id: ExportModule; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'visao-institucional', label: 'Visão Institucional', icon: BarChart3, description: 'KPIs, faixas, evolução e metas' },
  { id: 'diagnostico-curricular', label: 'Diagnóstico Curricular', icon: Target, description: 'Áreas, especialidades e temas' },
  { id: 'visao-alunos', label: 'Visão de Alunos', icon: Users, description: 'Ranking, risco e segmentação' },
  { id: 'inteligencia-decisoria', label: 'Inteligência Decisória', icon: Sparkles, description: 'Insights e recomendações' },
];

interface ExportReportDrawerProps {
  open: boolean;
  onClose: () => void;
  data: InstitutionalViewModel | null;
  filters: DesempenhoV2Filters;
  simuladoNome?: string;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const ExportReportDrawer: React.FC<ExportReportDrawerProps> = ({
  open, onClose, data, filters, simuladoNome,
}) => {
  const [fmt, setFmt] = useState<ExportFormat>('pdf');
  const [selectedModules, setSelectedModules] = useState<ExportModule[]>(['visao-institucional']);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const toggleModule = useCallback((mod: ExportModule) => {
    setSelectedModules(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    );
    setGenerated(false);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!data) return;
    setGenerating(true);
    console.log('[Export]', fmt, { modules: selectedModules, filters });

    try {
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const filename = `relatorio-desempenho-${dateStr}.${fmt}`;

      if (fmt === 'pdf') {
        const blob = await generateInstitutionalPDF(data, filters, selectedModules, simuladoNome);
        triggerDownload(blob, filename);
      } else {
        const blob = generateInstitutionalXLSX(data, filters, selectedModules, simuladoNome);
        triggerDownload(blob, filename);
      }

      console.log('[ReportData]', { format: fmt, modules: selectedModules, students: data.allStudents.length });
      setGenerated(true);
      toast.success('Relatório gerado com sucesso!');
    } catch (err) {
      console.error('[Export] Erro ao gerar relatório:', err);
      toast.error('Erro ao gerar relatório. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  }, [data, fmt, selectedModules, filters, simuladoNome]);

  const activeFilterCount = [
    filters.turmas.length > 0,
    filters.semestres.length > 0,
    filters.areas.length > 0,
    filters.especialidades.length > 0,
    filters.temas.length > 0,
  ].filter(Boolean).length;

  const largeDataset = (data?.allStudents.length ?? 0) > 500;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Exportar Relatório
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Context info */}
          <Card className="bg-muted/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 text-sm">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{simuladoNome || 'Simulado selecionado'}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeFilterCount > 0 ? `${activeFilterCount} filtro(s) aplicado(s)` : 'Sem filtros adicionais'}
                    {filters.iesId ? ' · IES filtrada' : ''}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Large dataset warning */}
          {largeDataset && (
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="py-3 px-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Este relatório contém {data?.allStudents.length} alunos e pode levar alguns segundos para ser gerado.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Format selection */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Formato</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setFmt('pdf'); setGenerated(false); }}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                  fmt === 'pdf' ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
                }`}
              >
                <FileText className={`h-5 w-5 ${fmt === 'pdf' ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-left">
                  <p className="text-sm font-medium">PDF</p>
                  <p className="text-[10px] text-muted-foreground">Relatório executivo</p>
                </div>
              </button>
              <button
                onClick={() => { setFmt('xlsx'); setGenerated(false); }}
                className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                  fmt === 'xlsx' ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
                }`}
              >
                <Table2 className={`h-5 w-5 ${fmt === 'xlsx' ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-left">
                  <p className="text-sm font-medium">Excel</p>
                  <p className="text-[10px] text-muted-foreground">Dados para análise</p>
                </div>
              </button>
            </div>
          </div>

          {/* Module selection */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Módulos incluídos</p>
            <div className="space-y-1.5">
              {MODULE_CONFIG.map(mod => {
                const Icon = mod.icon;
                const checked = selectedModules.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    onClick={() => toggleModule(mod.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      checked ? 'border-primary/30 bg-primary/5' : 'hover:bg-accent/50'
                    }`}
                  >
                    <Checkbox checked={checked} className="shrink-0" />
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{mod.label}</p>
                      <p className="text-xs text-muted-foreground">{mod.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Preview */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">O relatório incluirá</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>• Filtros aplicados e período de referência</p>
              <p>• Principais indicadores (KPIs) da IES</p>
              {selectedModules.includes('diagnostico-curricular') && <p>• Diagnóstico por área, especialidade e tema</p>}
              {selectedModules.includes('visao-alunos') && <p>• Lista de alunos com nível de risco e score</p>}
              {selectedModules.includes('inteligencia-decisoria') && <p>• Insights prioritários e recomendações</p>}
              <p>• Conceito institucional atual</p>
            </div>
          </div>

          {/* Generate button */}
          <div className="space-y-2">
            {generated ? (
              <Card className="bg-emerald-500/5 border-emerald-500/20">
                <CardContent className="py-3 px-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Relatório gerado!</p>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                      O download do {fmt.toUpperCase()} foi iniciado automaticamente.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button
                className="w-full gap-2"
                disabled={selectedModules.length === 0 || generating || !data}
                onClick={handleGenerate}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando {fmt.toUpperCase()}...
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    Gerar Relatório {fmt.toUpperCase()}
                    <Badge variant="secondary" className="text-[10px] ml-1">
                      {selectedModules.length} módulo(s)
                    </Badge>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
