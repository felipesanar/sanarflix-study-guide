/**
 * FileDropzone Component
 * Drag-and-drop + click file upload for CSV/XLSX
 */

import * as React from 'react';
import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { detectFileType } from '../utils/parseFile';
import type { FileType } from '../types';

interface FileDropzoneProps {
  onFileSelect: (file: File, type: FileType) => void;
  isProcessing?: boolean;
  selectedFile?: File | null;
  error?: string | null;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFileSelect,
  isProcessing = false,
  selectedFile,
  error,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setLocalError(null);
    
    const fileType = detectFileType(file);
    
    if (!fileType) {
      setLocalError('Formato de arquivo não suportado. Use .csv ou .xlsx');
      return;
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setLocalError('Arquivo muito grande. Tamanho máximo: 10MB');
      return;
    }
    
    onFileSelect(file, fileType);
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const displayError = error || localError;
  const fileType = selectedFile ? detectFileType(selectedFile) : null;

  return (
    <div className="space-y-4">
      <div
        onClick={!isProcessing ? handleClick : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={!isProcessing ? handleDrop : undefined}
        className={cn(
          'relative rounded-xl border-2 border-dashed p-8 transition-all duration-200',
          'flex flex-col items-center justify-center gap-4 text-center',
          'min-h-[200px] cursor-pointer',
          isDragOver && 'border-primary bg-primary/5 scale-[1.01]',
          selectedFile && !displayError && 'border-emerald-500 bg-emerald-500/5',
          displayError && 'border-destructive bg-destructive/5',
          !isDragOver && !selectedFile && !displayError && 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
          isProcessing && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleInputChange}
          className="hidden"
          disabled={isProcessing}
        />

        {selectedFile && !displayError ? (
          <>
            <div className="rounded-full bg-emerald-500/10 p-4">
              {fileType === 'xlsx' ? (
                <FileSpreadsheet className="h-8 w-8 text-emerald-500" />
              ) : (
                <FileText className="h-8 w-8 text-emerald-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">Arquivo selecionado</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB • {fileType?.toUpperCase()}
              </p>
            </div>
            {!isProcessing && (
              <Button variant="outline" size="sm" onClick={handleClick}>
                Trocar arquivo
              </Button>
            )}
          </>
        ) : displayError ? (
          <>
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <p className="font-medium text-destructive">Erro no arquivo</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                {displayError}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleClick}>
              Tentar outro arquivo
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-full bg-muted p-4">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                Arraste o arquivo aqui
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                ou clique para selecionar
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                <span>CSV</span>
              </div>
              <span className="text-muted-foreground/50">•</span>
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4" />
                <span>XLSX</span>
              </div>
              <span className="text-muted-foreground/50">•</span>
              <span>Máx 10MB</span>
            </div>
          </>
        )}

        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Processando...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
