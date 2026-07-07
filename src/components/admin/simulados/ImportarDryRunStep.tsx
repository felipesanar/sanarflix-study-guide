import { useState } from 'react';
import { AlertCircle, CheckCircle2, RotateCcw, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { DangerZone, MonoValue, StatCard } from '@/experiences/admin/ui';
import { cn } from '@/lib/utils';
import type { PreviewSummary } from './importar-respostas-types';

export interface ImportarDryRunStepProps {
  simuladoNome: string;
  previewSummary: PreviewSummary;
  linhas: number;
  casados: number;
  conflitos: number;
  naoEncontrados: number;
  conflictMode: 'skip' | 'replace';
  onConflictModeChange: (mode: 'skip' | 'replace') => void;
  importing: boolean;
  progress: number;
  chunkInfo: { current: number; total: number; processed: number; totalRows: number } | null;
  onStartImport: () => void;
  onCancelImport: () => void;
  onVoltar: () => void;
}

/**
 * Passo 3 do wizard: 4 StatCards da pré-visualização (dry-run real via edge) + escolha
 * Pular×Substituir + confirmação armada (DangerZone high, `confirmWord="IMPORTAR"`).
 * Durante a execução (chunks de 50), mostra progresso + cancelamento — a lógica de
 * chunking/cancelamento é a mesma do wizard antigo (`cancelRequestedRef`), só a UI mudou.
 */
export function ImportarDryRunStep({
  simuladoNome,
  previewSummary,
  linhas,
  casados,
  conflitos,
  naoEncontrados,
  conflictMode,
  onConflictModeChange,
  importing,
  progress,
  chunkInfo,
  onStartImport,
  onCancelImport,
  onVoltar,
}: ImportarDryRunStepProps) {
  const [dangerOpen, setDangerOpen] = useState(false);

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Linhas" value={linhas} />
        <StatCard label="Casados" value={casados} accent="emerald" />
        <StatCard label="Conflitos" value={conflitos} accent="amber" />
        <StatCard label="Não encontrados" value={naoEncontrados} accent="red" />
      </div>

      {previewSummary.already_finalized > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{previewSummary.already_finalized} aluno(s) já finalizaram</AlertTitle>
          <AlertDescription>
            No modo &quot;{conflictMode === 'skip' ? 'Pular' : 'Substituir'}&quot; eles serão{' '}
            {conflictMode === 'skip' ? 'ignorados (nenhum dado tocado)' : 'substituídos, com versão antiga arquivada em histórico'}.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Conflito (aluno já finalizou)</Label>
        <RadioGroup
          value={conflictMode}
          onValueChange={(v) => onConflictModeChange(v as 'skip' | 'replace')}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          <label
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition-colors',
              conflictMode === 'skip' ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40',
            )}
          >
            <RadioGroupItem value="skip" className="mt-0.5" />
            <span>
              <span className="font-medium">Pular conflitos</span>
              <span className="block text-xs text-muted-foreground">Não toca nas respostas existentes (seguro).</span>
            </span>
          </label>
          <label
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition-colors',
              conflictMode === 'replace' ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/40',
            )}
          >
            <RadioGroupItem value="replace" className="mt-0.5" />
            <span>
              <span className="font-medium">Substituir</span>
              <span className="block text-xs text-muted-foreground">Arquiva no histórico e cria nova tentativa.</span>
            </span>
          </label>
        </RadioGroup>
      </div>

      {importing ? (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="font-mono text-sm tabular-nums text-muted-foreground">
            {chunkInfo ? `${chunkInfo.processed} / ${chunkInfo.totalRows} linhas · lote ${chunkInfo.current} de ${chunkInfo.total}` : `${progress}%`}
            {' · chunks de 50'}
          </p>
          <Button variant="outline" className="text-red-600 dark:text-red-400" onClick={onCancelImport}>
            <X className="h-4 w-4 mr-2" /> Cancelar processamento
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDangerOpen(true)} disabled={previewSummary.ok + previewSummary.warning === 0}>
            <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar importação
          </Button>
          <Button variant="outline" onClick={onVoltar}>
            <RotateCcw className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>
      )}

      <DangerZone
        open={dangerOpen}
        onOpenChange={setDangerOpen}
        level="high"
        confirmWord="IMPORTAR"
        title="Confirmar importação em lote"
        impact={
          <>
            Serão processados <MonoValue>{previewSummary.ok + previewSummary.warning}</MonoValue> aluno(s) do simulado{' '}
            <strong>&quot;{simuladoNome}&quot;</strong> em lotes de <MonoValue>50</MonoValue>, no modo{' '}
            <strong>{conflictMode === 'skip' ? 'Pular conflitos' : 'Substituir'}</strong>.
          </>
        }
        actionLabel="Confirmar importação"
        onConfirm={onStartImport}
      />
    </div>
  );
}
