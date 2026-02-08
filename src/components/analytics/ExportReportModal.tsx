import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Sparkles,
  CheckCircle2,
  Database,
  Users,
  BarChart3,
  AlertCircle,
  Loader2,
  Calendar,
  Building2,
  Activity,
  HelpCircle,
  Target,
  Clock,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { 
  exportAnalyticsXLSX, 
  exportAnalyticsCSV, 
  calculatePreviewStats,
  estimateFileSizeKB,
  type AnalyticsExportData,
  type AnalyticsExportFilters,
  type ExportPreviewStats
} from '@/utils/exportAnalyticsReport';
import { exportToXLSX as exportSimuladosPremiumXLSX, type SimuladosPremiumExportData } from '@/utils/exportSimuladosAnalytics';

type ExportFormat = 'xlsx-full' | 'csv' | 'xlsx-simulados';

interface ExportReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: {
    dateRange: { start: Date; end: Date };
    university: string;
    excludedIES: string[];
  };
  data: AnalyticsExportData;
  simuladosPremiumData?: SimuladosPremiumExportData | null;
}

const formatOptions: { 
  value: ExportFormat; 
  label: string; 
  subtitle: string;
  features: string[]; 
  icon: React.ElementType;
  iconColor: string;
  recommended?: boolean;
  gradient: string;
}[] = [
  {
    value: 'xlsx-full',
    label: 'Excel Completo',
    subtitle: '.xlsx',
    features: [
      '8 abas organizadas',
      'Formatação profissional',
      'Metadados completos',
      'Pronto para apresentações',
    ],
    icon: FileSpreadsheet,
    iconColor: 'text-emerald-500',
    recommended: true,
    gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
  },
  {
    value: 'csv',
    label: 'CSV Simples',
    subtitle: '.csv',
    features: [
      'Arquivo único',
      'Compatível com qualquer software',
      'Menor tamanho',
      'Ideal para importação',
    ],
    icon: FileText,
    iconColor: 'text-blue-500',
    gradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
  },
  {
    value: 'xlsx-simulados',
    label: 'Simulados Premium',
    subtitle: '.xlsx',
    features: [
      '15 abas especializadas',
      'Gaps pedagógicos rankeados',
      'Matriz IES × Simulado',
      'Heatmap + Distribuição',
    ],
    icon: BarChart3,
    iconColor: 'text-violet-500',
    gradient: 'from-violet-500/10 via-violet-500/5 to-transparent',
  },
];

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  open,
  onOpenChange,
  filters,
  data,
  simuladosPremiumData,
}) => {
  const { user } = useAuth();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('xlsx-full');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Calculate preview stats
  const previewStats = useMemo<ExportPreviewStats>(() => {
    if (!data) {
      return {
        totalUsuarios: 0,
        sessoesNoPeriodo: 0,
        simuladosAnalisados: 0,
        questoesMapeadas: 0,
        questoesProblematicas: 0,
        registrosTotais: 0,
      };
    }
    return calculatePreviewStats(data);
  }, [data]);

  // Estimate file sizes
  const fileSizes = useMemo(() => ({
    'xlsx-full': estimateFileSizeKB(data, 'xlsx'),
    'csv': estimateFileSizeKB(data, 'csv'),
    'xlsx-simulados': Math.round(estimateFileSizeKB(data, 'xlsx') * 0.6),
  }), [data]);

  const handleExport = async () => {
    if (!data) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 85) {
            clearInterval(progressInterval);
            return 85;
          }
          return prev + 15;
        });
      }, 100);

      const exportFilters: AnalyticsExportFilters = {
        dateRange: filters.dateRange,
        university: filters.university !== 'all' ? filters.university : null,
        excludedIES: filters.excludedIES,
        exportedBy: user?.email || 'Sistema',
      };

      await new Promise(resolve => setTimeout(resolve, 500));

      if (selectedFormat === 'xlsx-full') {
        exportAnalyticsXLSX(data, exportFilters);
      } else if (selectedFormat === 'csv') {
        exportAnalyticsCSV(data, exportFilters);
      } else if (selectedFormat === 'xlsx-simulados') {
        if (!simuladosPremiumData) {
          throw new Error('Dados Premium de Simulados não carregados. Acesse a aba Simulados no Analytics e tente novamente.');
        }

        exportSimuladosPremiumXLSX(simuladosPremiumData, {
          dateRange: filters.dateRange,
          university: filters.university !== 'all' ? filters.university : null,
          excludedIES: filters.excludedIES,
        });
      }

      clearInterval(progressInterval);
      setExportProgress(100);

      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
        onOpenChange(false);
      }, 800);

    } catch (error) {
      console.error('[ExportReportModal] Erro ao exportar:', error);
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  useEffect(() => {
    if (!open) {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [open]);

  // Simulados Premium exige os dados completos do hook useSimuladosAnalytics (carregados ao abrir a aba Simulados)
  const hasSimuladosPremiumData = (simuladosPremiumData?.simulados?.length ?? 0) > 0;
  const selectedOption = formatOptions.find(o => o.value === selectedFormat);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/50">
        {/* Header com gradiente */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <DialogHeader className="relative p-4 sm:p-6 pb-4">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                <Download className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  Exportar Relatório
                </DialogTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Gere um relatório completo dos dados analíticos
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[70vh] sm:max-h-[65vh]">
          <div className="p-4 sm:p-6 pt-2 space-y-4 sm:space-y-6">
            {/* Filtros aplicados - Cards compactos */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="p-2.5 sm:p-3 rounded-xl bg-muted/50 border border-border/50 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wide">Período</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                  {format(filters.dateRange.start, 'dd/MM/yy', { locale: ptBR })} - {format(filters.dateRange.end, 'dd/MM/yy', { locale: ptBR })}
                </p>
              </div>
              
              <div className="p-2.5 sm:p-3 rounded-xl bg-muted/50 border border-border/50 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wide">IES</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                  {filters.university && filters.university !== 'all' 
                    ? 'Filtrada' 
                    : filters.excludedIES.length > 0 
                      ? `Todas (−${filters.excludedIES.length})` 
                      : 'Todas'
                  }
                </p>
              </div>
            </div>

            {/* Preview dos dados - MOVIDO PARA CIMA */}
            <div className="space-y-3">
              <h3 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                Dados incluídos no relatório
              </h3>
              
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
                {[
                  { icon: Users, label: 'Usuários', value: previewStats.totalUsuarios, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                  { icon: Activity, label: 'Sessões', value: previewStats.sessoesNoPeriodo, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                  { icon: Target, label: 'Simulados', value: previewStats.simuladosAnalisados, color: 'text-violet-500', bg: 'bg-violet-500/10' },
                  { icon: HelpCircle, label: 'Questões', value: previewStats.questoesMapeadas, color: 'text-sky-500', bg: 'bg-sky-500/10' },
                  { icon: AlertTriangle, label: 'Problemáticas', value: previewStats.questoesProblematicas, color: 'text-rose-500', bg: 'bg-rose-500/10', tooltip: 'Taxa de erro ≥50%' },
                ].map((stat, idx) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-2 sm:p-3 rounded-xl ${stat.bg} border border-border/30 text-center`}
                    title={(stat as any).tooltip}
                  >
                    <stat.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mx-auto mb-1 ${stat.color}`} />
                    <p className="text-sm sm:text-base font-bold text-foreground font-mono">
                      {stat.value.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">
                      {stat.label}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Seleção de formato */}
            <div className="space-y-3">
              <h3 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                Selecione o formato
              </h3>
              <div className="space-y-2 sm:space-y-3">
                {formatOptions.map((option) => {
                  const isDisabled = option.value === 'xlsx-simulados' && !hasSimuladosPremiumData;
                  const isSelected = selectedFormat === option.value;
                  const Icon = option.icon;
                  
                  return (
                    <motion.button
                      key={option.value}
                      type="button"
                      onClick={() => !isDisabled && setSelectedFormat(option.value)}
                      disabled={isDisabled}
                      className={`
                        relative w-full text-left p-3 sm:p-4 rounded-xl border transition-all duration-300
                        ${isSelected 
                          ? 'border-primary bg-gradient-to-r shadow-lg shadow-primary/10 ring-1 ring-primary/30' 
                          : 'border-border/50 bg-card/50 hover:border-primary/30 hover:bg-card'
                        }
                        ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                        ${isSelected ? option.gradient : ''}
                      `}
                      whileHover={!isDisabled ? { scale: 1.01 } : {}}
                      whileTap={!isDisabled ? { scale: 0.99 } : {}}
                    >
                      {/* Indicador de seleção */}
                      <div className={`
                        absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 
                        flex items-center justify-center transition-all duration-300
                        ${isSelected 
                          ? 'border-primary bg-primary' 
                          : 'border-muted-foreground/30 bg-transparent'
                        }
                      `}>
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                            >
                              <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary-foreground" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="ml-7 sm:ml-9">
                        {/* Header do card */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                          <div className={`p-1.5 sm:p-2 rounded-lg bg-background/80 border border-border/50`}>
                            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${option.iconColor}`} />
                          </div>
                          
                          <div className="flex items-baseline gap-1.5 sm:gap-2">
                            <span className="text-sm sm:text-base font-semibold text-foreground">
                              {option.label}
                            </span>
                            <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                              {option.subtitle}
                            </span>
                          </div>

                          {option.recommended && (
                            <Badge 
                              variant="secondary" 
                              className="ml-auto text-[10px] sm:text-xs gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium shrink-0"
                            >
                              <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              <span className="hidden xs:inline">Recomendado</span>
                              <span className="xs:hidden">★</span>
                            </Badge>
                          )}
                        </div>

                        {/* Features grid */}
                        <div className="mt-2 sm:mt-3 grid grid-cols-2 gap-x-3 gap-y-1 sm:gap-y-1.5">
                          {option.features.map((feature, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground"
                            >
                              <CheckCircle2 className={`w-3 h-3 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground/50'}`} />
                              <span className="truncate">{feature}</span>
                            </div>
                          ))}
                        </div>

                        {/* Footer com tamanho */}
                        <div className="mt-2 sm:mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>~{fileSizes[option.value]} KB</span>
                          </div>
                          
                          {isDisabled && (
                            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-amber-600 dark:text-amber-400">
                              <AlertCircle className="w-3 h-3" />
                              <span>Acesse Simulados</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer com ações */}
        <div className="relative border-t border-border/50 bg-muted/30 p-4 sm:p-6">
          {/* Progress bar */}
          <AnimatePresence>
            {isExporting && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between text-xs sm:text-sm mb-2">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-primary" />
                    <span>Gerando relatório...</span>
                  </span>
                  <span className="font-mono font-medium text-foreground">{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} className="h-1.5 sm:h-2" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Info do formato selecionado */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="w-3.5 h-3.5" />
              <span>
                {selectedOption?.label} • ~{fileSizes[selectedFormat]} KB
              </span>
            </div>

            {/* Botões */}
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isExporting}
                className="flex-1 sm:flex-none text-sm"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleExport}
                disabled={isExporting || !data || (selectedFormat === 'xlsx-simulados' && !hasSimuladosPremiumData)}
                className="flex-1 sm:flex-none gap-2 text-sm bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden xs:inline">Exportando...</span>
                    <span className="xs:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Baixar</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
