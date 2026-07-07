import { useCallback, useRef, useState } from 'react';
import { Download, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MonoValue } from '@/experiences/admin/ui';
import { cn } from '@/lib/utils';

export interface ImportarPlanilhaStepProps {
  fileName: string;
  fileSize: number;
  linhas: number;
  colunasQuestao: number;
  simuladoSelecionado: boolean;
  templateDisponivel: boolean;
  onDownloadTemplate: () => void;
  onFile: (file: File) => void;
  onRemove: () => void;
  onContinuar: () => void;
  continuarLabel: string;
  continuarDisabled: boolean;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

/** Passo 2 do wizard: dropzone de planilha + download de template + resumo de linhas/colunas detectadas. */
export function ImportarPlanilhaStep({
  fileName,
  fileSize,
  linhas,
  colunasQuestao,
  simuladoSelecionado,
  templateDisponivel,
  onDownloadTemplate,
  onFile,
  onRemove,
  onContinuar,
  continuarLabel,
  continuarDisabled,
}: ImportarPlanilhaStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (!simuladoSelecionado) return;
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [simuladoSelecionado, onFile],
  );

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (simuladoSelecionado) setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
        }}
        onDrop={onDrop}
        className={cn(
          'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          !simuladoSelecionado && 'pointer-events-none opacity-50',
          isDragOver ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50',
        )}
      >
        <FileSpreadsheet className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">{fileName || 'Arraste a planilha aqui ou clique para selecionar'}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {fileName ? (
            <MonoValue muted>
              {formatBytes(fileSize)} · {linhas} linhas · {colunasQuestao} colunas de questão detectadas
            </MonoValue>
          ) : (
            '.xlsx, .xls ou .csv'
          )}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button variant="outline" disabled={!templateDisponivel} onClick={onDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Baixar template
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!simuladoSelecionado}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {fileName ? 'Trocar planilha' : 'Carregar planilha'}
          </Button>
          {fileName && (
            <Button variant="ghost" size="sm" onClick={onRemove}>
              <X className="h-4 w-4 mr-1" /> Remover
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </div>

      {linhas > 0 && (
        <Button onClick={onContinuar} disabled={continuarDisabled} className="w-full md:w-auto">
          {continuarLabel}
        </Button>
      )}
    </div>
  );
}
