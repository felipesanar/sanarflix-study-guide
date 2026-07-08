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
import { DangerZone } from '@/experiences/admin/ui';
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
  NewSemestreInfo,
  WizardState,
  DEFAULT_CONFIG,
} from './types';
import { Logger } from '@/utils/logger';

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
    dryRun: false,
    duplicateStrategy: 'keep_first',
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [changePlan, setChangePlan] = useState<ChangePlan | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iesList, setIesList] = useState<IES[]>([]);
  const [approvedNewSemestres, setApprovedNewSemestres] = useState<Set<string>>(new Set());
  const [excludedSheets, setExcludedSheets] = useState<Set<string>>(new Set());
  // DangerZone de confirmação para REPLACE antes de disparar a importação (item 3 da auditoria).
  const [replaceDangerZoneOpen, setReplaceDangerZoneOpen] = useState(false);

  // Load IES list on mount
  useEffect(() => {
    const loadIesList = async () => {
      Logger.info(LOG_PREFIX, 'Loading IES list...');
      const { data, error } = await supabase
        .from('ies')
        .select('id, nome')
        .order('nome');

      if (error) {
        Logger.error(LOG_PREFIX, 'Error loading IES:', error);
        toast.error('Erro ao carregar lista de IES');
        return;
      }

      setIesList(data || []);
      Logger.info(LOG_PREFIX, `Loaded ${data?.length || 0} IES`);
    };

    loadIesList();
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File, type: FileType) => {
    Logger.info(LOG_PREFIX, `File selected: ${selectedFile.name} (${type})`);
    setFile(selectedFile);
    setFileType(type);
    setError(null);
    setStatus('parsing');

    // Reseta estado herdado do arquivo anterior (item 5 da auditoria): sem isso, trocar de
    // arquivo mantém abas excluídas, semestres já aprovados e validação/changePlan antigos.
    setExcludedSheets(new Set());
    setApprovedNewSemestres(new Set());
    setValidation(null);
    setChangePlan(null);

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
        // Item 2 da auditoria: mappedIesId vem cru de rows[0]?.id_ies (parseFile.ts), sem garantia
        // de que existe na tabela `ies`. Se aceitarmos qualquer UUID aqui, o botão "Continuar"
        // habilita com uma IES inexistente e a importação só estoura (erro de FK) no meio dos
        // lotes já no servidor. Por isso só auto-mapeamos quando o id bate com o iesList carregado;
        // caso contrário a aba fica sem mapeamento e o admin precisa escolher manualmente.
        const autoMappings: SheetMapping[] = [];
        for (const sheet of newSheets) {
          if (sheet.mappedIesId && iesList.some(i => i.id === sheet.mappedIesId)) {
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
        Logger.info(LOG_PREFIX, `Auto-matched ${autoMatchedCount}/${newSheets.length} sheets to IES`);
      }

      setStatus('idle');
      // Visual feedback is already provided by the green file-selected state in the dropzone
    } catch (err) {
      Logger.error(LOG_PREFIX, 'Parse error:', err);
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

  // Toggle sheet inclusion for XLSX import
  const handleToggleSheet = useCallback((sheetName: string) => {
    setExcludedSheets(prev => {
      const next = new Set(prev);
      if (next.has(sheetName)) {
        next.delete(sheetName);
      } else {
        next.add(sheetName);
      }
      return next;
    });
  }, []);

  // Check for duplicate IES mappings (only among enabled sheets)
  const duplicateIesIds = React.useMemo(() => {
    const counts = new Map<string, number>();
    sheetMappings
      .filter(m => !excludedSheets.has(m.sheetName))
      .forEach(m => {
        counts.set(m.iesId, (counts.get(m.iesId) || 0) + 1);
      });
    return Array.from(counts.entries())
      .filter(([_, count]) => count > 1)
      .map(([id]) => id);
  }, [sheetMappings, excludedSheets]);

  // Run validation
  const runValidation = useCallback(async () => {
    Logger.info(LOG_PREFIX, 'Running validation...');
    setStatus('validating');
    setError(null);
    setApprovedNewSemestres(new Set());

    try {
      // Fetch existing semesters for each mapped IES
      const uniqueIesIds = [...new Set(sheetMappings.map(m => m.iesId).filter(Boolean))];
      const existingSemestresMap = new Map<string, string[]>();
      
      for (const iesId of uniqueIesIds) {
        const { data, error: rpcError } = await supabase
          .rpc('get_distinct_semestres', { p_ies_id: iesId });
        
        if (!rpcError && data) {
          existingSemestresMap.set(iesId, data.map((r: { semestre: string }) => r.semestre));
        } else {
          Logger.warn(LOG_PREFIX, `Failed to fetch semesters for IES ${iesId}:`, rpcError);
          existingSemestresMap.set(iesId, []);
        }
      }
      
      Logger.info(LOG_PREFIX, `Fetched existing semesters for ${uniqueIesIds.length} IES`);

      const allNormalized: NormalizedRow[] = [];
      const allErrors: ValidationResult['errors'] = [];
      const allWarnings: ValidationResult['warnings'] = [];
      const allNewSemestres: NewSemestreInfo[] = [];
      let totalRows = 0;

      if (fileType === 'csv') {
        // For CSV, use the selected IES
        const selectedIesId = sheetMappings[0]?.iesId;
        if (!selectedIesId) {
          throw new Error('Por favor, selecione uma IES para o arquivo CSV');
        }

        const sheetName = sheets[0]?.name || 'CSV';
        const rows = rawData.get(sheetName) || [];
        const existingSem = existingSemestresMap.get(selectedIesId) || [];
        const result = validateAndNormalize(rows, selectedIesId, sheetName, existingSem);
        
        allNormalized.push(...result.normalizedData);
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
        totalRows += result.totalRows;
        
        // Enrich new semesters with IES name
        if (result.newSemestres?.length) {
          const iesNome = iesList.find(i => i.id === selectedIesId)?.nome || 'IES';
          allNewSemestres.push(...result.newSemestres.map(s => ({ ...s, iesNome })));
        }
      } else {
        // For XLSX, validate each enabled sheet (skip excluded)
        const enabledSheets = sheets.filter(s => !excludedSheets.has(s.name));
        for (const sheet of enabledSheets) {
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
          const existingSem = existingSemestresMap.get(mapping.iesId) || [];
          const result = validateAndNormalize(rows, mapping.iesId, sheet.name, existingSem);
          
          allNormalized.push(...result.normalizedData);
          allErrors.push(...result.errors);
          allWarnings.push(...result.warnings);
          totalRows += result.totalRows;
          
          if (result.newSemestres?.length) {
            const iesNome = mapping.iesNome || iesList.find(i => i.id === mapping.iesId)?.nome || 'IES';
            allNewSemestres.push(...result.newSemestres.map(s => ({ ...s, iesNome })));
          }
        }
      }

      // Deduplicate new semesters
      const uniqueNewSemestres: NewSemestreInfo[] = [];
      const seenKeys = new Set<string>();
      for (const ns of allNewSemestres) {
        const key = `${ns.iesId}|${ns.semestre}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueNewSemestres.push(ns);
        }
      }

      const validationResult: ValidationResult = {
        isValid: allErrors.length === 0,
        totalRows,
        validRows: allNormalized.length,
        errors: allErrors,
        warnings: allWarnings,
        normalizedData: allNormalized,
        newSemestres: uniqueNewSemestres,
      };

      setValidation(validationResult);

      // Calculate change plan — for MERGE/REPLACE, call preview_changes to compare with DB
      if ((config.mode === 'MERGE' || config.mode === 'REPLACE') && validationResult.isValid && allNormalized.length > 0) {
        Logger.info(LOG_PREFIX, 'Calling preview_changes to compare with database...');
        try {
          const { data: previewData, error: previewError } = await supabase.functions.invoke('admin-upload-study-guide', {
            body: {
              action: 'preview_changes',
              config,
              rows: allNormalized,
            },
          });

          if (previewError) {
            Logger.warn(LOG_PREFIX, 'preview_changes failed, falling back to static plan:', previewError);
            setChangePlan({
              inserts: allNormalized.length,
              updates: 0,
              deletes: 0,
              ignored: 0,
              unchanged: 0,
            });
          } else if (previewData?.changePlan) {
            Logger.info(LOG_PREFIX, 'preview_changes result:', previewData.changePlan);
            setChangePlan({
              inserts: previewData.changePlan.inserts || 0,
              updates: previewData.changePlan.updates || 0,
              deletes: previewData.changePlan.deletes || 0,
              ignored: 0,
              unchanged: previewData.changePlan.unchanged || 0,
            });
          }
        } catch (previewErr) {
          Logger.warn(LOG_PREFIX, 'preview_changes exception, falling back:', previewErr);
          setChangePlan({
            inserts: allNormalized.length,
            updates: 0,
            deletes: 0,
            ignored: 0,
            unchanged: 0,
          });
        }
      } else {
        // APPEND mode or validation failed — all rows are inserts
        setChangePlan({
          inserts: allNormalized.length,
          updates: 0,
          deletes: 0,
          ignored: 0,
          unchanged: 0,
        });
      }

      setStatus(validationResult.isValid ? 'ready_to_import' : 'idle');
      Logger.info(LOG_PREFIX, 'Validation complete:', validationResult);
    } catch (err) {
      Logger.error(LOG_PREFIX, 'Validation error:', err);
      setError(err instanceof Error ? err.message : 'Erro na validação');
      setStatus('error');
    }
  }, [fileType, sheets, sheetMappings, rawData, iesList, config, excludedSheets]);

  // Run import
  const runImport = useCallback(async () => {
    if (!validation?.normalizedData?.length) {
      toast.error('Nenhum dado válido para importar');
      return;
    }

    Logger.info(LOG_PREFIX, 'Starting import...');
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

    Logger.info(LOG_PREFIX, `Rows after duplicate strategy (${config.duplicateStrategy}): ${rowsToImport.length}`);

    try {
      // Simulate progress stages
      const updateProgress = (stage: ImportProgress['stage'], stageProgress: number, message: string) => {
        const stages = ['parsing', 'normalizing', 'uploading', 'processing', 'verifying'] as const;
        const stageIndex = stages.indexOf(stage);
        const totalProgress = ((stageIndex + stageProgress / 100) / stages.length) * 100;
        setProgress({ stage, stageProgress, totalProgress, message });
      };

      updateProgress('uploading', 0, 'Preparando importação...');

      // Get auth token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }

      const aggregatedCounts = { inserted: 0, updated: 0, deleted: 0, ignored: 0, errors: 0, unchanged: 0 };
      const aggregatedErrors: ImportResultRow[] = [];
      let lastRequestId = '';
      // Item 8 da auditoria: agrega expected/actual de TODOS os lotes (antes só sobrescrevia com
      // o último lote, escondendo divergências dos lotes anteriores). Mismatch de qualquer lote
      // marca o total inteiro como divergente.
      const verificationAgg = { expected: 0, actual: 0, anyMismatch: false, sawAny: false };

      if (config.mode === 'MERGE' || config.mode === 'REPLACE') {
        // ── Smart Import: server-side field-by-field comparison with batching ──
        //
        // Item 1 da auditoria: o servidor (handleSmartImport) apaga, dentro do escopo (IES [+
        // semestre]), todo registro cuja identidade não está nas linhas RECEBIDAS NAQUELA
        // CHAMADA. Se um lote cortar um escopo ao meio — ex.: metade das linhas de um semestre
        // no lote 1 e a outra metade no lote 2 — o lote 2 apaga o que o lote 1 acabou de inserir
        // (o servidor só vê as linhas do lote 2 como "o que deveria existir" naquele escopo).
        // Por isso agrupamos as linhas por escopo ANTES de fatiar em lotes, e nunca dividimos um
        // escopo entre lotes — um lote pode ficar com menos de SMART_BATCH_SIZE linhas para
        // respeitar isso, e um escopo maior que o limite vai inteiro numa única chamada (ver
        // packRowsIntoScopeBatches abaixo).
        const SMART_BATCH_SIZE = 5000;

        // Chave de escopo: para MERGE o servidor sempre usa ies_semestre (ignora config.scope);
        // para REPLACE usa o scope escolhido. Só agrupamos por IES inteira (ies_full) quando o
        // servidor também vai tratar o escopo como a IES inteira — senão duas chamadas para o
        // mesmo par IES+semestre mas com escopo "maior" que o necessário desperdiçariam trabalho
        // sem necessidade.
        const useIesFullScope = config.mode === 'REPLACE' && config.scope === 'ies_full';
        const scopeKeyOf = (row: NormalizedRow) =>
          useIesFullScope ? row.id_ies : `${row.id_ies}|${row.semestre}`;

        const scopeGroups = new Map<string, NormalizedRow[]>();
        for (const row of rowsToImport) {
          const key = scopeKeyOf(row);
          const list = scopeGroups.get(key);
          if (list) list.push(row); else scopeGroups.set(key, [row]);
        }

        const smartBatches: NormalizedRow[][] = [];
        if (useIesFullScope) {
          // REPLACE + escopo IES completa: cada grupo já é uma IES inteira (ver scopeKeyOf
          // acima). Aqui NÃO fazemos bin-packing entre grupos: se combinássemos duas IES
          // pequenas no mesmo lote, seria preciso decidir qual scope mandar na chamada, e um
          // rebaixamento por posição do lote (ver bug corrigido abaixo) apagaria apenas os
          // semestres presentes no arquivo daquela IES em vez da IES inteira — quebrando a
          // promessa do DangerZone. Em vez disso: 1 IES = 1 lote, sempre com scope 'ies_full'.
          // A garantia deixa de depender de índice e passa a ser estrutural.
          for (const groupRows of scopeGroups.values()) {
            smartBatches.push(groupRows);
          }
        } else {
          // MERGE (sempre ies_semestre) e REPLACE + escopo ies_semestre: bin-packing simples,
          // acumula grupos de escopo até o limite alvo; nunca quebra um grupo. Se um grupo
          // sozinho já excede o limite, ele vira um lote próprio (maior que o alvo) — isso é
          // intencional (ver comentário acima). Se a edge tiver algum limite hard de payload
          // (tamanho de body), esse é o único caso em que estouraríamos SMART_BATCH_SIZE de
          // propósito; hoje a função não impõe esse limite, mas documentamos aqui para quem for
          // investigar um erro de payload no futuro.
          let currentBatch: NormalizedRow[] = [];
          for (const groupRows of scopeGroups.values()) {
            if (groupRows.length > SMART_BATCH_SIZE) {
              if (currentBatch.length > 0) {
                smartBatches.push(currentBatch);
                currentBatch = [];
              }
              smartBatches.push(groupRows); // escopo único, enviado inteiro numa chamada só
              continue;
            }
            if (currentBatch.length > 0 && currentBatch.length + groupRows.length > SMART_BATCH_SIZE) {
              smartBatches.push(currentBatch);
              currentBatch = [];
            }
            currentBatch.push(...groupRows);
          }
          if (currentBatch.length > 0) smartBatches.push(currentBatch);
        }

        const totalBatchesSmart = smartBatches.length;

        Logger.info(LOG_PREFIX, `Sending smart_import: ${rowsToImport.length} rows in ${totalBatchesSmart} batch(es), agrupados por ${useIesFullScope ? 'IES completa' : 'IES+semestre'}`);

        for (let i = 0; i < totalBatchesSmart; i++) {
          const batchRows = smartBatches[i];
          const batchProgress = Math.round((i / totalBatchesSmart) * 100);
          const batchLabel = totalBatchesSmart > 1
            ? `Lote ${i + 1}/${totalBatchesSmart} (${batchRows.length} linhas)...`
            : `Enviando ${batchRows.length} linhas para comparação inteligente...`;
          updateProgress('uploading', batchProgress, batchLabel);

          if (batchRows.length > SMART_BATCH_SIZE) {
            Logger.warn(LOG_PREFIX, `Lote ${i + 1} excede o tamanho alvo (${batchRows.length} > ${SMART_BATCH_SIZE}) porque contém um único escopo que não pode ser dividido sem risco de apagamento indevido.`);
          }

          // Item 1 da auditoria (REPLACE + escopo IES completa): antes, apenas o primeiro lote
          // carregava scope='ies_full' e os demais eram rebaixados para 'ies_semestre' com base
          // no ÍNDICE do lote — mas o bin-packing por escopo podia colocar uma IES inteira em
          // um lote de índice > 0 (ex.: várias IES pequenas somando mais de SMART_BATCH_SIZE
          // linhas), fazendo essa IES receber um replace PARCIAL (só os semestres presentes no
          // arquivo), quando o DangerZone prometeu apagar a IES inteira. Agora não há
          // rebaixamento por índice: quando useIesFullScope, cada lote já é exatamente uma IES
          // completa (ver montagem de smartBatches acima), então TODOS os lotes usam
          // config.scope='ies_full' sem exceção — a garantia é estrutural (1 IES = 1 lote), não
          // posicional.
          const { data, error: fnError } = await supabase.functions.invoke('admin-upload-study-guide', {
            body: {
              action: 'smart_import',
              config,
              rows: batchRows,
            },
          });

          if (fnError) {
            Logger.error(LOG_PREFIX, `Smart import batch ${i + 1} failed:`, fnError);
            // Register error but continue with next batches
            aggregatedCounts.errors += batchRows.length;
            aggregatedErrors.push({
              rowNumber: batchRows[0]?.rowNumber || 0,
              status: 'error' as const,
              error: `Lote ${i + 1} falhou: ${fnError.message || 'Erro desconhecido'}`,
            });
            continue;
          }

          if (data.counts) {
            aggregatedCounts.inserted += data.counts.inserted || 0;
            aggregatedCounts.updated += data.counts.updated || 0;
            aggregatedCounts.deleted += data.counts.deleted || 0;
            aggregatedCounts.ignored += data.counts.ignored || 0;
            aggregatedCounts.errors += data.counts.errors || 0;
            aggregatedCounts.unchanged += data.counts.unchanged || 0;
          }
          if (data.verification) {
            verificationAgg.sawAny = true;
            verificationAgg.expected += data.verification.expected || 0;
            verificationAgg.actual += data.verification.actual || 0;
            if (!data.verification.match) verificationAgg.anyMismatch = true;
          }
          if (data.errors?.length) {
            aggregatedErrors.push(...data.errors);
          }
          lastRequestId = data.requestId || lastRequestId;
        }

        if (verificationAgg.sawAny && (verificationAgg.anyMismatch || verificationAgg.expected !== verificationAgg.actual)) {
          Logger.warn(LOG_PREFIX, `Verification mismatch: expected=${verificationAgg.expected}, actual=${verificationAgg.actual}`);
        }
      } else {
        // ── APPEND mode: simple insert_only batches ──
        const BATCH_SIZE = 500;
        const totalBatches = Math.ceil(rowsToImport.length / BATCH_SIZE);

        for (let i = 0; i < totalBatches; i++) {
          const batchRows = rowsToImport.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
          const batchProgress = Math.round((i / totalBatches) * 100);
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
      }

      updateProgress('verifying', 100, 'Importação concluída!');

      const importResult: ImportResponse = {
        success: aggregatedCounts.errors === 0,
        requestId: lastRequestId || crypto.randomUUID(),
        counts: aggregatedCounts,
        errors: aggregatedErrors,
        durationMs: Date.now() - startTime,
        // Item 8 da auditoria: verificação agregada de todos os lotes, exibida no ImportResult
        // quando houver divergência (antes só ia para Logger.warn, invisível para o admin).
        verification: verificationAgg.sawAny
          ? {
              expected: verificationAgg.expected,
              actual: verificationAgg.actual,
              match: !verificationAgg.anyMismatch && verificationAgg.expected === verificationAgg.actual,
            }
          : null,
      };

      setResult(importResult);
      setStatus('success');
      setStep('result');

      // Invalidate study guide localStorage cache so users see fresh data
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('perf_study_contents_')) {
            localStorage.removeItem(key);
          }
        });
        Logger.info(LOG_PREFIX, 'Study guide cache invalidated');
      } catch {}

      if (importResult.success) {
        toast.success('Importação concluída com sucesso!');
      } else {
        toast.warning('Importação concluída com erros');
      }

    } catch (err) {
      Logger.error(LOG_PREFIX, 'Import error:', err);
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
      dryRun: false,
      duplicateStrategy: 'keep_first',
    });
    setValidation(null);
    setChangePlan(null);
    setProgress(null);
    setResult(null);
    setError(null);
    setApprovedNewSemestres(new Set());
    setExcludedSheets(new Set());
    setReplaceDangerZoneOpen(false);
  }, []);

  // Navigation
  const canProceed = React.useMemo(() => {
    switch (step) {
      case 'upload':
        return file && sheets.length > 0 && status === 'idle';
      case 'configure': {
        // Item 2 da auditoria: além de existir um iesId no mapping, ele precisa corresponder a
        // uma IES real do iesList — senão a importação estoura FK no meio dos lotes no servidor.
        const isValidMapping = (m: SheetMapping | undefined) =>
          !!m?.iesId && iesList.some(i => i.id === m.iesId);

        if (fileType === 'csv') {
          return isValidMapping(sheetMappings[0]);
        }
        // For XLSX, all enabled sheets must be mapped to a valid IES, and at least 1 must be enabled
        const enabledSheets = sheets.filter(s => !excludedSheets.has(s.name));
        if (enabledSheets.length === 0) return false;
        return enabledSheets.every(s => isValidMapping(sheetMappings.find(m => m.sheetName === s.name)));
      }
      case 'validate': {
        if (!validation?.isValid || status !== 'ready_to_import') return false;
        // If there are new semesters, all must be approved
        const newSem = validation.newSemestres || [];
        if (newSem.length > 0) {
          return newSem.every(ns => approvedNewSemestres.has(`${ns.iesId}|${ns.semestre}`));
        }
        return true;
      }
      default:
        return false;
    }
  }, [step, file, sheets, status, fileType, sheetMappings, validation, approvedNewSemestres, excludedSheets, iesList]);

  // Resumo de impacto exibido na DangerZone de confirmação do modo REPLACE (item 3 da auditoria).
  const replaceImpactSummary = React.useMemo(() => {
    const deletes = changePlan?.deletes ?? 0;
    const inserts = changePlan?.inserts ?? 0;
    const updates = changePlan?.updates ?? 0;
    const scopeLabel = config.scope === 'ies_full'
      ? 'TODOS os conteúdos da(s) IES mapeada(s) (todos os semestres, não apenas os do arquivo)'
      : 'os conteúdos dos semestres presentes no arquivo, por IES';
    return (
      <div className="space-y-1.5">
        <p>O modo <strong>REPLACE</strong> vai apagar {scopeLabel} antes de inserir os novos dados.</p>
        <p>
          Estimativa: <strong className="text-destructive">{deletes.toLocaleString('pt-BR')}</strong> removido(s),{' '}
          <strong>{inserts.toLocaleString('pt-BR')}</strong> inserido(s) e{' '}
          <strong>{updates.toLocaleString('pt-BR')}</strong> atualizado(s).
        </p>
        <p className="text-xs text-muted-foreground">Esta ação é irreversível.</p>
      </div>
    );
  }, [changePlan, config.scope]);

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
        // Item 3 da auditoria: REPLACE apaga registros do escopo antes de inserir — é destrutivo
        // e irreversível, então exige confirmação extra via DangerZone antes de rodar runImport.
        // Para escopo ies_full (apaga a IES inteira) usamos nível "high" com palavra de confirmação.
        if (config.mode === 'REPLACE') {
          setReplaceDangerZoneOpen(true);
          return;
        }
        runImport();
        return;
      }

      setStep(nextStep);
    }
  }, [step, runValidation, runImport, config.mode]);

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
                        showToggle
                        enabled={!excludedSheets.has(sheet.name)}
                        onToggleEnabled={handleToggleSheet}
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
                  approvedNewSemestres={approvedNewSemestres}
                  onApproveNewSemestre={(key) => setApprovedNewSemestres(prev => new Set([...prev, key]))}
                  onRejectNewSemestre={(key) => setApprovedNewSemestres(prev => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                  })}
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

      {/* Confirmação obrigatória antes de rodar REPLACE (item 3 da auditoria) */}
      {config.mode === 'REPLACE' && (
        config.scope === 'ies_full' ? (
          <DangerZone
            open={replaceDangerZoneOpen}
            onOpenChange={setReplaceDangerZoneOpen}
            title="Confirmar REPLACE — IES completa"
            level="high"
            confirmWord="SUBSTITUIR TUDO"
            impact={replaceImpactSummary}
            actionLabel="Substituir e importar"
            onConfirm={runImport}
          />
        ) : (
          <DangerZone
            open={replaceDangerZoneOpen}
            onOpenChange={setReplaceDangerZoneOpen}
            title="Confirmar REPLACE"
            level="medium"
            impact={replaceImpactSummary}
            actionLabel="Substituir e importar"
            onConfirm={runImport}
          />
        )
      )}
    </Card>
  );
};
