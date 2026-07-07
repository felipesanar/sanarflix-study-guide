/** Fatia C2 — sub-aba Importar respostas (wizard existente reapresentado sobre os primitivos novos). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminSectionHeader, BulkStepper } from '@/experiences/admin/ui';
import { Logger } from '@/utils/logger';
import { ImportarSimuladoStep } from './ImportarSimuladoStep';
import { ImportarPlanilhaStep } from './ImportarPlanilhaStep';
import { ImportarDryRunStep } from './ImportarDryRunStep';
import { ImportarConcluidoStep } from './ImportarConcluidoStep';
import { ImportarHistoricoLotes } from './ImportarHistoricoLotes';
import {
  CHUNK_SIZE,
  detectEmailHeader,
  REASON_LABEL,
  type FinalReport,
  type ParsedRow,
  type PreviewResult,
  type PreviewSummary,
  type SimuladoOpt,
} from './importar-respostas-types';

const STEPS = ['1 Simulado', '2 Planilha', '3 Dry-run', '4 Concluído'];

/**
 * RE-APRESENTAÇÃO do wizard existente (`SimuladosImportRespostasTab.tsx`) sobre o vocabulário
 * novo (BulkStepper/StatCard/DangerZone/AdminTable). A LÓGICA (parse de planilha, dry-run via
 * edge `admin-import-simulado-responses`, chunking de 50 com cancelamento via
 * `cancelRequestedRef`, histórico via RPCs) foi portada quase literalmente — decisão
 * documentada: migrar para `useBulkRunner` exigiria separar "linhas totais" (para as stats do
 * dry-run) de "linhas válidas" (para a execução real) dentro de um único array `rows` que o
 * hook trata como fonte única para as duas fases, o que forçaria gambiarras maiores que manter
 * o mecanismo já testado. Optou-se por reaproveitar o estado/imperativo atual sob a UI nova.
 */
export default function ImportarRespostasTab() {
  const { toast } = useToast();

  const [simulados, setSimulados] = useState<SimuladoOpt[]>([]);
  const [loadingSimulados, setLoadingSimulados] = useState(false);
  const [simuladosError, setSimuladosError] = useState<string | null>(null);
  const [selectedSimulado, setSelectedSimulado] = useState('');
  const [conflictMode, setConflictMode] = useState<'skip' | 'replace'>('skip');
  const [sourceLabel, setSourceLabel] = useState('');
  const [defaultDate, setDefaultDate] = useState('');

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [questionColumnsCount, setQuestionColumnsCount] = useState(0);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);

  const [previewResults, setPreviewResults] = useState<PreviewResult[]>([]);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [chunkInfo, setChunkInfo] = useState<{ current: number; total: number; processed: number; totalRows: number } | null>(null);
  const [cancelledLast, setCancelledLast] = useState(false);
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);

  const cancelRequestedRef = useRef(false);

  const selectedSimuladoData = simulados.find((s) => s.id === selectedSimulado);

  const loadSimulados = useCallback(async () => {
    setLoadingSimulados(true);
    setSimuladosError(null);
    try {
      const { data, error } = await supabase.from('simulados_admin').select('id, nome, ies_ids').order('created_at', { ascending: false });
      if (error) throw error;

      const ids = (data ?? []).map((s) => s.id);
      const countsBySimulado: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: qsRows, error: qsError } = await supabase.rpc('get_simulados_questoes_count', { p_simulado_ids: ids });
        if (qsError) throw qsError;
        for (const row of (qsRows || []) as Array<{ simulado_id: string; total: number }>) {
          countsBySimulado[String(row.simulado_id)] = Number(row.total) || 0;
        }
      }

      setSimulados(
        (data ?? []).map((s) => ({
          id: s.id,
          nome: s.nome,
          total_questoes: countsBySimulado[String(s.id)] ?? 0,
          ies_count: Array.isArray(s.ies_ids) ? s.ies_ids.length : 0,
        })),
      );
    } catch (err) {
      const anyErr = err as { message?: string; details?: string; hint?: string; code?: string };
      const msg =
        err instanceof Error
          ? err.message
          : anyErr?.message
            ? `${anyErr.message}${anyErr.code ? ` (${anyErr.code})` : ''}${anyErr.details ? ` — ${anyErr.details}` : ''}`
            : (() => { try { return JSON.stringify(err); } catch { return String(err); } })();
      Logger.error('[ImportRespostas] loadSimulados error:', err);
      setSimuladosError(msg);
    } finally {
      setLoadingSimulados(false);
    }
  }, []);

  useEffect(() => {
    loadSimulados();
  }, [loadSimulados]);

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setFileSize(file.size);
      setPreviewResults([]);
      setPreviewSummary(null);
      setFinalReport(null);
      setParsedRows([]);
      setQuestionColumnsCount(0);

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
        toast({ title: 'Formato não suportado', description: 'Use .xlsx, .xls ou .csv', variant: 'destructive' });
        return;
      }

      try {
        let wb: XLSX.WorkBook;
        if (ext === 'csv') {
          const text = await file.text();
          wb = XLSX.read(text, { type: 'string' });
        } else {
          const buf = await file.arrayBuffer();
          wb = XLSX.read(buf, { type: 'array' });
        }

        const sheet = wb.Sheets[wb.SheetNames[0]];
        if (!sheet) {
          toast({ title: 'Planilha vazia', description: 'Nenhuma aba detectada', variant: 'destructive' });
          return;
        }
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: false });

        if (json.length === 0) {
          toast({ title: 'Planilha vazia', description: 'Nenhuma linha de dados', variant: 'destructive' });
          return;
        }

        const headers = Object.keys(json[0] ?? {});
        const emailKey = detectEmailHeader(headers, json[0]);
        if (!emailKey) {
          toast({
            title: 'Coluna de e-mail não encontrada',
            description: 'A planilha precisa ter uma coluna chamada "email" (ou similar) ou conter e-mails na primeira linha.',
            variant: 'destructive',
          });
          return;
        }

        const tempoKey = headers.find((h) => /tempo/i.test(h));
        const saidasKey = headers.find((h) => /saida|saída|aba/i.test(h));
        const dataKey = headers.find((h) => /data|finalizad/i.test(h));

        const reservedKeys = new Set([emailKey, tempoKey, saidasKey, dataKey].filter(Boolean) as string[]);
        const questionKeys = headers.filter((h) => !reservedKeys.has(h));

        const hasNumericCols = questionKeys.some((k) => /^\d+$/.test(String(k).trim()));
        if (!hasNumericCols) {
          toast({
            title: 'Sem colunas de questões',
            description: 'Esperava colunas com números (1, 2, 3, ...) representando questões.',
            variant: 'destructive',
          });
          return;
        }

        const rows: ParsedRow[] = json.map((row, idx) => {
          const answers: Record<string, string | null> = {};
          for (const k of questionKeys) {
            const num = String(k).replace(/[^\d]/g, '');
            if (!num) continue;
            const v = row[k];
            answers[num] = v == null || v === '' ? null : String(v).trim();
          }
          const tempoMin = tempoKey ? Number(row[tempoKey]) : NaN;
          const dataRaw = dataKey && row[dataKey] ? String(row[dataKey]).trim() : undefined;
          const dataIsValid = dataRaw && !Number.isNaN(new Date(dataRaw).getTime());
          return {
            rowIndex: idx + 2,
            email: String(row[emailKey] ?? '').trim().toLowerCase(),
            answers,
            tempo_segundos: Number.isFinite(tempoMin) ? Math.round(tempoMin * 60) : undefined,
            saidas_aba: saidasKey ? Number(row[saidasKey]) || 0 : undefined,
            finalizado_em: dataIsValid ? new Date(dataRaw!).toISOString() : undefined,
          };
        });

        setParsedRows(rows);
        setQuestionColumnsCount(questionKeys.filter((k) => /^\d+$/.test(String(k).trim())).length);
        toast({ title: 'Planilha carregada', description: `${rows.length} linha(s) detectada(s) — coluna "${emailKey}" usada como e-mail` });
      } catch (err) {
        toast({ title: 'Erro ao ler planilha', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
      }
    },
    [toast],
  );

  const downloadTemplate = () => {
    if (!selectedSimuladoData) return;
    const total = selectedSimuladoData.total_questoes;
    if (total === 0) {
      toast({ title: 'Simulado sem questões', description: 'Cadastre as questões antes de gerar o template.', variant: 'destructive' });
      return;
    }
    const headers = ['email', ...Array.from({ length: total }, (_, i) => String(i + 1)), 'tempo_minutos', 'saidas_aba', 'finalizado_em'];
    const sample: Record<string, string | number> = { email: 'aluno@exemplo.com' };
    for (let i = 1; i <= total; i++) sample[String(i)] = ['A', 'B', 'C', 'D'][i % 4];
    sample['tempo_minutos'] = 180;
    sample['saidas_aba'] = 0;
    sample['finalizado_em'] = new Date().toISOString();

    const ws = XLSX.utils.json_to_sheet([sample], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Respostas');

    const instrucoesData = [
      ['INSTRUÇÕES'],
      [''],
      ['1. Coluna "email": e-mail do aluno cadastrado na plataforma'],
      [`2. Colunas "1" a "${total}": resposta de cada questão (A, B, C, D ou em branco)`],
      ['3. Coluna "tempo_minutos" (opcional): tempo gasto em minutos'],
      ['4. Coluna "saidas_aba" (opcional): número de saídas de aba durante a prova'],
      ['5. Coluna "finalizado_em" (opcional): data ISO de finalização (ex: 2026-04-28T18:00:00Z)'],
      [''],
      ['REGRAS:'],
      ['- E-mail deve estar cadastrado e pertencer à IES vinculada ao simulado'],
      ['- E-mails duplicados na mesma planilha geram erro'],
      ['- Respostas em branco são gravadas como "não respondida"'],
      ['- Use o modo "Pular" para não sobrescrever alunos que já fizeram'],
      ['- Use o modo "Substituir" para refazer (versão anterior vai para histórico)'],
    ];
    const wsInst = XLSX.utils.aoa_to_sheet(instrucoesData);
    XLSX.utils.book_append_sheet(wb, wsInst, 'Instruções');

    XLSX.writeFile(wb, `template-${selectedSimuladoData.nome.replace(/[^\w]/g, '_')}.xlsx`);
  };

  const runPreview = async () => {
    if (!selectedSimulado || parsedRows.length === 0) return;
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-import-simulado-responses', {
        body: {
          simulado_id: selectedSimulado,
          conflict_mode: conflictMode,
          source_label: sourceLabel || `Importação ${new Date().toISOString()}`,
          dry_run: true,
          rows: parsedRows.map((r) => ({
            email: r.email,
            answers: r.answers,
            tempo_segundos: r.tempo_segundos,
            saidas_aba: r.saidas_aba,
            finalizado_em: r.finalizado_em,
          })),
        },
      });
      if (error) {
        let detail = error.message ?? 'Falha desconhecida';
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.text === 'function') {
            const body = await ctx.text();
            if (body) detail = body.length > 500 ? `${body.slice(0, 500)}…` : body;
          }
        } catch {
          /* ignore */
        }
        Logger.error('[import-preview] edge function error', error, detail);
        throw new Error(detail);
      }
      const d = data as { results: PreviewResult[]; summary: PreviewSummary };
      setPreviewResults(d.results);
      setPreviewSummary(d.summary);
      toast({ title: 'Pré-visualização gerada', description: `${d.summary.ok} prontos · ${d.summary.warning} avisos · ${d.summary.error} erros` });
    } catch (err) {
      toast({ title: 'Erro na pré-visualização', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setPreviewing(false);
    }
  };

  const cancelImport = () => {
    cancelRequestedRef.current = true;
    toast({ title: 'Cancelando…', description: 'O lote atual ainda será processado, mas nenhum novo lote será enviado.' });
  };

  const runImport = useCallback(async () => {
    if (!previewSummary || importing) return;

    setImporting(true);
    setProgress(0);
    setFinalReport(null);
    setCancelledLast(false);
    cancelRequestedRef.current = false;

    const validEmails = new Set(
      previewResults.filter((r) => r.status === 'preview_ok' || r.status === 'preview_warning').map((r) => r.email.trim().toLowerCase()),
    );
    const rowsToSend = parsedRows.filter((r) => validEmails.has(r.email.trim().toLowerCase()));

    const batchId = crypto.randomUUID();
    const allResults: PreviewResult[] = [];
    let imported = 0, skipped = 0, replaced = 0, failed = 0;

    const totalChunks = Math.ceil(rowsToSend.length / CHUNK_SIZE) || 1;
    setChunkInfo({ current: 0, total: totalChunks, processed: 0, totalRows: rowsToSend.length });

    let cancelled = false;
    try {
      for (let i = 0; i < rowsToSend.length; i += CHUNK_SIZE) {
        if (cancelRequestedRef.current) {
          cancelled = true;
          break;
        }
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        const chunk = rowsToSend.slice(i, i + CHUNK_SIZE);
        setChunkInfo({ current: chunkIndex, total: totalChunks, processed: i, totalRows: rowsToSend.length });

        const { data, error } = await supabase.functions.invoke('admin-import-simulado-responses', {
          body: {
            simulado_id: selectedSimulado,
            conflict_mode: conflictMode,
            source_label: sourceLabel || `Importação ${new Date().toISOString()}`,
            batch_id: batchId,
            default_finalizado_em: defaultDate || undefined,
            rows: chunk.map((r) => ({
              email: r.email,
              answers: r.answers,
              tempo_segundos: r.tempo_segundos,
              saidas_aba: r.saidas_aba,
              finalizado_em: r.finalizado_em,
            })),
          },
        });
        if (error) throw error;
        const d = data as { results: PreviewResult[]; summary: { imported: number; skipped: number; replaced: number; failed: number } };
        allResults.push(...d.results);
        imported += d.summary.imported;
        skipped += d.summary.skipped;
        replaced += d.summary.replaced;
        failed += d.summary.failed;
        setProgress(Math.round(((i + chunk.length) / rowsToSend.length) * 100));
      }

      setFinalReport({ batch_id: batchId, summary: { total: rowsToSend.length, imported, skipped, replaced, failed }, results: allResults });
      setCancelledLast(cancelled);
      toast({
        title: cancelled ? 'Importação interrompida' : 'Importação concluída',
        description: cancelled
          ? `Parcial — ${imported} importados, ${replaced} substituídos, ${skipped} pulados, ${failed} falhas`
          : `${imported} importados · ${replaced} substituídos · ${skipped} pulados · ${failed} falhas`,
      });
    } catch (err) {
      toast({ title: 'Erro na importação', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setImporting(false);
      setChunkInfo(null);
      cancelRequestedRef.current = false;
    }
  }, [previewSummary, importing, previewResults, parsedRows, selectedSimulado, conflictMode, sourceLabel, defaultDate, toast]);

  const startImport = useCallback(() => {
    void runImport();
  }, [runImport]);

  const downloadReport = () => {
    if (!finalReport) return;
    const rows = finalReport.results.map((r) => ({
      email: r.email,
      status: r.status,
      motivo: r.reason ? REASON_LABEL[r.reason] || r.reason : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `import-report-${finalReport.batch_id}.xlsx`);
  };

  const reset = () => {
    setParsedRows([]);
    setQuestionColumnsCount(0);
    setFileName('');
    setFileSize(0);
    setPreviewResults([]);
    setPreviewSummary(null);
    setFinalReport(null);
    setCancelledLast(false);
    setProgress(0);
    setChunkInfo(null);
  };

  const voltarParaPlanilha = () => {
    setPreviewResults([]);
    setPreviewSummary(null);
  };

  const currentStep = useMemo(() => (finalReport ? 4 : previewSummary ? 3 : parsedRows.length > 0 ? 2 : 1), [finalReport, previewSummary, parsedRows.length]);

  // Mapeamento das 4 stats do passo 3 a partir do summary da edge (ok/warning/error/already_finalized):
  // linhas = total de linhas da planilha; casados = linhas que casaram com um aluno cadastrado
  // (ok + warning); conflitos = alunos que já finalizaram (already_finalized); não encontrados =
  // linhas com erro de validação (predominantemente e-mail não cadastrado).
  const stats = previewSummary
    ? {
        linhas: previewSummary.total,
        casados: previewSummary.ok + previewSummary.warning,
        conflitos: previewSummary.already_finalized,
        naoEncontrados: previewSummary.error,
      }
    : null;

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Importar respostas"
        subtitle="Registre oficialmente as respostas de alunos para um simulado já cadastrado, a partir de uma planilha Excel."
      />

      <BulkStepper steps={STEPS} currentStep={currentStep} />

      {currentStep <= 2 && (
        <>
          <ImportarSimuladoStep
            simulados={simulados}
            loading={loadingSimulados}
            error={simuladosError}
            onRetry={loadSimulados}
            selectedSimulado={selectedSimulado}
            onSelectSimulado={setSelectedSimulado}
            sourceLabel={sourceLabel}
            onSourceLabelChange={setSourceLabel}
            defaultDate={defaultDate}
            onDefaultDateChange={setDefaultDate}
          />
          <ImportarPlanilhaStep
            fileName={fileName}
            fileSize={fileSize}
            linhas={parsedRows.length}
            colunasQuestao={questionColumnsCount}
            simuladoSelecionado={Boolean(selectedSimulado)}
            templateDisponivel={Boolean(selectedSimuladoData)}
            onDownloadTemplate={downloadTemplate}
            onFile={handleFile}
            onRemove={reset}
            onContinuar={runPreview}
            continuarLabel={previewing ? 'Pré-visualizando…' : `Pré-visualizar (${parsedRows.length} linha${parsedRows.length === 1 ? '' : 's'})`}
            continuarDisabled={previewing || parsedRows.length === 0}
          />
        </>
      )}

      {currentStep === 3 && previewSummary && stats && (
        <ImportarDryRunStep
          simuladoNome={selectedSimuladoData?.nome ?? ''}
          previewSummary={previewSummary}
          linhas={stats.linhas}
          casados={stats.casados}
          conflitos={stats.conflitos}
          naoEncontrados={stats.naoEncontrados}
          conflictMode={conflictMode}
          onConflictModeChange={setConflictMode}
          importing={importing}
          progress={progress}
          chunkInfo={chunkInfo}
          onStartImport={startImport}
          onCancelImport={cancelImport}
          onVoltar={voltarParaPlanilha}
        />
      )}

      {currentStep === 4 && finalReport && (
        <ImportarConcluidoStep finalReport={finalReport} cancelled={cancelledLast} onDownloadReport={downloadReport} onReset={reset} />
      )}

      <ImportarHistoricoLotes refreshKey={finalReport?.batch_id ?? null} />
    </div>
  );
}
