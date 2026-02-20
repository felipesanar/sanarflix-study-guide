/**
 * StudyGuideImportWizard Component
 * Main wizard component for importing study guide data
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Upload, Settings2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import { FileDropzone } from './components/FileDropzone';
import { SheetMappingCard } from './components/SheetMappingCard';
import { ImportConfigPanel } from './components/ImportConfigPanel';
import { ValidationSummary } from './components/ValidationSummary';
import { ImportProgressComponent } from './components/ImportProgress';
import { ImportResult } from './components/ImportResult';
import { parseCSV, parseXLSX, validateAndNormalize } from './utils/parseFile';
import type {
  ImportStep,
  ImportStatus,
  FileType,
  IES,
  SheetInfo,
  SheetMapping,
  ImportConfig,
  ValidationResult,
  ChangePlan,
  ImportProgress,
  ImportResponse,
  ImportResultRow,
  NormalizedRow,
  WizardState,
  DEFAULT_CONFIG,
} from './types';

const LOG_PREFIX = '[AdminStudyGuideImport]';

const STEP_CONFIG: Record<ImportStep, { title: string; description: string }> = {
  upload: {
    title: 'Selecionar Arquivo',
    description: 'Faça upload do arquivo CSV ou XLSX com os dados do Guia de Estudos',
  },
  configure: {
    title: 'Configurar Importação',
    description: 'Mapeie as abas para as IES e configure o modo de importação',
  },
  validate: {
    title: 'Validação',
    description: 'Revise os dados e corrija erros antes de importar',
  },
  import: {
    title: 'Importando',
    description: 'Aguarde enquanto os dados são processados',
  },
  result: {
    title: 'Resultado',
    description: 'Resumo da importação',
  },
};

const STEPS: ImportStep[] = ['upload', 'configure', 'validate', 'import', 'result'];

export const StudyGuideImportWizard: React.FC = () => {
  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<FileType | null>(null);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [rawData, setRawData] = useState<Map<string, Record<string, string>[]>>(new Map());
  const [sheetMappings, setSheetMappings] = useState<SheetMapping[]>([]);
  const [config, setConfig] = useState<ImportConfig>({
    mode: 'MERGE',
    scope: 'ies_semestre',
    emptyBehavior: 'ignore',
    strictMode: false,
    dryRun: false,
    duplicateStrategy: 'keep_first',
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [changePlan, setChangePlan] = useState<ChangePlan | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iesList, setIesList] = useState<IES[]>([]);

  // Load IES list on mount
  useEffect(() => {
    const loadIesList = async () => {
      console.log(LOG_PREFIX, 'Loading IES list...');
      const { data, error } = await supabase
        .from('ies')
        .select('id, nome')
        .order('nome');

      if (error) {
        console.error(LOG_PREFIX, 'Error loading IES:', error);
        toast.error('Erro ao carregar lista de IES');
        return;
      }

      setIesList(data || []);
      console.log(LOG_PREFIX, `Loaded ${data?.length || 0} IES`);
    };

    loadIesList();
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File, type: FileType) => {
    console.log(LOG_PREFIX, `File selected: ${selectedFile.name} (${type})`);
    setFile(selectedFile);
    setFileType(type);
    setError(null);
    setStatus('parsing');

    try {
      if (type === 'csv') {
        const { rows, sheetInfo } = await parseCSV(selectedFile);
        setSheets([sheetInfo]);
        setRawData(new Map([[sheetInfo.name, rows]]));
        setSheetMappings([]);
      } else {
        // Pass IES list to enable fuzzy name matching
        const { sheets: parsedSheets } = await parseXLSX(selectedFile, iesList);
        const newSheets = parsedSheets.map(s => s.sheetInfo);
        setSheets(newSheets);
        
        const newRawData = new Map<string, Record<string, string>[]>();
        parsedSheets.forEach(s => newRawData.set(s.name, s.rows));
        setRawData(newRawData);

        // Auto-map sheets to IES based on parser results
        const autoMappings: SheetMapping[] = [];
        for (const sheet of newSheets) {
          if (sheet.mappedIesId) {
            // Find IES name from list or use the one from parser
            const ies = iesList.find(i => i.id === sheet.mappedIesId);
            const iesNome = ies?.nome || sheet.mappedIesName || 'IES';
            autoMappings.push({
              sheetName: sheet.name,
              iesId: sheet.mappedIesId,
              iesNome,
            });
          }
        }
        setSheetMappings(autoMappings);
        
        // Log auto-matching results
        const autoMatchedCount = autoMappings.length;
        console.log(LOG_PREFIX, `Auto-matched ${autoMatchedCount}/${newSheets.length} sheets to IES`);
      }

      setStatus('idle');
      toast.success(`Arquivo processado: ${selectedFile.name}`);
    } catch (err) {
      console.error(LOG_PREFIX, 'Parse error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo');
      setStatus('error');
    }
  }, [iesList]);

  // Handle sheet mapping change
  const handleMappingChange = useCallback((sheetName: string, iesId: string, iesNome: string) => {
    setSheetMappings(prev => {
      const existing = prev.find(m => m.sheetName === sheetName);
      if (existing) {
        return prev.map(m => 
          m.sheetName === sheetName ? { ...m, iesId, iesNome } : m
        );
      }
      return [...prev, { sheetName, iesId, iesNome }];
    });
  }, []);

  // Check for duplicate IES mappings
  const duplicateIesIds = React.useMemo(() => {
    const counts = new Map<string, number>();
    sheetMappings.forEach(m => {
      counts.set(m.iesId, (counts.get(m.iesId) || 0) + 1);
    });
    return Array.from(counts.entries())
      .filter(([_, count]) => count > 1)
      .map(([id]) => id);
  }, [sheetMappings]);

  // Run validation
  const runValidation = useCallback(async () => {
    console.log(LOG_PREFIX, 'Running validation...');
    setStatus('validating');
    setError(null);

    try {
      const allNormalized: NormalizedRow[] = [];
      const allErrors: ValidationResult['errors'] = [];
      const allWarnings: ValidationResult['warnings'] = [];
      let totalRows = 0;

      if (fileType === 'csv') {
        // For CSV, use the selected IES
        const selectedIesId = sheetMappings[0]?.iesId;
        if (!selectedIesId) {
          throw new Error('Por favor, selecione uma IES para o arquivo CSV');
        }

        const sheetName = sheets[0]?.name || 'CSV';
        const rows = rawData.get(sheetName) || [];
        const result = validateAndNormalize(rows, selectedIesId, sheetName);
        
        allNormalized.push(...result.normalizedData);
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
        totalRows += result.totalRows;
      } else {
        // For XLSX, validate each sheet
        for (const sheet of sheets) {
          const mapping = sheetMappings.find(m => m.sheetName === sheet.name);
          if (!mapping?.iesId) {
            allErrors.push({
              rowNumber: 0,
              sheetName: sheet.name,
              field: 'ies',
              severity: 'error',
              code: 'UNMAPPED_SHEET',
              message: `Aba "${sheet.name}" não está mapeada para nenhuma IES`,
            });
            continue;
          }

          const rows = rawData.get(sheet.name) || [];
          const result = validateAndNormalize(rows, mapping.iesId, sheet.name);
          
          allNormalized.push(...result.normalizedData);
          allErrors.push(...result.errors);
          allWarnings.push(...result.warnings);
          totalRows += result.totalRows;
        }
      }

      const validationResult: ValidationResult = {
        isValid: allErrors.length === 0,
        totalRows,
        validRows: allNormalized.length,
        errors: allErrors,
        warnings: allWarnings,
        normalizedData: allNormalized,
      };

      setValidation(validationResult);

      // Calculate change plan
      // For now, assume all rows are inserts/updates (would need DB query for actual)
      setChangePlan({
        inserts: allNormalized.length,
        updates: 0,
        deletes: 0,
        ignored: 0,
      });

      setStatus(validationResult.isValid ? 'ready_to_import' : 'idle');
      console.log(LOG_PREFIX, 'Validation complete:', validationResult);
    } catch (err) {
      console.error(LOG_PREFIX, 'Validation error:', err);
      setError(err instanceof Error ? err.message : 'Erro na validação');
      setStatus('error');
    }
  }, [fileType, sheets, sheetMappings, rawData]);

  // Run import
  const runImport = useCallback(async () => {
    if (!validation?.normalizedData?.length) {
      toast.error('Nenhum dado válido para importar');
      return;
    }

    console.log(LOG_PREFIX, 'Starting import...');
    setStep('import');
    setStatus('importing');
    setError(null);

    const startTime = Date.now();

    // Apply duplicate strategy to filter rows
    let rowsToImport = [...validation.normalizedData];
    if (config.duplicateStrategy === 'keep_all') {
      // keep_all: no filtering — send every row including duplicates
    } else if (config.duplicateStrategy === 'keep_first') {
      // keep_first: remove duplicate rows (those flagged as duplicates)
      const duplicateRowNumbers = new Set(
        validation.warnings
          .filter(w => w.code === 'DUPLICATE_ROW')
          .map(w => w.rowNumber)
      );
      rowsToImport = rowsToImport.filter(r => !duplicateRowNumbers.has(r.rowNumber));
    } else {
      const duplicateRowNumbers = new Set(
        validation.warnings
          .filter(w => w.code === 'DUPLICATE_ROW')
          .map(w => w.rowNumber)
      );

      if (duplicateRowNumbers.size > 0) {
        if (config.duplicateStrategy === 'remove_all') {
          // Find all keys that have duplicates, then remove ALL rows with those keys
          const keyCounts = new Map<string, number[]>();
          rowsToImport.forEach((row) => {
            const key = `${row.id_ies}|${row.semestre}|${row.materia}|${row.tema}|${row.subtema}|${row.aula}`;
            const rows = keyCounts.get(key) || [];
            rows.push(row.rowNumber);
            keyCounts.set(key, rows);
          });
          const duplicateKeys = new Set<string>();
          keyCounts.forEach((rows, key) => {
            if (rows.length > 1) duplicateKeys.add(key);
          });
          rowsToImport = rowsToImport.filter((row) => {
            const key = `${row.id_ies}|${row.semestre}|${row.materia}|${row.tema}|${row.subtema}|${row.aula}`;
            return !duplicateKeys.has(key);
          });
        } else if (config.duplicateStrategy === 'keep_last') {
          // Keep only the last occurrence of each key
          const lastByKey = new Map<string, NormalizedRow>();
          rowsToImport.forEach((row) => {
            const key = `${row.id_ies}|${row.semestre}|${row.materia}|${row.tema}|${row.subtema}|${row.aula}`;
            lastByKey.set(key, row);
          });
          rowsToImport = Array.from(lastByKey.values());
        }
      }
    }

    console.log(LOG_PREFIX, `Rows after duplicate strategy (${config.duplicateStrategy}): ${rowsToImport.length}`);

    try {
      // Simulate progress stages
      const updateProgress = (stage: ImportProgress['stage'], stageProgress: number, message: string) => {
        const stages = ['parsing', 'normalizing', 'uploading', 'processing', 'verifying'] as const;
        const stageIndex = stages.indexOf(stage);
        const totalProgress = ((stageIndex + stageProgress / 100) / stages.length) * 100;
        setProgress({ stage, stageProgress, totalProgress, message });
      };

      updateProgress('uploading', 0, 'Enviando dados...');

      // Get auth token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }

      // Send rows in batches to avoid Edge Function timeout
      const BATCH_SIZE = 500;
      const totalBatches = Math.ceil(rowsToImport.length / BATCH_SIZE);
      const aggregatedCounts = { inserted: 0, updated: 0, deleted: 0, ignored: 0, errors: 0 };
      const aggregatedErrors: ImportResultRow[] = [];
      let lastRequestId = '';

      for (let i = 0; i < totalBatches; i++) {
        const batchRows = rowsToImport.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const batchProgress = Math.round(((i) / totalBatches) * 100);
        updateProgress('uploading', batchProgress, `Enviando lote ${i + 1}/${totalBatches} (${batchRows.length} linhas)...`);

        const { data, error: fnError } = await supabase.functions.invoke('admin-upload-study-guide', {
          body: {
            config,
            institutionMappings: sheetMappings,
            rows: batchRows,
          },
        });

        if (fnError) {
          throw new Error(fnError.message || `Erro no lote ${i + 1}/${totalBatches}`);
        }

        if (data.counts) {
          aggregatedCounts.inserted += data.counts.inserted || 0;
          aggregatedCounts.updated += data.counts.updated || 0;
          aggregatedCounts.deleted += data.counts.deleted || 0;
          aggregatedCounts.ignored += data.counts.ignored || 0;
          aggregatedCounts.errors += data.counts.errors || 0;
        }
        if (data.errors?.length) {
          aggregatedErrors.push(...data.errors);
        }
        lastRequestId = data.requestId || lastRequestId;
      }

      updateProgress('verifying', 100, 'Importação concluída!');

      const importResult: ImportResponse = {
        success: aggregatedCounts.errors === 0,
        requestId: lastRequestId || crypto.randomUUID(),
        counts: aggregatedCounts,
        errors: aggregatedErrors,
        durationMs: Date.now() - startTime,
      };

      setResult(importResult);
      setStatus('success');
      setStep('result');

      if (importResult.success) {
        toast.success('Importação concluída com sucesso!');
      } else {
        toast.warning('Importação concluída com erros');
      }

    } catch (err) {
      console.error(LOG_PREFIX, 'Import error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido na importação';
      setError(errorMessage);
      setStatus('error');
      
      // Still show result screen with error
      setResult({
        success: false,
        requestId: crypto.randomUUID(),
        counts: {
          inserted: 0,
          updated: 0,
          deleted: 0,
          ignored: 0,
          errors: validation.normalizedData.length,
        },
        errors: [{
          rowNumber: 0,
          status: 'error',
          error: errorMessage,
        }],
        durationMs: Date.now() - startTime,
      });
      setStep('result');
      toast.error('Erro na importação');
    }
  }, [config, sheetMappings, validation]);

  // Reset wizard
  const handleReset = useCallback(() => {
    setStep('upload');
    setStatus('idle');
    setFile(null);
    setFileType(null);
    setSheets([]);
    setRawData(new Map());
    setSheetMappings([]);
    setConfig({
      mode: 'MERGE',
      scope: 'ies_semestre',
      emptyBehavior: 'ignore',
      strictMode: false,
      dryRun: false,
      duplicateStrategy: 'keep_first',
    });
    setValidation(null);
    setChangePlan(null);
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  // Navigation
  const canProceed = React.useMemo(() => {
    switch (step) {
      case 'upload':
        return file && sheets.length > 0 && status === 'idle';
      case 'configure':
        if (fileType === 'csv') {
          return sheetMappings.length > 0 && sheetMappings[0]?.iesId;
        }
        // For XLSX, all sheets must be mapped
        return sheets.every(s => sheetMappings.some(m => m.sheetName === s.name && m.iesId));
      case 'validate':
        return validation?.isValid && status === 'ready_to_import';
      default:
        return false;
    }
  }, [step, file, sheets, status, fileType, sheetMappings, validation]);

  const handleNext = useCallback(() => {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex < STEPS.length - 1) {
      const nextStep = STEPS[currentIndex + 1];
      
      // Run validation when moving to validate step
      if (nextStep === 'validate') {
        runValidation();
      }
      
      // Start import when moving to import step
      if (nextStep === 'import') {
        runImport();
        return;
      }
      
      setStep(nextStep);
    }
  }, [step, runValidation, runImport]);

  const handleBack = useCallback(() => {
    const currentIndex = STEPS.indexOf(step);
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1]);
    }
  }, [step]);

  const currentStepIndex = STEPS.indexOf(step);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Importar Guia de Estudos</CardTitle>
            <CardDescription>
              Upload de CSV ou XLSX com dados do guia de estudos
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <Separator />

      {/* Step Indicator */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {STEPS.filter(s => s !== 'import').map((s, index) => {
            const actualIndex = s === 'result' ? 3 : index;
            const isActive = step === s || (step === 'import' && s === 'result');
            const isComplete = currentStepIndex > STEPS.indexOf(s);
            const isPast = STEPS.indexOf(s) < currentStepIndex;

            return (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all',
                      isActive && 'bg-primary text-primary-foreground',
                      isComplete && 'bg-primary/20 text-primary',
                      !isActive && !isComplete && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : step === 'import' && s === 'result' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      actualIndex + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium hidden sm:block',
                      isActive && 'text-primary',
                      !isActive && 'text-muted-foreground'
                    )}
                  >
                    {STEP_CONFIG[s].title}
                  </span>
                </div>
                {index < 3 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1 mx-2',
                      isPast ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <Separator />

      <CardContent className="p-6">
        {/* Step Content */}
        <div className="space-y-6">
          {/* Step Title */}
          <div>
            <h3 className="text-lg font-semibold">{STEP_CONFIG[step].title}</h3>
            <p className="text-sm text-muted-foreground">{STEP_CONFIG[step].description}</p>
          </div>

          {/* Upload Step */}
          {step === 'upload' && (
            <FileDropzone
              onFileSelect={handleFileSelect}
              isProcessing={status === 'parsing'}
              selectedFile={file}
              error={error}
            />
          )}

          {/* Configure Step */}
          {step === 'configure' && (
            <div className="space-y-6">
              {/* Sheet/IES Mapping */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">
                  {fileType === 'csv' ? 'Selecionar Instituição' : 'Mapear Abas para IES'}
                </h4>
                
                {fileType === 'csv' ? (
                  <SheetMappingCard
                    sheet={sheets[0]}
                    iesList={iesList}
                    currentMapping={sheetMappings[0] || null}
                    duplicateIesIds={[]}
                    onMappingChange={handleMappingChange}
                  />
                ) : (
                  <div className="space-y-3">
                    {sheets.map(sheet => (
                      <SheetMappingCard
                        key={sheet.name}
                        sheet={sheet}
                        iesList={iesList}
                        currentMapping={sheetMappings.find(m => m.sheetName === sheet.name) || null}
                        duplicateIesIds={duplicateIesIds}
                        onMappingChange={handleMappingChange}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Import Config */}
              <ImportConfigPanel config={config} onChange={setConfig} />
            </div>
          )}

          {/* Validate Step */}
          {step === 'validate' && (
            <div className="space-y-6">
              {status === 'validating' ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Validando dados...</p>
                </div>
              ) : validation ? (
                <ValidationSummary
                  validation={validation}
                  changePlan={changePlan}
                  duplicateStrategy={config.duplicateStrategy}
                  onDuplicateStrategyChange={(strategy) => setConfig(prev => ({ ...prev, duplicateStrategy: strategy }))}
                />
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                  <Button variant="outline" onClick={() => setStep('configure')}>
                    Voltar para configuração
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          {/* Import Step */}
          {step === 'import' && (
            <ImportProgressComponent progress={progress} status={status} />
          )}

          {/* Result Step */}
          {step === 'result' && result && (
            <ImportResult
              result={result}
              onReset={handleReset}
            />
          )}
        </div>
      </CardContent>

      {/* Footer Navigation */}
      {step !== 'import' && step !== 'result' && (
        <>
          <Separator />
          <div className="flex items-center justify-between p-6">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 'upload'}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>

            <Button
              onClick={handleNext}
              disabled={!canProceed || status === 'validating'}
            >
              {step === 'validate' ? (
                <>
                  Confirmar Importação
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};
