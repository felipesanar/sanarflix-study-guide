/**
 * ValidationSummary Component
 * Shows validation results with errors/warnings
 */

import * as React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { generateErrorReport, downloadAsFile } from '../utils/parseFile';
import type { ValidationResult, ValidationIssue, ChangePlan } from '../types';

interface ValidationSummaryProps {
  validation: ValidationResult;
  changePlan?: ChangePlan | null;
  onDownloadReport?: () => void;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  validation,
  changePlan,
}) => {
  const [showErrors, setShowErrors] = React.useState(true);
  const [showWarnings, setShowWarnings] = React.useState(false);

  const handleDownloadReport = () => {
    const allIssues = [...validation.errors, ...validation.warnings];
    const csvContent = generateErrorReport(allIssues);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    downloadAsFile(csvContent, `guia-estudos-validacao-${timestamp}.csv`);
  };

  const groupedErrors = React.useMemo(() => {
    const grouped = new Map<string, ValidationIssue[]>();
    validation.errors.forEach(error => {
      const key = error.code;
      const existing = grouped.get(key) || [];
      existing.push(error);
      grouped.set(key, existing);
    });
    return grouped;
  }, [validation.errors]);

  const groupedWarnings = React.useMemo(() => {
    const grouped = new Map<string, ValidationIssue[]>();
    validation.warnings.forEach(warning => {
      const key = warning.code;
      const existing = grouped.get(key) || [];
      existing.push(warning);
      grouped.set(key, existing);
    });
    return grouped;
  }, [validation.warnings]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-foreground">
            {validation.totalRows.toLocaleString('pt-BR')}
          </div>
          <div className="text-xs text-muted-foreground">Total de linhas</div>
        </div>

        <div className={cn(
          'rounded-lg border p-4',
          validation.isValid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-card'
        )}>
          <div className="flex items-center gap-2">
            {validation.isValid && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {validation.validRows.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">Linhas válidas</div>
        </div>

        <div className={cn(
          'rounded-lg border p-4',
          validation.errors.length > 0 ? 'bg-destructive/10 border-destructive/30' : 'bg-card'
        )}>
          <div className="flex items-center gap-2">
            {validation.errors.length > 0 && <AlertCircle className="h-5 w-5 text-destructive" />}
            <span className={cn(
              'text-2xl font-bold',
              validation.errors.length > 0 ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {validation.errors.length.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">Erros</div>
        </div>

        <div className={cn(
          'rounded-lg border p-4',
          validation.warnings.length > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-card'
        )}>
          <div className="flex items-center gap-2">
            {validation.warnings.length > 0 && <AlertTriangle className="h-5 w-5 text-amber-500" />}
            <span className={cn(
              'text-2xl font-bold',
              validation.warnings.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
            )}>
              {validation.warnings.length.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">Avisos</div>
        </div>
      </div>

      {/* Change Plan */}
      {changePlan && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <h4 className="text-sm font-medium mb-3">Plano de Mudanças</h4>
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              +{changePlan.inserts.toLocaleString('pt-BR')} inserções
            </Badge>
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
              ~{changePlan.updates.toLocaleString('pt-BR')} atualizações
            </Badge>
            {changePlan.deletes > 0 && (
              <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/30">
                -{changePlan.deletes.toLocaleString('pt-BR')} remoções
              </Badge>
            )}
            {changePlan.ignored > 0 && (
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                {changePlan.ignored.toLocaleString('pt-BR')} ignorados
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Errors Section */}
      {validation.errors.length > 0 && (
        <Collapsible open={showErrors} onOpenChange={setShowErrors}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-left">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="font-medium text-destructive">
                  {validation.errors.length} erro{validation.errors.length !== 1 && 's'} encontrado{validation.errors.length !== 1 && 's'}
                </span>
              </div>
              {showErrors ? (
                <ChevronUp className="h-4 w-4 text-destructive" />
              ) : (
                <ChevronDown className="h-4 w-4 text-destructive" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="h-[200px] rounded-b-lg border border-t-0 border-destructive/30 bg-card">
              <div className="p-4 space-y-2">
                {Array.from(groupedErrors.entries()).map(([code, issues]) => (
                  <div key={code} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="destructive" className="text-xs">
                        {code}
                      </Badge>
                      <span className="text-muted-foreground">
                        {issues.length} ocorrência{issues.length !== 1 && 's'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground pl-2 space-y-0.5">
                      {issues.slice(0, 5).map((issue, i) => (
                        <div key={i}>
                          Linha {issue.rowNumber}: {issue.message}
                        </div>
                      ))}
                      {issues.length > 5 && (
                        <div className="text-muted-foreground/70">
                          ... e mais {issues.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Warnings Section */}
      {validation.warnings.length > 0 && (
        <Collapsible open={showWarnings} onOpenChange={setShowWarnings}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-left">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {validation.warnings.length} aviso{validation.warnings.length !== 1 && 's'}
                </span>
              </div>
              {showWarnings ? (
                <ChevronUp className="h-4 w-4 text-amber-600" />
              ) : (
                <ChevronDown className="h-4 w-4 text-amber-600" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="h-[150px] rounded-b-lg border border-t-0 border-amber-500/30 bg-card">
              <div className="p-4 space-y-2">
                {Array.from(groupedWarnings.entries()).map(([code, issues]) => (
                  <div key={code} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600">
                        {code}
                      </Badge>
                      <span className="text-muted-foreground">
                        {issues.length} ocorrência{issues.length !== 1 && 's'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Download Report Button */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadReport}
          className="w-full sm:w-auto"
        >
          <Download className="h-4 w-4 mr-2" />
          Baixar relatório de erros
        </Button>
      )}
    </div>
  );
};
