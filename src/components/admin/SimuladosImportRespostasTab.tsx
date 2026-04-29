import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2,
  Loader2, ShieldAlert, Eye, FileCheck, RotateCcw, Info,
  Check, ChevronsUpDown, Search, X, FileX, History, Clock,
} from 'lucide-react';

interface SimuladoOpt {
  id: string;
  nome: string;
  total_questoes: number;
  ies_count: number;
}

interface ParsedRow {
  rowIndex: number;
  email: string;
  answers: Record<string, string | null>;
  tempo_segundos?: number;
  saidas_aba?: number;
  finalizado_em?: string;
}

interface PreviewResult {
  email: string;
  status: 'preview_ok' | 'preview_warning' | 'preview_error' | 'imported' | 'replaced' | 'skipped' | 'failed';
  reason?: string;
  details?: Record<string, unknown>;
}

interface PreviewSummary {
  total: number;
  ok: number;
  warning: number;
  error: number;
  already_finalized: number;
}

const REASON_LABEL: Record<string, string> = {
  invalid_email: 'E-mail inválido',
  duplicate_email_in_file: 'E-mail duplicado na planilha',
  user_not_found: 'Usuário não cadastrado',
  user_not_in_ies: 'Usuário não pertence à IES do simulado',
  answers_missing: 'Sem respostas',
  no_answers: 'Nenhuma resposta preenchida',
  invalid_question_numbers: 'Colunas de questão inválidas',
  partial_answers: 'Respostas parciais (algumas em branco)',
  already_finalized: 'Aluno já finalizou esse simulado',
  validation_failed: 'Falhou na validação',
  already_processed: 'Já processado neste lote',
};

const CHUNK_SIZE = 50;
const EMAIL_HEADER_REGEX = /^(e[\s\-_.]?-?\s?mail|email|e-mail)$/i;

// =====================================================================
// Detecta a coluna de e-mail de forma estrita (sem fallback silencioso).
// Retorna a chave do header OU null caso nenhuma coluna pareça ser e-mail.
// =====================================================================
function detectEmailHeader(headers: string[], firstRow: Record<string, unknown> | undefined): string | null {
  // 1. Match exato no nome do header
  const exact = headers.find((h) => EMAIL_HEADER_REGEX.test(h.trim()));
  if (exact) return exact;

  // 2. Sniff: o conteúdo da primeira linha tem cara de e-mail?
  if (firstRow) {
    for (const h of headers) {
      const v = firstRow[h];
      if (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) {
        return h;
      }
    }
  }
  return null;
}

export default function SimuladosImportRespostasTab() {
  const { toast } = useToast();
  const [simulados, setSimulados] = useState<SimuladoOpt[]>([]);
  const [loadingSimulados, setLoadingSimulados] = useState(false);
  const [simuladosError, setSimuladosError] = useState<string | null>(null);
  const [selectedSimulado, setSelectedSimulado] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [conflictMode, setConflictMode] = useState<'skip' | 'replace'>('skip');
  const [sourceLabel, setSourceLabel] = useState('');
  const [defaultDate, setDefaultDate] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [previewResults, setPreviewResults] = useState<PreviewResult[]>([]);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [chunkInfo, setChunkInfo] = useState<{ current: number; total: number; processed: number; totalRows: number } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [finalReport, setFinalReport] = useState<{
    batch_id: string;
    summary: { total: number; imported: number; skipped: number; replaced: number; failed: number };
    results: PreviewResult[];
  } | null>(null);
  const [filter, setFilter] = useState<'all' | 'ok' | 'warning' | 'error'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRequestedRef = useRef(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const selectedSimuladoData = simulados.find((s) => s.id === selectedSimulado);

  const filteredSimulados = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return simulados;
    return simulados.filter((s) => s.nome.toLowerCase().includes(q));
  }, [simulados, pickerQuery]);

  const loadSimulados = useCallback(async () => {
    setLoadingSimulados(true);
    setSimuladosError(null);
    try {
      const { data, error } = await supabase
        .from('simulados_admin')
        .select('id, nome, ies_ids, questoes_simulado(count)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      setSimulados(
        (data ?? []).map((s) => ({
          id: s.id,
          nome: s.nome,
          total_questoes: s.questoes_simulado?.[0]?.count ?? 0,
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
      console.error('[ImportRespostas] loadSimulados error:', err);
      setSimuladosError(msg);
      toast({ title: 'Erro ao carregar simulados', description: msg, variant: 'destructive' });
    } finally {
      setLoadingSimulados(false);
    }
  }, [toast]);

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

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
        toast({
          title: 'Formato não suportado',
          description: 'Use .xlsx, .xls ou .csv',
          variant: 'destructive',
        });
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
            description:
              'A planilha precisa ter uma coluna chamada "email" (ou similar) ou conter e-mails na primeira linha.',
            variant: 'destructive',
          });
          return;
        }

        const tempoKey = headers.find((h) => /tempo/i.test(h));
        const saidasKey = headers.find((h) => /saida|saída|aba/i.test(h));
        const dataKey = headers.find((h) => /data|finalizad/i.test(h));

        const reservedKeys = new Set([emailKey, tempoKey, saidasKey, dataKey].filter(Boolean) as string[]);
        const questionKeys = headers.filter((h) => !reservedKeys.has(h));

        // Garante que pelo menos UMA coluna de questão (numérica) foi detectada
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
          // Validação leve: se a data não casa com ISO, ignora silenciosamente (server fallback)
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
        toast({
          title: 'Planilha carregada',
          description: `${rows.length} linha(s) detectada(s) — coluna "${emailKey}" usada como e-mail`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({ title: 'Erro ao ler planilha', description: msg, variant: 'destructive' });
      }
    },
    [toast],
  );

  const downloadTemplate = () => {
    if (!selectedSimuladoData) return;
    const total = selectedSimuladoData.total_questoes;
    if (total === 0) {
      toast({
        title: 'Simulado sem questões',
        description: 'Cadastre as questões antes de gerar o template.',
        variant: 'destructive',
      });
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
        // Tenta extrair corpo de resposta do FunctionsHttpError pra mostrar a causa real
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
        console.error('[import-preview] edge function error', error, detail);
        throw new Error(detail);
      }
      const d = data as { results: PreviewResult[]; summary: PreviewSummary };
      setPreviewResults(d.results);
      setPreviewSummary(d.summary);
      toast({
        title: 'Pré-visualização gerada',
        description: `${d.summary.ok} prontos · ${d.summary.warning} avisos · ${d.summary.error} erros`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Erro na pré-visualização', description: msg, variant: 'destructive' });
    } finally {
      setPreviewing(false);
    }
  };

  const cancelImport = () => {
    cancelRequestedRef.current = true;
    toast({
      title: 'Cancelando…',
      description: 'O lote atual ainda será processado, mas nenhum novo lote será enviado.',
    });
  };

  const runImport = async () => {
    if (!previewSummary || importing) return;
    if (confirmText.trim().toUpperCase() !== 'IMPORTAR') {
      toast({
        title: 'Confirmação inválida',
        description: 'Digite IMPORTAR (case-insensitive) para confirmar',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    setProgress(0);
    setFinalReport(null);
    cancelRequestedRef.current = false;

    const validEmails = new Set(
      previewResults
        .filter((r) => r.status === 'preview_ok' || r.status === 'preview_warning')
        .map((r) => r.email.trim().toLowerCase()),
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
        const d = data as {
          results: PreviewResult[];
          summary: { imported: number; skipped: number; replaced: number; failed: number };
        };
        allResults.push(...d.results);
        imported += d.summary.imported;
        skipped += d.summary.skipped;
        replaced += d.summary.replaced;
        failed += d.summary.failed;
        setProgress(Math.round(((i + chunk.length) / rowsToSend.length) * 100));
      }

      setFinalReport({
        batch_id: batchId,
        summary: { total: rowsToSend.length, imported, skipped, replaced, failed },
        results: allResults,
      });
      toast({
        title: cancelled ? 'Importação interrompida' : 'Importação concluída',
        description: cancelled
          ? `Parcial — ${imported} importados, ${replaced} substituídos, ${skipped} pulados, ${failed} falhas`
          : `${imported} importados · ${replaced} substituídos · ${skipped} pulados · ${failed} falhas`,
        variant: cancelled ? 'default' : 'default',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Erro na importação', description: msg, variant: 'destructive' });
    } finally {
      setImporting(false);
      setChunkInfo(null);
      cancelRequestedRef.current = false;
    }
  };

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
    setFileName('');
    setFileSize(0);
    setPreviewResults([]);
    setPreviewSummary(null);
    setFinalReport(null);
    setConfirmText('');
    setProgress(0);
    setChunkInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredResults = previewResults.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'ok') return r.status === 'preview_ok';
    if (filter === 'warning') return r.status === 'preview_warning';
    if (filter === 'error') return r.status === 'preview_error';
    return true;
  });

  // ---- Drag & drop handlers ----
  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (!selectedSimulado) {
        toast({
          title: 'Selecione um simulado primeiro',
          variant: 'destructive',
        });
        return;
      }
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [selectedSimulado, toast, handleFile],
  );

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  };

  // ---- Wizard step calculation ----
  const currentStep = finalReport ? 4 : previewSummary ? 3 : parsedRows.length > 0 ? 2 : 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Importar respostas externas
          </CardTitle>
          <CardDescription>
            Registre oficialmente as respostas de alunos para um simulado já cadastrado, a partir de uma planilha
            Excel (.xlsx/.xls/.csv). Use para provas aplicadas em sala ou em sistema externo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Wizard steps */}
          <div className="flex items-center gap-2 text-xs">
            {[
              { n: 1, label: 'Configurar' },
              { n: 2, label: 'Carregar' },
              { n: 3, label: 'Validar' },
              { n: 4, label: 'Concluído' },
            ].map((s, idx, arr) => (
              <div key={s.n} className="flex items-center gap-2">
                <div
                  className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center font-semibold',
                    currentStep > s.n
                      ? 'bg-emerald-500 text-white'
                      : currentStep === s.n
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {currentStep > s.n ? <Check className="h-3 w-3" /> : s.n}
                </div>
                <span className={cn(currentStep === s.n ? 'font-semibold' : 'text-muted-foreground')}>
                  {s.label}
                </span>
                {idx < arr.length - 1 && <div className="w-8 h-px bg-border" />}
              </div>
            ))}
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Como funciona</AlertTitle>
            <AlertDescription>
              1. Escolha o simulado · 2. Baixe o template · 3. Preencha · 4. Faça upload ·
              5. Pré-visualize · 6. Confirme. Cada importação gera um lote rastreável; reenviar a mesma planilha
              não duplica.
            </AlertDescription>
          </Alert>

          {simuladosError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Falha ao carregar simulados</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-2">
                <span className="truncate">{simuladosError}</span>
                <Button size="sm" variant="outline" onClick={loadSimulados}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Tentar de novo
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Simulado de destino</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    disabled={loadingSimulados}
                    className="w-full justify-between font-normal"
                  >
                    {loadingSimulados ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                      </span>
                    ) : selectedSimuladoData ? (
                      <span className="truncate">{selectedSimuladoData.nome}</span>
                    ) : (
                      <span className="text-muted-foreground">Selecione um simulado</span>
                    )}
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar simulado…"
                      value={pickerQuery}
                      onValueChange={setPickerQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {simulados.length === 0
                          ? 'Nenhum simulado cadastrado.'
                          : 'Nenhum simulado encontrado.'}
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredSimulados.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={s.id}
                            onSelect={() => {
                              setSelectedSimulado(s.id);
                              setPickerOpen(false);
                              setPickerQuery('');
                              // Auto-suggest source label
                              if (!sourceLabel) {
                                setSourceLabel(`${s.nome} — ${new Date().toLocaleDateString('pt-BR')}`);
                              }
                            }}
                            className="flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Check
                                className={cn(
                                  'h-4 w-4 shrink-0',
                                  selectedSimulado === s.id ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              <span className="truncate">{s.nome}</span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Badge
                                variant={s.total_questoes === 0 ? 'destructive' : 'secondary'}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {s.total_questoes}q
                              </Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {s.ies_count} IES
                              </Badge>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedSimuladoData && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge
                    variant={selectedSimuladoData.total_questoes === 0 ? 'destructive' : 'secondary'}
                  >
                    {selectedSimuladoData.total_questoes} questões
                  </Badge>
                  <Badge variant="outline">{selectedSimuladoData.ies_count} IES vinculada(s)</Badge>
                  {selectedSimuladoData.total_questoes === 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" /> Cadastre questões antes
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>Rótulo da importação</Label>
              <Input
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
                placeholder="Ex: FUNEPE - Aplicação 24/03/2026"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Aparece no histórico de auditoria. Auto-preenchido ao escolher o simulado.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Data de finalização padrão (opcional)</Label>
              <Input
                type="datetime-local"
                value={defaultDate ? new Date(defaultDate).toISOString().slice(0, 16) : ''}
                onChange={(e) => setDefaultDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Aplicada a alunos sem data própria na planilha.
              </p>
            </div>

            <div>
              <Label>Conflito (aluno já finalizou)</Label>
              <RadioGroup value={conflictMode} onValueChange={(v) => setConflictMode(v as 'skip' | 'replace')}>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="skip" id="skip" className="mt-1" />
                  <Label htmlFor="skip" className="font-normal leading-tight">
                    <span className="font-medium">Pular</span>{' '}
                    <span className="text-muted-foreground text-xs">
                      — não toca nas respostas existentes (seguro)
                    </span>
                  </Label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="replace" id="replace" className="mt-1" />
                  <Label htmlFor="replace" className="font-normal leading-tight">
                    <span className="font-medium">Substituir</span>{' '}
                    <span className="text-muted-foreground text-xs">
                      — arquiva no histórico e cria nova tentativa
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* Drag & drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (selectedSimulado) setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
            }}
            onDrop={onDrop}
            className={cn(
              'rounded-lg border-2 border-dashed p-6 text-center transition-colors',
              !selectedSimulado && 'opacity-50 pointer-events-none',
              isDragOver ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50',
            )}
          >
            <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">
              {fileName ? fileName : 'Arraste a planilha aqui ou clique para selecionar'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {fileName
                ? `${formatBytes(fileSize)} · ${parsedRows.length} linha(s)`
                : '.xlsx, .xls ou .csv'}
            </p>
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              <Button variant="outline" disabled={!selectedSimuladoData} onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> Baixar template
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedSimulado}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {fileName ? 'Trocar planilha' : 'Carregar planilha'}
              </Button>
              {fileName && (
                <Button variant="ghost" onClick={reset} size="sm">
                  <X className="h-4 w-4 mr-1" /> Remover
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {parsedRows.length > 0 && !previewSummary && (
            <Button onClick={runPreview} disabled={previewing} className="w-full md:w-auto">
              {previewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Pré-visualizar ({parsedRows.length} linha{parsedRows.length === 1 ? '' : 's'})
            </Button>
          )}
        </CardContent>
      </Card>

      {previewSummary && !finalReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" /> Pré-visualização
            </CardTitle>
            <CardDescription>
              {selectedSimuladoData?.nome
                ? `Simulado: ${selectedSimuladoData.nome}`
                : 'Revise antes de confirmar a importação'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Total" value={previewSummary.total} />
              <Stat label="Prontos" value={previewSummary.ok} variant="success" />
              <Stat label="Com aviso" value={previewSummary.warning} variant="warning" />
              <Stat label="Com erro" value={previewSummary.error} variant="error" />
            </div>

            {previewSummary.already_finalized > 0 && (
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>{previewSummary.already_finalized} aluno(s) já finalizaram</AlertTitle>
                <AlertDescription>
                  No modo "{conflictMode === 'skip' ? 'Pular' : 'Substituir'}" eles serão{' '}
                  {conflictMode === 'skip'
                    ? 'ignorados (nenhum dado tocado)'
                    : 'substituídos, com versão antiga arquivada em histórico'}
                  .
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
                Todos ({previewResults.length})
              </Button>
              <Button size="sm" variant={filter === 'ok' ? 'default' : 'outline'} onClick={() => setFilter('ok')}>
                Prontos ({previewSummary.ok})
              </Button>
              <Button
                size="sm"
                variant={filter === 'warning' ? 'default' : 'outline'}
                onClick={() => setFilter('warning')}
              >
                Avisos ({previewSummary.warning})
              </Button>
              <Button
                size="sm"
                variant={filter === 'error' ? 'default' : 'outline'}
                onClick={() => setFilter('error')}
              >
                Erros ({previewSummary.error})
              </Button>
            </div>

            <div className="border rounded-lg max-h-96 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                        <FileX className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        Nenhum resultado para esse filtro
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredResults.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.email}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.reason ? REASON_LABEL[r.reason] || r.reason : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="border-t pt-4 space-y-3">
              <Label htmlFor="confirm">
                Para confirmar a importação de{' '}
                <strong>{previewSummary.ok + previewSummary.warning}</strong> aluno(s) em{' '}
                <strong>"{selectedSimuladoData?.nome ?? ''}"</strong>, digite{' '}
                <strong className="font-mono">IMPORTAR</strong>
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="IMPORTAR"
                disabled={importing}
              />
              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  {chunkInfo && (
                    <p className="text-xs text-muted-foreground">
                      Lote {chunkInfo.current} de {chunkInfo.total} · {chunkInfo.processed}/
                      {chunkInfo.totalRows} alunos processados
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={runImport}
                  disabled={confirmText.trim().toUpperCase() !== 'IMPORTAR' || importing}
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Confirmar importação
                </Button>
                {importing ? (
                  <Button variant="outline" onClick={cancelImport}>
                    <X className="h-4 w-4 mr-2" /> Cancelar (interromper)
                  </Button>
                ) : (
                  <Button variant="outline" onClick={reset}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Cancelar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {finalReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Importação concluída
            </CardTitle>
            <CardDescription>
              Lote: <span className="font-mono text-xs">{finalReport.batch_id}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label="Total" value={finalReport.summary.total} />
              <Stat label="Importados" value={finalReport.summary.imported} variant="success" />
              <Stat label="Substituídos" value={finalReport.summary.replaced} variant="success" />
              <Stat label="Pulados" value={finalReport.summary.skipped} variant="warning" />
              <Stat label="Falhas" value={finalReport.summary.failed} variant="error" />
            </div>
            {finalReport.summary.failed > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{finalReport.summary.failed} aluno(s) falharam</AlertTitle>
                <AlertDescription>Baixe o relatório para ver os motivos detalhados.</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button onClick={downloadReport} variant="outline">
                <Download className="h-4 w-4 mr-2" /> Baixar relatório
              </Button>
              <Button onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-2" /> Nova importação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <BatchHistorySection refreshKey={finalReport?.batch_id ?? null} />
    </div>
  );
}

// =====================================================================
// Histórico de importações: lista batches recentes, permite re-baixar
// relatório de cada um (lê admin_import_records via RPC).
// =====================================================================
interface BatchRow {
  id: string;
  simulado_id: string;
  simulado_nome: string;
  source_label: string;
  conflict_mode: 'skip' | 'replace';
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  replaced_count: number;
  failed_count: number;
  status: 'in_progress' | 'completed' | 'failed';
  created_by: string;
  created_by_email: string;
  created_at: string;
  finished_at: string | null;
}

const BATCH_REASON_LABEL: Record<string, string> = {
  invalid_email: 'E-mail inválido',
  duplicate_email_in_file: 'E-mail duplicado na planilha',
  user_not_found: 'Usuário não cadastrado',
  user_not_in_ies: 'Usuário não pertence à IES do simulado',
  answers_missing: 'Sem respostas',
  no_answers: 'Nenhuma resposta preenchida',
  invalid_question_numbers: 'Colunas de questão inválidas',
  partial_answers: 'Respostas parciais (algumas em branco)',
  already_finalized: 'Aluno já finalizou esse simulado',
  validation_failed: 'Falhou na validação',
};

function BatchHistorySection({ refreshKey }: { refreshKey: string | null }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Cast: RPC ainda não foi regenerada nos types do supabase-js
      const { data, error: rpcErr } = await (supabase.rpc as any)('admin_list_import_batches', { p_limit: 50 });
      if (rpcErr) throw rpcErr;
      setBatches((data ?? []) as BatchRow[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load, refreshKey]);

  const handleDownload = async (batch: BatchRow) => {
    setDownloadingId(batch.id);
    try {
      const { data, error: rpcErr } = await (supabase.rpc as any)('admin_get_batch_records', {
        p_batch_id: batch.id,
      });
      if (rpcErr) throw rpcErr;
      const rows = ((data ?? []) as Array<{ email: string; status: string; reason: string | null }>).map((r) => ({
        email: r.email,
        status: r.status,
        motivo: r.reason ? BATCH_REASON_LABEL[r.reason] || r.reason : '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
      const safeName = batch.simulado_nome.replace(/[^\w]/g, '_').slice(0, 40);
      XLSX.writeFile(wb, `import-${safeName}-${batch.id.slice(0, 8)}.xlsx`);
      toast({ title: 'Relatório baixado', description: `${rows.length} linha(s)` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Erro ao baixar relatório', description: msg, variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Histórico de importações
          <ChevronsUpDown className="h-4 w-4 ml-auto opacity-50" />
        </CardTitle>
        <CardDescription>
          {open ? 'Últimos 50 lotes — clique pra recolher' : 'Clique para expandir os lotes anteriores'}
        </CardDescription>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
              )}
              Atualizar
            </Button>
            <span className="text-xs text-muted-foreground">
              {loading ? 'Carregando…' : `${batches.length} lote(s)`}
            </span>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Falha ao carregar histórico</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && batches.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
              Nenhuma importação registrada ainda.
            </div>
          )}

          {batches.length > 0 && (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Simulado</TableHead>
                    <TableHead>Rótulo</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Imp.</TableHead>
                    <TableHead className="text-right">Sub.</TableHead>
                    <TableHead className="text-right">Pul.</TableHead>
                    <TableHead className="text-right">Falhas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(b.created_at)}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate" title={b.simulado_nome}>
                        {b.simulado_nome}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={b.source_label}>
                        {b.source_label}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {b.conflict_mode === 'skip' ? 'Pular' : 'Substituir'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">{b.total_rows}</TableCell>
                      <TableCell className="text-right text-xs text-emerald-600">{b.imported_count}</TableCell>
                      <TableCell className="text-right text-xs text-blue-600">{b.replaced_count}</TableCell>
                      <TableCell className="text-right text-xs text-amber-600">{b.skipped_count}</TableCell>
                      <TableCell className="text-right text-xs text-rose-600">{b.failed_count}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            b.status === 'completed' && 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
                            b.status === 'in_progress' && 'bg-amber-500/10 text-amber-700 border-amber-500/30',
                            b.status === 'failed' && 'bg-rose-500/10 text-rose-700 border-rose-500/30',
                          )}
                        >
                          {b.status === 'completed' ? 'OK' : b.status === 'in_progress' ? 'Em andamento' : 'Falhou'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownload(b)}
                          disabled={downloadingId === b.id}
                          title="Baixar relatório do lote"
                        >
                          {downloadingId === b.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: number;
  variant?: 'default' | 'success' | 'warning' | 'error';
}) {
  const colors: Record<string, string> = {
    default: 'bg-muted text-foreground',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    error: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  };
  return (
    <div className={`rounded-lg p-3 ${colors[variant]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: PreviewResult['status'] }) {
  const map: Record<PreviewResult['status'], { label: string; className: string }> = {
    preview_ok: { label: 'OK', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
    preview_warning: { label: 'Aviso', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
    preview_error: { label: 'Erro', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30' },
    imported: { label: 'Importado', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
    replaced: { label: 'Substituído', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
    skipped: { label: 'Pulado', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
    failed: { label: 'Falha', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30' },
  };
  const cfg = map[status];
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}
