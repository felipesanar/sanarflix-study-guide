/**
 * ImportProgress Component
 * Shows real-time import progress
 */

import * as React from 'react';
import { Loader2, FileUp, Database, CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ImportProgress as ImportProgressType, ImportStatus } from '../types';

interface ImportProgressProps {
  progress: ImportProgressType | null;
  status: ImportStatus;
}

const STAGE_LABELS: Record<ImportProgressType['stage'], string> = {
  parsing: 'Analisando arquivo...',
  normalizing: 'Normalizando dados...',
  uploading: 'Enviando para o servidor...',
  processing: 'Processando registros...',
  verifying: 'Verificando integridade...',
};

const STAGE_ICONS: Record<ImportProgressType['stage'], React.ReactNode> = {
  parsing: <FileUp className="h-5 w-5" />,
  normalizing: <Loader2 className="h-5 w-5 animate-spin" />,
  uploading: <FileUp className="h-5 w-5" />,
  processing: <Database className="h-5 w-5" />,
  verifying: <CheckCircle2 className="h-5 w-5" />,
};

export const ImportProgressComponent: React.FC<ImportProgressProps> = ({
  progress,
  status,
}) => {
  const stages: ImportProgressType['stage'][] = [
    'parsing',
    'normalizing',
    'uploading',
    'processing',
    'verifying',
  ];

  const currentStageIndex = progress ? stages.indexOf(progress.stage) : -1;

  return (
    <div className="space-y-6">
      {/* Main Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {status === 'importing' && progress
              ? progress.message
              : status === 'success'
              ? 'Importação concluída!'
              : status === 'error'
              ? 'Erro na importação'
              : 'Preparando...'}
          </span>
          <span className="text-muted-foreground">
            {progress ? `${Math.round(progress.totalProgress)}%` : '0%'}
          </span>
        </div>
        <Progress
          value={progress?.totalProgress ?? 0}
          className={cn(
            'h-3',
            status === 'success' && '[&>div]:bg-emerald-500',
            status === 'error' && '[&>div]:bg-destructive'
          )}
        />
      </div>

      {/* Stage Steps */}
      <div className="space-y-3">
        {stages.map((stage, index) => {
          const isActive = progress?.stage === stage;
          const isComplete = currentStageIndex > index || status === 'success';
          const isError = status === 'error' && currentStageIndex === index;

          return (
            <div
              key={stage}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-all',
                isActive && 'border-primary bg-primary/5',
                isComplete && 'border-emerald-500/50 bg-emerald-500/5',
                isError && 'border-destructive bg-destructive/5',
                !isActive && !isComplete && !isError && 'border-muted-foreground/20 opacity-50'
              )}
            >
              <div
                className={cn(
                  'rounded-lg p-2',
                  isActive && 'bg-primary/10 text-primary',
                  isComplete && 'bg-emerald-500/10 text-emerald-500',
                  isError && 'bg-destructive/10 text-destructive',
                  !isActive && !isComplete && !isError && 'bg-muted text-muted-foreground'
                )}
              >
                {isComplete && !isError ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isError ? (
                  <XCircle className="h-5 w-5" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  STAGE_ICONS[stage]
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-sm font-medium',
                    isActive && 'text-primary',
                    isComplete && 'text-emerald-600 dark:text-emerald-400',
                    isError && 'text-destructive'
                  )}
                >
                  {STAGE_LABELS[stage]}
                </div>
                {isActive && progress && (
                  <Progress
                    value={progress.stageProgress}
                    className="h-1.5 mt-2"
                  />
                )}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {isActive && progress && `${Math.round(progress.stageProgress)}%`}
                {isComplete && '✓'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Processing Animation */}
      {status === 'importing' && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Não feche esta página durante a importação</span>
        </div>
      )}
    </div>
  );
};
