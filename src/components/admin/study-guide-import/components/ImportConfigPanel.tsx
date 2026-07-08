/**
 * ImportConfigPanel Component
 * Advanced import configuration options
 */

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { ImportConfig, ImportMode } from '../types';

interface ImportConfigPanelProps {
  config: ImportConfig;
  onChange: (config: ImportConfig) => void;
}

export const ImportConfigPanel: React.FC<ImportConfigPanelProps> = ({
  config,
  onChange,
}) => {
  const handleModeChange = (mode: ImportMode) => {
    onChange({ ...config, mode });
  };

  const handleScopeChange = (scope: 'ies_semestre' | 'ies_full') => {
    onChange({ ...config, scope });
  };

  return (
    <div className="space-y-4">
      {/* Import Mode */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Modo de Importação</Label>
        <RadioGroup
          value={config.mode}
          onValueChange={(value) => handleModeChange(value as ImportMode)}
          className="grid gap-3"
        >
          <label
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all',
              config.mode === 'MERGE' && 'border-primary bg-primary/5'
            )}
          >
            <RadioGroupItem value="MERGE" id="mode-merge" className="mt-0.5" />
            <div className="space-y-1">
              <span className="font-medium text-sm">MERGE (Upsert)</span>
              <p className="text-xs text-muted-foreground">
                Atualiza registros existentes e insere novos. Modo mais seguro e recomendado.
              </p>
            </div>
          </label>

          <label
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all',
              config.mode === 'APPEND' && 'border-primary bg-primary/5'
            )}
          >
            <RadioGroupItem value="APPEND" id="mode-append" className="mt-0.5" />
            <div className="space-y-1">
              <span className="font-medium text-sm">APPEND (Apenas inserir)</span>
              <p className="text-xs text-muted-foreground">
                Insere todas as linhas do arquivo sem checar duplicatas (não há índice único em conteúdos).
                Reimportar o mesmo arquivo duplica os registros — prefira MERGE para reimportações.
              </p>
            </div>
          </label>

          <label
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all',
              config.mode === 'REPLACE' && 'border-amber-500 bg-amber-500/5'
            )}
          >
            <RadioGroupItem value="REPLACE" id="mode-replace" className="mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">REPLACE (Substituir)</span>
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-600 rounded">
                  CUIDADO
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Remove todos os registros do escopo e insere novos. Ao confirmar a importação,
                será exigida uma confirmação extra antes de executar.
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* Warning for REPLACE mode */}
      {config.mode === 'REPLACE' && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-600 text-sm">
            O modo REPLACE irá <strong>apagar permanentemente</strong> todos os conteúdos do escopo selecionado antes de inserir os novos dados. Esta ação é irreversível.
          </AlertDescription>
        </Alert>
      )}

      {/* Replace Scope (only visible when REPLACE is selected) */}
      {config.mode === 'REPLACE' && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Escopo da Substituição</Label>
          <RadioGroup
            value={config.scope}
            onValueChange={(value) => handleScopeChange(value as 'ies_semestre' | 'ies_full')}
            className="grid gap-3"
          >
            <label
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all',
                config.scope === 'ies_semestre' && 'border-primary bg-primary/5'
              )}
            >
              <RadioGroupItem value="ies_semestre" id="scope-semestre" className="mt-0.5" />
              <div className="space-y-1">
                <span className="font-medium text-sm">Por IES + Semestre</span>
                <p className="text-xs text-muted-foreground">
                  Substitui apenas os semestres presentes no arquivo para cada IES.
                </p>
              </div>
            </label>

            <label
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all',
                config.scope === 'ies_full' && 'border-destructive bg-destructive/5'
              )}
            >
              <RadioGroupItem value="ies_full" id="scope-full" className="mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">IES Completa</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-destructive/20 text-destructive rounded">
                    PERIGOSO
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Apaga TODOS os conteúdos da IES antes de inserir. Use com extrema cautela.
                </p>
              </div>
            </label>
          </RadioGroup>
        </div>
      )}
    </div>
  );
};
