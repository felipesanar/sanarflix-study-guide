import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import {
  Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2,
  Loader2, ShieldAlert, Eye, FileCheck, RotateCcw, Info,
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
};

const CHUNK_SIZE = 50;

export default function SimuladosImportRespostasTab() {
  const { toast } = useToast();
  const [simulados, setSimulados] = useState<SimuladoOpt[]>([]);
  const [loadingSimulados, setLoadingSimulados] = useState(false);
  const [selectedSimulado, setSelectedSimulado] = useState<string>('');
  const [conflictMode, setConflictMode] = useState<'skip' | 'replace'>('skip');
  const [sourceLabel, setSourceLabel] = useState('');
  const [defaultDate, setDefaultDate] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [previewResults, setPreviewResults] = useState<PreviewResult[]>([]);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmText, setConfirmText] = useState('');
  const [finalReport, setFinalReport] = useState<{
    batch_id: string;
    summary: { total: number; imported: number; skipped: number; replaced: number; failed: number };
    results: PreviewResult[];
  } | null>(null);
  const [filter, setFilter] = useState<'all' | 'ok' | 'warning' | 'error'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSimuladoData = simulados.find((s) => s.id === selectedSimulado);

  // Carregar simulados ao montar
  useMemo(() => {
    (async () => {
      setLoadingSimulados(true);
      const { data, error } = await supabase
        .from('simulados_admin')
        .select('id, nome, ies_ids')
        .order('created_at', { ascending: false });
      if (error) {
        toast({ title: 'Erro', description: 'Falha ao carregar simulados', variant: 'destructive' });
        setLoadingSimulados(false);
        return;
      }
      // Para cada simulado, contar questões
      const ids = (data ?? []).map((s) => s.id);
      let counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: qs } = await supabase
          .from('questoes_simulado')
          .select('simulado_id')
          .in('simulado_id', ids);
        counts = (qs ?? []).reduce((acc: Record<string, number>, r: { simulado_id: string }) => {
          acc[r.simulado_id] = (acc[r.simulado_id] || 0) + 1;
          return acc;
        }, {});
      }
      setSimulados(
        (data ?? []).map((s) => ({
          id: s.id,
          nome: s.nome,
          total_questoes: counts[s.id] ?? 0,
          ies_count: Array.isArray(s.ies_ids) ? s.ies_ids.length : 0,
        })),
      );
      setLoadingSimulados(false);
    })();
  }, []);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setPreviewResults([]);
    setPreviewSummary(null);
    setFinalReport(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: false });

      if (json.length === 0) {
        toast({ title: 'Planilha vazia', variant: 'destructive' });
        return;
      }

      // Identificar coluna de email
      const headers = Object.keys(json[0] ?? {});
      const emailKey = headers.find((h) => /e?\s?-?\s?mail/i.test(h.trim())) ?? headers[0];
      const tempoKey = headers.find((h) => /tempo/i.test(h));
      const saidasKey = headers.find((h) => /saida|saída|aba/i.test(h));
      const dataKey = headers.find((h) => /data|finalizad/i.test(h));

      // Demais colunas = números de questão
      const reservedKeys = new Set([emailKey, tempoKey, saidasKey, dataKey].filter(Boolean) as string[]);
      const questionKeys = headers.filter((h) => !reservedKeys.has(h));

      const rows: ParsedRow[] = json.map((row, idx) => {
        const answers: Record<string, string | null> = {};
        for (const k of questionKeys) {
          const num = String(k).replace(/[^\d]/g, '');
          if (!num) continue;
          const v = row[k];
          answers[num] = v == null || v === '' ? null : String(v).trim();
        }
        const tempoMin = tempoKey ? Number(row[tempoKey]) : NaN;
        return {
          rowIndex: idx + 2, // +2 pq linha 1 é header, e excel é 1-indexed
          email: String(row[emailKey] ?? '').trim(),
          answers,
          tempo_segundos: Number.isFinite(tempoMin) ? Math.round(tempoMin * 60) : undefined,
          saidas_aba: saidasKey ? Number(row[saidasKey]) || 0 : undefined,
          finalizado_em: dataKey && row[dataKey] ? String(row[dataKey]) : undefined,
        };
      });

      setParsedRows(rows);
      toast({ title: 'Planilha carregada', description: `${rows.length} linhas detectadas` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Erro ao ler planilha', description: msg, variant: 'destructive' });
    }
  };

  const downloadTemplate = () => {
    if (!selectedSimuladoData) return;
    const total = selectedSimuladoData.total_questoes;
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
      if (error) throw error;
      const d = data as { results: PreviewResult[]; summary: PreviewSummary };
      setPreviewResults(d.results);
      setPreviewSummary(d.summary);
      toast({ title: 'Pré-visualização gerada', description: `${d.summary.ok} prontos, ${d.summary.warning} com aviso, ${d.summary.error} erros` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Erro na pré-visualização', description: msg, variant: 'destructive' });
    } finally {
      setPreviewing(false);
    }
  };

  const runImport = async () => {
    if (!previewSummary || importing) return;
    if (confirmText !== 'IMPORTAR') {
      toast({ title: 'Confirmação inválida', description: 'Digite IMPORTAR para confirmar', variant: 'destructive' });
      return;
    }

    setImporting(true);
    setProgress(0);
    setFinalReport(null);

    // Filtrar linhas que passaram na validação (ok ou warning)
    const validEmails = new Set(
      previewResults.filter((r) => r.status === 'preview_ok' || r.status === 'preview_warning').map((r) => r.email),
    );
    const rowsToSend = parsedRows.filter((r) => validEmails.has(r.email.trim().toLowerCase()));

    const batchId = crypto.randomUUID();
    const allResults: PreviewResult[] = [];
    let imported = 0, skipped = 0, replaced = 0, failed = 0;

    try {
      for (let i = 0; i < rowsToSend.length; i += CHUNK_SIZE) {
        const chunk = rowsToSend.slice(i, i + CHUNK_SIZE);
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
        title: 'Importação concluída',
        description: `${imported} importados, ${replaced} substituídos, ${skipped} pulados, ${failed} falhas`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Erro na importação', description: msg, variant: 'destructive' });
    } finally {
      setImporting(false);
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
    setPreviewResults([]);
    setPreviewSummary(null);
    setFinalReport(null);
    setConfirmText('');
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredResults = previewResults.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'ok') return r.status === 'preview_ok';
    if (filter === 'warning') return r.status === 'preview_warning';
    if (filter === 'error') return r.status === 'preview_error';
    return true;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Importar respostas externas
          </CardTitle>
          <CardDescription>
            Registre oficialmente as respostas de alunos para um simulado já cadastrado, a partir de uma planilha
            Excel (.xlsx). Use para provas aplicadas em sala ou em sistema externo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Como funciona</AlertTitle>
            <AlertDescription>
              1. Escolha o simulado de destino • 2. Baixe o template • 3. Preencha • 4. Faça upload •
              5. Pré-visualize • 6. Confirme. Cada importação gera um lote rastreável; reenviar a mesma planilha não duplica.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Simulado de destino</Label>
              <Select value={selectedSimulado} onValueChange={setSelectedSimulado} disabled={loadingSimulados}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingSimulados ? 'Carregando...' : 'Selecione um simulado'} />
                </SelectTrigger>
                <SelectContent>
                  {simulados.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome} ({s.total_questoes} questões)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSimuladoData && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{selectedSimuladoData.total_questoes} questões</Badge>
                  <Badge variant="outline">{selectedSimuladoData.ies_count} IES vinculada(s)</Badge>
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
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Data de finalização padrão (opcional)</Label>
              <Input
                type="datetime-local"
                value={defaultDate}
                onChange={(e) => setDefaultDate(e.target.value ? new Date(e.target.value).toISOString() : '')}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Aplicada a alunos sem data própria na planilha.
              </p>
            </div>

            <div>
              <Label>Conflito (aluno já finalizou)</Label>
              <RadioGroup value={conflictMode} onValueChange={(v) => setConflictMode(v as 'skip' | 'replace')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skip" id="skip" />
                  <Label htmlFor="skip" className="font-normal">
                    Pular (seguro) — não toca nas respostas existentes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="replace" id="replace" />
                  <Label htmlFor="replace" className="font-normal">
                    Substituir — arquiva no histórico e cria nova tentativa
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" disabled={!selectedSimuladoData} onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" /> Baixar template
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!selectedSimulado}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Carregar planilha
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {fileName && <Badge variant="secondary">{fileName} • {parsedRows.length} linhas</Badge>}
          </div>

          {parsedRows.length > 0 && !previewSummary && (
            <Button onClick={runPreview} disabled={previewing} className="w-full md:w-auto">
              {previewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Pré-visualizar
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
            <CardDescription>Revise antes de confirmar a importação</CardDescription>
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

            <div className="flex gap-2">
              <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
                Todos
              </Button>
              <Button size="sm" variant={filter === 'ok' ? 'default' : 'outline'} onClick={() => setFilter('ok')}>
                Prontos
              </Button>
              <Button size="sm" variant={filter === 'warning' ? 'default' : 'outline'} onClick={() => setFilter('warning')}>
                Avisos
              </Button>
              <Button size="sm" variant={filter === 'error' ? 'default' : 'outline'} onClick={() => setFilter('error')}>
                Erros
              </Button>
            </div>

            <div className="border rounded-lg max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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
                Para confirmar a importação de <strong>{previewSummary.ok + previewSummary.warning}</strong> aluno(s),
                digite <strong className="font-mono">IMPORTAR</strong>
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="IMPORTAR"
              />
              {importing && <Progress value={progress} className="mt-2" />}
              <div className="flex gap-2">
                <Button onClick={runImport} disabled={confirmText !== 'IMPORTAR' || importing}>
                  {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Confirmar importação
                </Button>
                <Button variant="outline" onClick={reset} disabled={importing}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Cancelar
                </Button>
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
            <CardDescription>Lote: <span className="font-mono text-xs">{finalReport.batch_id}</span></CardDescription>
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
    </div>
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
