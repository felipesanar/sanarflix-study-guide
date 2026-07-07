/**
 * Fatia B — Usuários: diálogo "Cadastro em lote" (`UsuariosPage`).
 *
 * Migra `UsersTab.processCsvFile` para `useBulkRunner`: `parse` mantém a
 * detecção de mojibake e a validação client-side linha-a-linha; `dryRun`
 * classifica novo/atualizar consultando `public.users` por e-mail (não existe
 * RPC `admin_lookup_users_by_email_in_ies` chamável pelo client — a mesma
 * tabela já é lida diretamente pela lista de usuários, então reaproveitamos
 * o mesmo acesso em vez de inventar uma RPC nova); `execute` chama
 * `usersService.createUser` em chunks de 3 com o retry/backoff de
 * RATE_LIMITED que já existia. O relatório final usa `BatchProcessingReport`
 * (mais rico que o relatório padrão do BulkRunnerPanel — distingue
 * criados/atualizados/e-mail enviado).
 */
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Building2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BulkRunnerPanel, useBulkRunner } from '@/experiences/admin/ui';
import { supabase } from '@/integrations/supabase/client';
import { usersService } from '@/services/usersService';
import type { Ies } from '@/services/iesService';
import { BatchProcessingReport, type BatchReport, type BatchResult } from '../BatchProcessingReport';

const MAX_BATCH_ROWS = 1000;
const CHUNK_SIZE = 3;
const INTER_CHUNK_DELAY_MS = 500;
const RATE_LIMIT_RETRY_MAX = 2;
const RATE_LIMIT_RETRY_DELAY_MS = 60_000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Row {
  nome: string;
  email: string;
  semestre: number | null;
  linha: number;
  erro?: string;
}

async function parseUsersFile(file: File): Promise<Row[]> {
  const arrayBuffer = await file.arrayBuffer();
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  let workbook: XLSX.WorkBook;

  if (isCsv) {
    let text = new TextDecoder('utf-8').decode(arrayBuffer);
    const mojibakePatterns = /Ã£|Ã©|Ãª|Ã´|Ã§|Ã¡|Ãº|Ã³|Ã­|Ã¢|Ãã|Ã /;
    if (mojibakePatterns.test(text)) {
      text = new TextDecoder('windows-1252').decode(arrayBuffer);
    }
    workbook = XLSX.read(text, { type: 'string' });
  } else {
    workbook = XLSX.read(arrayBuffer, { type: 'array' });
  }

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
  if (rawRows.length === 0) throw new Error('Arquivo vazio ou sem dados.');
  if (rawRows.length > MAX_BATCH_ROWS) {
    throw new Error(`Limite de ${MAX_BATCH_ROWS} linhas por lote excedido (${rawRows.length} linhas encontradas).`);
  }

  const normalized = rawRows.map((row) => {
    const n: Record<string, string> = {};
    for (const key of Object.keys(row)) n[key.trim().toLowerCase()] = String(row[key]).trim();
    return n;
  });

  const missing = ['nome', 'email'].filter((c) => !(c in normalized[0]));
  if (missing.length > 0) throw new Error(`Colunas obrigatórias faltando: ${missing.join(', ')}`);

  const seen = new Set<string>();
  return normalized
    .map((r, i): Row => {
      const linha = i + 2; // linha 1 = header
      const email = (r.email ?? '').toLowerCase().trim();
      const nome = (r.nome ?? '').trim();
      const semestreStr = (r.semestre ?? '').trim();

      let erro: string | undefined;
      let semestre: number | null = null;

      if (!nome || !email) {
        erro = 'Dados incompletos (nome e email obrigatórios)';
      } else if (!EMAIL_RE.test(email)) {
        erro = `Email inválido: ${email}`;
      } else if (seen.has(email)) {
        erro = 'Email duplicado neste lote';
      } else if (semestreStr) {
        const parsed = parseInt(semestreStr, 10);
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 12) erro = `Semestre inválido: ${semestreStr}`;
        else semestre = parsed;
      }

      if (!erro) seen.add(email);
      return { nome, email, semestre, linha, erro };
    })
    .filter((r) => r.nome || r.email); // ignora linhas totalmente vazias
}

function downloadExampleXlsx() {
  const wsData = [
    ['nome', 'email', 'semestre'],
    ['João Silva', 'joao@exemplo.com', 5],
    ['Maria Souza', 'maria@exemplo.com', 3],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
  XLSX.writeFile(wb, 'exemplo_cadastro_usuarios.xlsx');
}

function downloadFailuresReport(report: BatchReport) {
  const wb = XLSX.utils.book_new();
  const summary = [
    ['RELATÓRIO DE CADASTRO EM LOTE'],
    [''],
    ['Total', report.total],
    ['Criados', report.created],
    ['Atualizados', report.updated],
    ['Erros', report.errors],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Resumo');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      report.results.map((r) => ({
        Linha: r.linha,
        Email: r.email,
        Nome: r.nome,
        Status: r.success ? 'Sucesso' : 'Erro',
        Ação: r.action === 'created' ? 'Criado' : r.action === 'updated' ? 'Atualizado' : '-',
        'Código erro': r.error?.code ?? '-',
        'Mensagem erro': r.error?.message ?? '-',
      })),
    ),
    'Resultados',
  );
  XLSX.writeFile(wb, `relatorio_cadastro_${new Date().toISOString().split('T')[0]}.xlsx`);
  toast.success('Relatório baixado com sucesso');
}

export interface BulkCreateUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iesList: Ies[];
  onDone: () => void;
}

/** Diálogo de cadastro/atualização em lote (XLSX/CSV) via `useBulkRunner`. */
export function BulkCreateUsersDialog({ open, onOpenChange, iesList, onDone }: BulkCreateUsersDialogProps) {
  const [batchIesId, setBatchIesId] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const richResultsRef = useRef<BatchResult[]>([]);
  const startedAtRef = useRef<Date | null>(null);
  const [report, setReport] = useState<BatchReport | null>(null);

  const runner = useBulkRunner<Row>({
    parse: parseUsersFile,
    dryRun: async (rows) => {
      const candidatas = rows.filter((r) => !r.erro);
      const emails = candidatas.map((r) => r.email);
      let existentes = new Set<string>();
      if (emails.length > 0) {
        const { data } = await supabase.from('users').select('email').in('email', emails);
        existentes = new Set((data ?? []).map((u: { email: string }) => u.email));
      }
      let novos = 0;
      let atualizados = 0;
      const detalhes = rows.map((r) => {
        if (r.erro) return { linha: r.linha, status: 'erro' as const, mensagem: r.erro };
        if (existentes.has(r.email)) {
          atualizados++;
          return { linha: r.linha, status: 'atualizar' as const };
        }
        novos++;
        return { linha: r.linha, status: 'novo' as const };
      });
      return { total: rows.length, novos, atualizados, erros: rows.filter((r) => r.erro).length, detalhes };
    },
    execute: async (chunk) => {
      const outcomes = await Promise.allSettled(
        chunk.map(async (row): Promise<BatchResult> => {
          if (row.erro) {
            return { email: row.email, nome: row.nome, linha: row.linha, success: false, error: { code: 'VALIDATION_ERROR', message: row.erro } };
          }

          let attempt = 0;
          let data = await usersService.createUser({ nome: row.nome, email: row.email, id_ies: batchIesId, semestre: row.semestre });
          while (!data.success && (data.code === 'RATE_LIMITED' || data.code === 'rate_limited') && attempt < RATE_LIMIT_RETRY_MAX) {
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_DELAY_MS));
            data = await usersService.createUser({ nome: row.nome, email: row.email, id_ies: batchIesId, semestre: row.semestre });
          }

          if (!data.success) {
            const message = data.message ? `${data.error}: ${data.message}` : (data.error ?? 'Erro desconhecido');
            return { email: row.email, nome: row.nome, linha: row.linha, success: false, error: { code: data.code ?? 'INTERNAL_ERROR', message } };
          }
          return {
            email: row.email,
            nome: row.nome,
            linha: row.linha,
            success: true,
            action: data.action,
            fieldsUpdated: data.details?.fieldsUpdated,
            emailSent: data.details?.emailSent,
          };
        }),
      );

      let ok = 0;
      const falhas: Array<{ linha: number; mensagem: string }> = [];
      outcomes.forEach((outcome, idx) => {
        const row = chunk[idx];
        const result: BatchResult = outcome.status === 'fulfilled'
          ? outcome.value
          : { email: row.email, nome: row.nome, linha: row.linha, success: false, error: { code: 'INTERNAL_ERROR', message: outcome.reason?.message || 'Erro inesperado' } };
        richResultsRef.current.push(result);
        if (result.success) ok++;
        else falhas.push({ linha: result.linha, mensagem: result.error?.message ?? 'Erro desconhecido' });
      });
      return { ok, falhas };
    },
    chunkSize: CHUNK_SIZE,
    interChunkDelayMs: INTER_CHUNK_DELAY_MS,
  });

  const { phase, rows, actions, error } = runner;
  const isFinished = phase === 'done' || phase === 'cancelled';

  // `loadFile` guarda o erro de parsing no estado sem trocar de fase (fica em
  // 'idle', onde o BulkRunnerPanel não é renderizado) — sem isso, um arquivo
  // inválido falharia silenciosamente.
  useEffect(() => {
    if (phase === 'idle' && error) toast.error(error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setReport(null);
    await actions.loadFile(file);
  };

  const handleStart = async () => {
    richResultsRef.current = [];
    startedAtRef.current = new Date();
    await actions.start();
  };

  // Constrói o relatório rico (criados/atualizados/e-mail enviado) uma única
  // vez quando o lote termina — evita recomputar a cada render e setState
  // durante o próprio render (o `finishedAt` ficaria diferente a cada chamada).
  useEffect(() => {
    if (!isFinished || richResultsRef.current.length === 0) return;
    const results = richResultsRef.current;
    setReport({
      total: results.length,
      created: results.filter((r) => r.success && r.action === 'created').length,
      updated: results.filter((r) => r.success && r.action === 'updated').length,
      errors: results.filter((r) => !r.success).length,
      skipped: 0,
      results,
      startedAt: startedAtRef.current ?? new Date(),
      finishedAt: new Date(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  const handleClose = (next: boolean) => {
    if (phase === 'running') return;
    onOpenChange(next);
    if (!next) {
      const hadResults = richResultsRef.current.length > 0;
      actions.reset();
      setBatchIesId('');
      setFileName(null);
      setReport(null);
      richResultsRef.current = [];
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (hadResults) onDone();
    }
  };

  const showReport = isFinished && report !== null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastro em lote</DialogTitle>
          <DialogDescription>
            Importe múltiplos usuários via XLSX/CSV (máx. {MAX_BATCH_ROWS} linhas). Novos usuários recebem convite por e-mail.
          </DialogDescription>
        </DialogHeader>

        {phase === 'idle' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> Instituição (IES)
              </Label>
              <Select value={batchIesId} onValueChange={setBatchIesId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a IES para este lote" />
                </SelectTrigger>
                <SelectContent>
                  {iesList.map((ies) => (
                    <SelectItem key={ies.id} value={ies.id}>{ies.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Upload className="h-3.5 w-3.5" /> Arquivo XLSX/CSV
              </Label>
              <div className="flex gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                <Button variant="outline" onClick={downloadExampleXlsx} className="shrink-0">
                  <Download className="h-4 w-4 mr-2" /> Exemplo
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Colunas: <span className="font-mono">nome</span>, <span className="font-mono">email</span> (obrigatórias) e{' '}
                <span className="font-mono">semestre</span> (opcional).
              </p>
              {fileName && rows.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{fileName}</span> — {rows.length} linha(s) lida(s).
                </p>
              )}
            </div>

            <Button onClick={() => actions.runDryRun()} disabled={!batchIesId || rows.length === 0}>
              Pré-visualizar
            </Button>
          </div>
        )}

        {(phase === 'preview' || phase === 'running' || phase === 'error') && (
          <BulkRunnerPanel
            state={runner}
            onStart={handleStart}
            onCancel={actions.cancel}
            onReset={() => { actions.reset(); setFileName(null); setReport(null); }}
            chunkSize={CHUNK_SIZE}
            startLabel="Iniciar cadastro"
            unidadeLabel="usuário(s)"
            metricLabels={{ novos: 'Novos', atualizados: 'Atualizar', erros: 'Erros' }}
          />
        )}

        {showReport && report && (
          <BatchProcessingReport
            report={report}
            onDownload={() => downloadFailuresReport(report)}
            onClose={() => handleClose(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BulkCreateUsersDialog;
