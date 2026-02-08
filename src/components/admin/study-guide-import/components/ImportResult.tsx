/**
 * ImportResult Component
 * Shows final import results with success/error summary
 */

import * as React from 'react';
import { CheckCircle2, XCircle, Download, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { downloadAsFile } from '../utils/parseFile';
import type { ImportResponse, ImportResultRow } from '../types';

interface ImportResultProps {
  result: ImportResponse;
  onReset: () => void;
  onViewGuide?: () => void;
}

export const ImportResult: React.FC<ImportResultProps> = ({
  result,
  onReset,
  onViewGuide,
}) => {
  const handleDownloadErrors = () => {
    if (result.errors.length === 0) return;
    
    const headers = ['row_number', 'sheet_name', 'status', 'error'];
    const rows = result.errors.map(error => [
      String(error.rowNumber),
      error.sheetName || '',
      error.status,
      `"${(error.error || '').replace(/"/g, '""')}"`,
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    downloadAsFile(csvContent, `guia-estudos-erros-import-${timestamp}.csv`);
  };

  const totalProcessed = result.counts.inserted + result.counts.updated + result.counts.ignored + result.counts.errors;
  const successRate = totalProcessed > 0 
    ? ((result.counts.inserted + result.counts.updated) / totalProcessed * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Main Status */}
      <div
        className={cn(
          'rounded-xl border-2 p-6 text-center',
          result.success
            ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-destructive bg-destructive/10'
        )}
      >
        <div className="flex justify-center mb-4">
          {result.success ? (
            <div className="rounded-full bg-emerald-500/20 p-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            </div>
          ) : (
            <div className="rounded-full bg-destructive/20 p-4">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
          )}
        </div>
        <h3 className={cn(
          'text-xl font-bold mb-2',
          result.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
        )}>
          {result.success ? 'Importação Concluída!' : 'Importação com Erros'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {result.success
            ? `${result.counts.inserted + result.counts.updated} registros processados com sucesso`
            : `${result.counts.errors} erro${result.counts.errors !== 1 ? 's' : ''} encontrado${result.counts.errors !== 1 ? 's' : ''}`}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          ID da requisição: {result.requestId}
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border bg-emerald-500/10 border-emerald-500/30 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {result.counts.inserted.toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-muted-foreground">Inseridos</div>
        </div>
        
        <div className="rounded-lg border bg-blue-500/10 border-blue-500/30 p-4 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {result.counts.updated.toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-muted-foreground">Atualizados</div>
        </div>
        
        {result.counts.deleted > 0 && (
          <div className="rounded-lg border bg-amber-500/10 border-amber-500/30 p-4 text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {result.counts.deleted.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-muted-foreground">Removidos</div>
          </div>
        )}
        
        <div className="rounded-lg border bg-muted p-4 text-center">
          <div className="text-2xl font-bold text-muted-foreground">
            {result.counts.ignored.toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-muted-foreground">Ignorados</div>
        </div>
        
        {result.counts.errors > 0 && (
          <div className="rounded-lg border bg-destructive/10 border-destructive/30 p-4 text-center">
            <div className="text-2xl font-bold text-destructive">
              {result.counts.errors.toLocaleString('pt-BR')}
            </div>
            <div className="text-xs text-muted-foreground">Erros</div>
          </div>
        )}
      </div>

      {/* Performance */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            {successRate}% de sucesso
          </Badge>
          <span className="text-sm text-muted-foreground">
            Tempo de processamento: {(result.durationMs / 1000).toFixed(2)}s
          </span>
        </div>
      </div>

      {/* Error List */}
      {result.errors.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Erros na importação
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
              <Download className="h-4 w-4 mr-2" />
              Baixar erros (CSV)
            </Button>
          </div>
          <ScrollArea className="h-[150px] rounded-lg border border-destructive/30 bg-destructive/5">
            <div className="p-4 space-y-2 text-sm">
              {result.errors.slice(0, 20).map((error, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Badge variant="destructive" className="text-xs shrink-0">
                    Linha {error.rowNumber}
                  </Badge>
                  <span className="text-muted-foreground">
                    {error.error || 'Erro desconhecido'}
                  </span>
                </div>
              ))}
              {result.errors.length > 20 && (
                <div className="text-muted-foreground/70 text-center pt-2">
                  ... e mais {result.errors.length - 20} erros (baixe o relatório completo)
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onReset} variant="outline" className="flex-1">
          <RefreshCw className="h-4 w-4 mr-2" />
          Nova Importação
        </Button>
        {onViewGuide && (
          <Button onClick={onViewGuide} className="flex-1">
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver Guia de Estudos
          </Button>
        )}
      </div>
    </div>
  );
};
