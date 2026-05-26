import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Download, AlertCircle, CheckCircle, FileText, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AnalyticsFilters } from '@/pages/Analytics';
import { Logger } from '@/utils/logger';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AnalyticsFilters;
}

interface ExportRow {
  usuario_id: string;
  nome: string;
  email: string;
  ies_nome: string;
  semestre: number | null;
  total_sessoes: number;
  tempo_medio_min: number;
  page_views: number;
  simulados_iniciados: number;
  simulados_finalizados: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({ open, onOpenChange, filters }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [exportData, setExportData] = useState<ExportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchExportData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    Logger.info('[ExportModal] Buscando dados para exportação com filtros:', filters);

    try {
      const startDate = filters.dateRange.start.toISOString();
      const endDate = filters.dateRange.end.toISOString();
      const iesFilter = filters.university && filters.university !== 'all' ? filters.university : null;

      // Buscar usuários com filtro de IES
      let usersQuery = supabase
        .from('users')
        .select('id, nome, email, id_ies, semestre')
        .limit(1000);
      
      if (iesFilter) {
        usersQuery = usersQuery.eq('id_ies', iesFilter);
      }

      const { data: usersData, error: usersError } = await usersQuery;

      if (usersError) {
        throw new Error('Erro ao buscar usuários: ' + usersError.message);
      }

      if (!usersData || usersData.length === 0) {
        setExportData([]);
        setTotalRecords(0);
        return;
      }

      // Buscar nomes das IES
      const { data: iesData } = await supabase.from('ies').select('id, nome');
      const iesMap = new Map(iesData?.map(i => [i.id, i.nome]) || []);

      // Buscar sessões no período
      const userIds = usersData.map(u => u.id);
      const { data: sessionsData } = await supabase
        .from('user_sessions')
        .select('user_id, duration_seconds')
        .in('user_id', userIds)
        .gte('started_at', startDate)
        .lte('started_at', endDate);

      // Agregar sessões por usuário
      const sessionsByUser = new Map<string, { count: number; totalDuration: number }>();
      sessionsData?.forEach(s => {
        const existing = sessionsByUser.get(s.user_id) || { count: 0, totalDuration: 0 };
        sessionsByUser.set(s.user_id, {
          count: existing.count + 1,
          totalDuration: existing.totalDuration + (s.duration_seconds || 0),
        });
      });

      // Buscar page views no período
      const { data: pageViewsData } = await supabase
        .from('page_views')
        .select('user_id')
        .in('user_id', userIds)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const pageViewsByUser = new Map<string, number>();
      pageViewsData?.forEach(pv => {
        const count = pageViewsByUser.get(pv.user_id) || 0;
        pageViewsByUser.set(pv.user_id, count + 1);
      });

      // Buscar simulados iniciados no período
      const { data: iniciadosData } = await supabase
        .from('simulados_iniciados')
        .select('user_id')
        .in('user_id', userIds)
        .gte('started_at', startDate)
        .lte('started_at', endDate);

      const iniciadosByUser = new Map<string, number>();
      iniciadosData?.forEach(i => {
        const count = iniciadosByUser.get(i.user_id) || 0;
        iniciadosByUser.set(i.user_id, count + 1);
      });

      // Buscar simulados finalizados no período
      const { data: finalizadosData } = await supabase
        .from('simulados_finalizados')
        .select('user_id')
        .in('user_id', userIds)
        .gte('finalizado_em', startDate)
        .lte('finalizado_em', endDate);

      const finalizadosByUser = new Map<string, number>();
      finalizadosData?.forEach(f => {
        const count = finalizadosByUser.get(f.user_id) || 0;
        finalizadosByUser.set(f.user_id, count + 1);
      });

      // Montar dados de exportação
      const exportRows: ExportRow[] = usersData.map(user => {
        const sessions = sessionsByUser.get(user.id) || { count: 0, totalDuration: 0 };
        const tempoMedio = sessions.count > 0 ? Math.round(sessions.totalDuration / sessions.count / 60 * 10) / 10 : 0;

        return {
          usuario_id: user.id,
          nome: user.nome,
          email: user.email,
          ies_nome: user.id_ies ? (iesMap.get(user.id_ies) || 'Desconhecida') : 'Sem IES',
          semestre: user.semestre,
          total_sessoes: sessions.count,
          tempo_medio_min: tempoMedio,
          page_views: pageViewsByUser.get(user.id) || 0,
          simulados_iniciados: iniciadosByUser.get(user.id) || 0,
          simulados_finalizados: finalizadosByUser.get(user.id) || 0,
        };
      });

      // Ordenar por total de sessões (mais ativos primeiro)
      exportRows.sort((a, b) => b.total_sessoes - a.total_sessoes);

      setExportData(exportRows);
      setTotalRecords(exportRows.length);
      Logger.info('[ExportModal] Dados carregados:', exportRows.length, 'registros');
    } catch (err) {
      Logger.error('[ExportModal] Erro ao buscar dados:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (open) {
      fetchExportData();
    }
  }, [open, fetchExportData]);

  const handleDownload = () => {
    if (exportData.length === 0) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    // Simular progresso inicial
    const progressInterval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 80) {
          clearInterval(progressInterval);
          return 80;
        }
        return prev + 20;
      });
    }, 100);

    try {
      // Criar CSV real
      const headers = [
        'usuario_id',
        'nome',
        'email',
        'ies_nome',
        'semestre',
        'total_sessoes',
        'tempo_medio_min',
        'page_views',
        'simulados_iniciados',
        'simulados_finalizados'
      ];

      const csvRows = [
        headers.join(','),
        ...exportData.map(row => [
          row.usuario_id,
          `"${row.nome.replace(/"/g, '""')}"`,
          row.email,
          `"${row.ies_nome.replace(/"/g, '""')}"`,
          row.semestre ?? 'N/A',
          row.total_sessoes,
          row.tempo_medio_min,
          row.page_views,
          row.simulados_iniciados,
          row.simulados_finalizados
        ].join(','))
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      const dateStr = format(new Date(), 'yyyy-MM-dd_HH-mm', { locale: ptBR });
      link.href = url;
      link.download = `analytics_export_${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadProgress(100);

      setTimeout(() => {
        setIsDownloading(false);
        toast({
          title: "CSV exportado com sucesso!",
          description: `${exportData.length} registros exportados`,
          duration: 3000,
        });
        onOpenChange(false);
      }, 500);
    } catch (err) {
      clearInterval(progressInterval);
      setIsDownloading(false);
      Logger.error('[ExportModal] Erro ao gerar CSV:', err);
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível gerar o arquivo CSV",
        variant: "destructive",
      });
    }
  };

  const previewData = exportData.slice(0, 20);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Exportar Dados Analíticos
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          {/* Filters Summary */}
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">
              Filtros aplicados na exportação:
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                Período: {format(filters.dateRange.start, 'dd/MM/yyyy', { locale: ptBR })} - {format(filters.dateRange.end, 'dd/MM/yyyy', { locale: ptBR })}
              </Badge>
              {filters.university && filters.university !== 'all' && (
                <Badge variant="secondary">
                  IES filtrada
                </Badge>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Buscando dados reais do Supabase...
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mb-4" />
              <p className="text-lg font-medium mb-2">Erro ao carregar dados</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button variant="outline" onClick={fetchExportData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && exportData.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Nenhum dado encontrado</p>
              <p className="text-sm text-muted-foreground">
                Não há usuários ou dados com os filtros aplicados
              </p>
            </div>
          )}

          {/* Data Preview Table */}
          {!isLoading && !error && exportData.length > 0 && (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    <strong>{totalRecords}</strong> registros encontrados (preview das primeiras {previewData.length} linhas)
                  </p>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Dados reais
                  </Badge>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Nome</TableHead>
                        <TableHead className="whitespace-nowrap">Email</TableHead>
                        <TableHead className="whitespace-nowrap">IES</TableHead>
                        <TableHead className="whitespace-nowrap text-center">Sem.</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Sessões</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Tempo Méd.</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Views</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Sim. Ini.</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Sim. Fin.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row) => (
                        <TableRow key={row.usuario_id}>
                          <TableCell className="font-medium max-w-[150px] truncate">
                            {row.nome}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-muted-foreground">
                            {row.email}
                          </TableCell>
                          <TableCell className="max-w-[100px] truncate">
                            {row.ies_nome}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.semestre ?? '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {row.total_sessoes}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.tempo_medio_min}min
                          </TableCell>
                          <TableCell className="text-right">
                            {row.page_views}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.simulados_iniciados}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.simulados_finalizados}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {totalRecords > 20 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  ... e mais {totalRecords - 20} registros no arquivo completo
                </p>
              )}
            </>
          )}
        </div>

        {/* Download Section */}
        <div className="border-t pt-4 space-y-4">
          {isDownloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Gerando arquivo CSV...</span>
                <span>{downloadProgress}%</span>
              </div>
              <Progress value={downloadProgress} className="w-full" />
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              <p>Formato: CSV (compatível com Excel)</p>
              <p>Tamanho estimado: ~{Math.round(exportData.length * 0.15)}KB</p>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isDownloading}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleDownload}
                disabled={isDownloading || isLoading || exportData.length === 0}
                className="gap-2"
              >
                {isDownloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Baixando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Baixar CSV ({totalRecords})
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
