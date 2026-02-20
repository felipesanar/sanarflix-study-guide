/**
 * ValidationSummary Component
 * Shows validation results with rich error cards and actionable guidance
 */

import * as React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Download, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { generateErrorReport, downloadAsFile } from '../utils/parseFile';
import { ErrorGroupCard } from './ErrorGroupCard';
import type { ValidationResult, ValidationIssue, ChangePlan, DuplicateStrategy } from '../types';

interface ValidationSummaryProps {
  validation: ValidationResult;
  changePlan?: ChangePlan | null;
  duplicateStrategy: DuplicateStrategy;
  onDuplicateStrategyChange: (strategy: DuplicateStrategy) => void;
  onNavigateBack?: () => void;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  validation,
  changePlan,
  duplicateStrategy,
  onDuplicateStrategyChange,
  onNavigateBack,
}) => {
  // Group errors by code
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

  // Group warnings by code
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

  // Check for duplicates
  const duplicateWarnings = React.useMemo(
    () => validation.warnings.filter(w => w.code === 'DUPLICATE_ROW'),
    [validation.warnings]
  );
  const hasDuplicates = duplicateWarnings.length > 0;
  const duplicateCount = duplicateWarnings.length;

  // Download full report
  const handleDownloadFullReport = () => {
    const allIssues = [...validation.errors, ...validation.warnings];
    const csvContent = generateErrorReport(allIssues);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    downloadAsFile(csvContent, `guia-estudos-validacao-${timestamp}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          value={validation.totalRows}
          label="Total de linhas"
        />
        <SummaryCard
          value={validation.validRows}
          label="Linhas válidas"
          variant={validation.isValid ? 'success' : 'default'}
          icon={validation.isValid ? CheckCircle2 : undefined}
        />
        <SummaryCard
          value={validation.errors.length}
          label="Erros"
          variant={validation.errors.length > 0 ? 'error' : 'default'}
          icon={validation.errors.length > 0 ? AlertCircle : undefined}
        />
        <SummaryCard
          value={validation.warnings.length}
          label="Avisos"
          variant={validation.warnings.length > 0 ? 'warning' : 'default'}
          icon={validation.warnings.length > 0 ? AlertTriangle : undefined}
        />
      </div>

      {/* Change Plan */}
      {changePlan && (
        <div className="rounded-xl border bg-muted/50 p-4">
          <h4 className="text-sm font-medium mb-3">Plano de Mudanças</h4>
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
              +{changePlan.inserts.toLocaleString('pt-BR')} inserções
            </Badge>
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
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
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-destructive">
              {groupedErrors.size} tipo{groupedErrors.size !== 1 && 's'} de erro
            </h3>
            <span className="text-sm text-muted-foreground">
              ({validation.errors.length} ocorrência{validation.errors.length !== 1 && 's'})
            </span>
          </div>
          
          <div className="space-y-3">
            {Array.from(groupedErrors.entries()).map(([code, issues]) => (
              <ErrorGroupCard
                key={code}
                code={code}
                issues={issues}
                onNavigateBack={onNavigateBack}
                defaultExpanded={groupedErrors.size === 1}
              />
            ))}
          </div>
        </section>
      )}

      {/* Warnings Section */}
      {validation.warnings.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h3 className="font-semibold text-amber-600 dark:text-amber-400">
              {groupedWarnings.size} tipo{groupedWarnings.size !== 1 && 's'} de aviso
            </h3>
            <span className="text-sm text-muted-foreground">
              ({validation.warnings.length} ocorrência{validation.warnings.length !== 1 && 's'})
            </span>
          </div>
          
          <div className="space-y-3">
            {Array.from(groupedWarnings.entries()).map(([code, issues]) => (
              <ErrorGroupCard
                key={code}
                code={code}
                issues={issues}
                onNavigateBack={onNavigateBack}
              />
            ))}
          </div>
        </section>
      )}

      {/* Duplicate Strategy Selector */}
      {hasDuplicates && (
        <section className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h4 className="font-semibold text-amber-600 dark:text-amber-400">
              O que fazer com as {duplicateCount} linha{duplicateCount !== 1 && 's'} duplicada{duplicateCount !== 1 && 's'}?
            </h4>
          </div>
          <RadioGroup
            value={duplicateStrategy}
            onValueChange={(val) => onDuplicateStrategyChange(val as DuplicateStrategy)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-3 rounded-lg border bg-card p-3">
              <RadioGroupItem value="keep_first" id="dup-keep-first" />
              <Label htmlFor="dup-keep-first" className="flex-1 cursor-pointer">
                <span className="font-medium">Manter a primeira ocorrência</span>
                <p className="text-xs text-muted-foreground mt-0.5">Ignora duplicatas subsequentes (recomendado)</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 rounded-lg border bg-card p-3">
              <RadioGroupItem value="keep_last" id="dup-keep-last" />
              <Label htmlFor="dup-keep-last" className="flex-1 cursor-pointer">
                <span className="font-medium">Manter a última ocorrência</span>
                <p className="text-xs text-muted-foreground mt-0.5">Substitui registros anteriores pela última versão</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 rounded-lg border bg-card p-3">
              <RadioGroupItem value="remove_all" id="dup-remove-all" />
              <Label htmlFor="dup-remove-all" className="flex-1 cursor-pointer">
                <span className="font-medium">Remover todas as duplicatas</span>
                <p className="text-xs text-muted-foreground mt-0.5">Exclui todas as linhas que possuem duplicatas</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 rounded-lg border bg-card p-3">
              <RadioGroupItem value="keep_all" id="dup-keep-all" />
              <Label htmlFor="dup-keep-all" className="flex-1 cursor-pointer">
                <span className="font-medium">Manter todas</span>
                <p className="text-xs text-muted-foreground mt-0.5">Importa todas as linhas sem nenhuma filtragem de duplicatas</p>
              </Label>
            </div>
          </RadioGroup>
        </section>
      )}

      {/* Success State */}
      {validation.isValid && validation.errors.length === 0 && (
        <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 p-6 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
          <h3 className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
            Validação concluída com sucesso!
          </h3>
          <p className="text-sm text-muted-foreground">
            Todas as {validation.validRows.toLocaleString('pt-BR')} linhas estão prontas para importação.
          </p>
        </div>
      )}

      {/* Download Full Report Button */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadFullReport}
          className="w-full sm:w-auto"
        >
          <Download className="h-4 w-4 mr-2" />
          Baixar relatório completo
        </Button>
      )}
    </div>
  );
};

// ============= Helper Components =============

interface SummaryCardProps {
  value: number;
  label: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  icon?: React.FC<{ className?: string }>;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  value,
  label,
  variant = 'default',
  icon: IconComponent,
}) => {
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-emerald-500/10 border-emerald-500/30',
    error: 'bg-destructive/10 border-destructive/30',
    warning: 'bg-amber-500/10 border-amber-500/30',
  };

  const textStyles = {
    default: 'text-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    error: 'text-destructive',
    warning: 'text-amber-600 dark:text-amber-400',
  };

  return (
    <div className={cn('rounded-xl border p-4', variantStyles[variant])}>
      <div className="flex items-center gap-2">
        {IconComponent && (
          <IconComponent className={cn('h-5 w-5', textStyles[variant])} />
        )}
        <span className={cn('text-2xl font-bold', textStyles[variant])}>
          {value.toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
};
