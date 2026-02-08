import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Star, 
  CheckCircle,
  Database,
  Users,
  BarChart3,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
import { exportToXLSX as exportSimuladosXLSX } from '@/utils/exportSimuladosAnalytics';

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
  simuladosData?: any; // Dados específicos de simulados do hook useSimuladosAnalytics
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  open,
  onOpenChange,
  filters,
  data,
  simuladosData,
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

  const formatOptions: { 
    value: ExportFormat; 
    label: string; 
    description: string[]; 
    icon: React.ReactNode;
    recommended?: boolean;
  }[] = [
    {
      value: 'xlsx-full',
      label: 'Excel Completo (.xlsx)',
      description: [
        '8 abas organizadas',
        'Formatação profissional',
        'Metadados completos',
      ],
      icon: <FileSpreadsheet className="w-5 h-5 text-green-600" />,
      recommended: true,
    },
    {
      value: 'csv',
      label: 'CSV Simples (.csv)',
      description: [
        'Arquivo único',
        'Compatível com qualquer software',
        'Menor tamanho',
      ],
      icon: <FileText className="w-5 h-5 text-blue-600" />,
    },
    {
      value: 'xlsx-simulados',
      label: 'Apenas Simulados (.xlsx)',
      description: [
        'Foco em performance de provas',
        '10 abas especializadas',
        'Questões problemáticas',
      ],
      icon: <BarChart3 className="w-5 h-5 text-purple-600" />,
    },
  ];

  const handleExport = async () => {
    if (!data) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      // Simulate progress
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

      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 500));

      if (selectedFormat === 'xlsx-full') {
        exportAnalyticsXLSX(data, exportFilters);
      } else if (selectedFormat === 'csv') {
        exportAnalyticsCSV(data, exportFilters);
      } else if (selectedFormat === 'xlsx-simulados' && simuladosData) {
        exportSimuladosXLSX(simuladosData, {
          dateRange: filters.dateRange,
          university: filters.university !== 'all' ? filters.university : null,
          excludedIES: filters.excludedIES,
        });
      }

      clearInterval(progressInterval);
      setExportProgress(100);

      // Close after a moment
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

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [open]);

  const hasSimuladosData = !!simuladosData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Exportar Relatório
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Period and Filters Summary */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Período:</span>
              <span className="font-medium">
                {format(filters.dateRange.start, 'dd/MM/yyyy', { locale: ptBR })} a {format(filters.dateRange.end, 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">IES:</span>
              <span className="font-medium">
                {filters.university && filters.university !== 'all' 
                  ? 'Filtrada' 
                  : filters.excludedIES.length > 0 
                    ? `Todas exceto ${filters.excludedIES.length}` 
                    : 'Todas'
                }
              </span>
            </div>
          </div>

          <Separator />

          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Selecione o formato</Label>
            
            <RadioGroup 
              value={selectedFormat} 
              onValueChange={(v) => setSelectedFormat(v as ExportFormat)}
              className="space-y-3"
            >
              {formatOptions.map((option) => {
                const isDisabled = option.value === 'xlsx-simulados' && !hasSimuladosData;
                
                return (
                  <label
                    key={option.value}
                    className={`
                      flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
                      ${selectedFormat === option.value 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/30'
                      }
                      ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <RadioGroupItem 
                      value={option.value} 
                      id={option.value} 
                      className="mt-0.5"
                      disabled={isDisabled}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {option.icon}
                        <span className="font-medium text-sm">{option.label}</span>
                        {option.recommended && (
                          <Badge variant="secondary" className="text-xs gap-0.5 bg-amber-100 text-amber-700 border-amber-200">
                            <Star className="w-3 h-3" />
                            Recomendado
                          </Badge>
                        )}
                      </div>
                      
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {option.description.map((desc, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                            {desc}
                          </li>
                        ))}
                      </ul>
                      
                      <div className="mt-2 text-xs text-muted-foreground">
                        ~{fileSizes[option.value]} KB estimado
                      </div>
                      
                      {isDisabled && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                          <AlertCircle className="w-3 h-3" />
                          Navegue até a aba Simulados primeiro
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <Separator />

          {/* Preview Stats */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium">
              <Database className="w-4 h-4" />
              Preview dos dados
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Usuários:
                </span>
                <span className="font-mono">{previewStats.totalUsuarios.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sessões:</span>
                <span className="font-mono">{previewStats.sessoesNoPeriodo.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Simulados:</span>
                <span className="font-mono">{previewStats.simuladosAnalisados}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Questões:</span>
                <span className="font-mono">{previewStats.questoesMapeadas}</span>
              </div>
            </div>
          </div>

          {/* Export Progress */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando arquivo...
                </span>
                <span>{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} className="h-2" />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleExport}
              disabled={isExporting || !data}
              className="gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Baixar Relatório
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
