import * as React from 'react';
import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Download, Upload, Mail, ShieldAlert, Loader2, FileSpreadsheet, CheckCircle2, XCircle } from 'lucide-react';
import { usersService, type BulkEmailUpdateRowResult } from '@/services/usersService';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

const MAX_CSV_ROWS = 500;
const CHUNK_SIZE = 50;
const CHUNK_DELAY_MS = 250;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ParsedRow {
  email_antigo: string;
  email_novo: string;
  line: number;
  error?: string;
}

function parseCsv(text: string): { rows: ParsedRow[]; globalErrors: string[] } {
  const globalErrors: string[] = [];
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], globalErrors: ['CSV vazio'] };
  }
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const idxOld = header.indexOf('email_antigo');
  const idxNew = header.indexOf('email_novo');
  if (idxOld === -1 || idxNew === -1) {
    return {
      rows: [],
      globalErrors: ['Cabeçalho inválido. Esperado: email_antigo,email_novo'],
    };
  }
  const rows: ParsedRow[] = [];
  const seenOld = new Set<string>();
  const seenNew = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const ea = (cols[idxOld] || '').toLowerCase();
    const en = (cols[idxNew] || '').toLowerCase();
    const row: ParsedRow = { email_antigo: ea, email_novo: en, line: i + 1 };
    if (!ea || !en) row.error = 'Linha incompleta';
    else if (!EMAIL_RE.test(ea)) row.error = 'email_antigo inválido';
    else if (!EMAIL_RE.test(en)) row.error = 'email_novo inválido';
    else if (ea === en) row.error = 'email_antigo igual ao email_novo';
    else if (seenOld.has(ea)) row.error = 'email_antigo duplicado no CSV';
    else if (seenNew.has(en)) row.error = 'email_novo duplicado no CSV';
    else {
      seenOld.add(ea);
      seenNew.add(en);
    }
    rows.push(row);
  }
  // chain detection
  for (const r of rows) {
    if (!r.error && seenOld.has(r.email_novo)) {
      r.error = 'Cadeia detectada (novo aparece como antigo em outra linha)';
    }
  }
  if (rows.length > MAX_CSV_ROWS) {
    globalErrors.push(`CSV excede o limite de ${MAX_CSV_ROWS} linhas (encontrado ${rows.length}).`);
  }
  return { rows, globalErrors };
}

function downloadTemplate() {
  // Gera o CSV inline via Blob para evitar navegação para /templates/* — no preview
  // do Lovable rotas não-app caem na tela "Sign in to continue", quebrando o link.
  const content =
    'email_antigo,email_novo\n' +
    'aluno.antigo@faculdade.edu.br,aluno.novo@faculdade.edu.br\n';
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template_atualizacao_emails.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadReport(results: BulkEmailUpdateRowResult[]) {
  const header = 'email_antigo,email_novo,status,motivo\n';
  const rows = results
    .map((r) => `${r.email_antigo},${r.email_novo},${r.status},${r.reason ?? ''}`)
    .join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio_atualizacao_emails_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const REASON_LABELS: Record<string, string> = {
  user_not_found: 'Usuário não encontrado',
  cannot_update_self: 'Você não pode alterar o próprio email',
  protected_role: 'Usuário tem role protegida (admin/gestor/professor/atendimento)',
  email_already_in_use: 'Novo email já está em uso',
  auth_update_failed: 'Falha ao atualizar no Auth',
  public_update_failed: 'Falha ao atualizar no banco',
  lookup_error: 'Erro ao buscar usuário',
  role_check_error: 'Erro ao verificar permissões',
  internal_error: 'Erro interno',
};

export const BulkEmailUpdateTab: React.FC = () => {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [globalErrors, setGlobalErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [results, setResults] = useState<BulkEmailUpdateRowResult[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = useMemo(() => parsedRows.filter((r) => !r.error), [parsedRows]);
  const invalidRows = useMemo(() => parsedRows.filter((r) => r.error), [parsedRows]);
  const canSubmit =
    !isProcessing &&
    validRows.length > 0 &&
    invalidRows.length === 0 &&
    globalErrors.length === 0;

  const handleFile = async (file: File) => {
    setResults(null);
    setFileName(file.name);
    const text = await file.text();
    const { rows, globalErrors: errs } = parseCsv(text);
    setParsedRows(rows);
    setGlobalErrors(errs);
    if (rows.length === 0 && errs.length === 0) {
      toast.error('Nenhuma linha encontrada no CSV');
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const reset = () => {
    setParsedRows([]);
    setGlobalErrors([]);
    setFileName('');
    setResults(null);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runUpdate = async () => {
    setConfirmOpen(false);

    // Guard: garante sessão válida antes de disparar invokes em lote.
    // Sem isso, um refresh_token expirado faz todas as N linhas falharem
    // com o erro genérico "Falha ao atualizar emails em lote".
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      toast.error('Sua sessão expirou. Faça login novamente para continuar.');
      return;
    }

    setIsProcessing(true);
    setResults(null);

    const payloadRows = validRows.map((r) => ({
      email_antigo: r.email_antigo,
      email_novo: r.email_novo,
    }));

    const allResults: BulkEmailUpdateRowResult[] = [];
    try {
      for (let i = 0; i < payloadRows.length; i += CHUNK_SIZE) {
        const chunk = payloadRows.slice(i, i + CHUNK_SIZE);
        setProgress({ current: i, total: payloadRows.length });
        const res = await usersService.bulkUpdateEmail(chunk);
        if (res.error === 'session_expired') {
          toast.error('Sua sessão expirou durante o processamento. Faça login novamente.');
          setIsProcessing(false);
          return;
        }
        if (!res.success && (!res.results || res.results.length === 0)) {
          // Marca o chunk inteiro como falha
          chunk.forEach((r) =>
            allResults.push({ ...r, status: 'failed', reason: res.error || 'internal_error' }),
          );
        } else {
          allResults.push(...(res.results || []));
        }
        if (i + CHUNK_SIZE < payloadRows.length) {
          await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
        }
      }
      setProgress({ current: payloadRows.length, total: payloadRows.length });
      setResults(allResults);
      const updated = allResults.filter((r) => r.status === 'updated').length;
      const failed = allResults.filter((r) => r.status === 'failed').length;
      if (failed === 0) toast.success(`${updated} email(s) atualizado(s) com sucesso`);
      else toast.warning(`${updated} atualizado(s) · ${failed} falha(s)`);
    } catch (e) {
      Logger.error('[BulkEmailUpdateTab]', e);
      toast.error('Erro inesperado durante o processamento');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Atualização de emails em lote
        </CardTitle>
        <CardDescription>
          Atualize o email de login de alunos enviando um CSV com as colunas{' '}
          <code className="text-xs bg-muted px-1 rounded">email_antigo</code> e{' '}
          <code className="text-xs bg-muted px-1 rounded">email_novo</code>.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Comportamento e segurança</AlertTitle>
          <AlertDescription className="space-y-1 text-sm">
            <p>• <strong>Apenas alunos</strong> podem ter o email alterado — admins, gestores, professores e atendimento são bloqueados pelo servidor.</p>
            <p>• <strong>Nenhum dado é perdido</strong>: progresso, simulados, calendário e histórico são vinculados ao ID interno, não ao email.</p>
            <p>• O usuário recebe um email no <strong>novo endereço</strong> avisando a mudança. Todas as sessões ativas são encerradas — ele precisará relogar.</p>
            <p>• Limite de <strong>{MAX_CSV_ROWS} linhas</strong> por CSV. Processado em lotes de {CHUNK_SIZE} por chamada.</p>
            <p>• Operação <strong>auditada</strong> em <code className="text-xs">admin_audit_log</code>.</p>
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Baixar modelo CSV
          </Button>
          <label className="inline-flex">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onPickFile}
              disabled={isProcessing}
            />
            <Button asChild variant="default" disabled={isProcessing}>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Selecionar CSV
              </span>
            </Button>
          </label>
          {fileName && (
            <Badge variant="secondary" className="gap-1">
              <FileSpreadsheet className="h-3 w-3" />
              {fileName}
            </Badge>
          )}
          {(parsedRows.length > 0 || results) && (
            <Button variant="ghost" onClick={reset} disabled={isProcessing}>
              Limpar
            </Button>
          )}
        </div>

        {globalErrors.length > 0 && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Erros no CSV</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {globalErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {parsedRows.length > 0 && !results && (
          <div className="space-y-3">
            <div className="flex gap-2 text-sm">
              <Badge variant="default">{validRows.length} válidas</Badge>
              {invalidRows.length > 0 && (
                <Badge variant="destructive">{invalidRows.length} inválidas</Badge>
              )}
            </div>

            <div className="border rounded-lg overflow-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2 w-12">#</th>
                    <th className="text-left p-2">email_antigo</th>
                    <th className="text-left p-2">email_novo</th>
                    <th className="text-left p-2 w-48">status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-muted-foreground">{r.line}</td>
                      <td className="p-2 font-mono text-xs">{r.email_antigo}</td>
                      <td className="p-2 font-mono text-xs">{r.email_novo}</td>
                      <td className="p-2">
                        {r.error ? (
                          <Badge variant="destructive" className="text-xs">{r.error}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">OK</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 100 && (
                <div className="p-2 text-xs text-muted-foreground text-center bg-muted">
                  Mostrando 100 de {parsedRows.length} linhas
                </div>
              )}
            </div>

            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!canSubmit}
              className="w-full sm:w-auto"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Processar atualização ({validRows.length} alunos)
            </Button>
          </div>
        )}

        {isProcessing && progress && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Processando...</AlertTitle>
            <AlertDescription>
              {progress.current} de {progress.total} linhas processadas
            </AlertDescription>
          </Alert>
        )}

        {results && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {results.filter((r) => r.status === 'updated').length} atualizados
              </Badge>
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {results.filter((r) => r.status === 'failed').length} falhas
              </Badge>
              <Button variant="outline" size="sm" onClick={() => downloadReport(results)}>
                <Download className="h-3 w-3 mr-1" />
                Exportar relatório
              </Button>
            </div>

            <div className="border rounded-lg overflow-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">email_antigo</th>
                    <th className="text-left p-2">email_novo</th>
                    <th className="text-left p-2">resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-mono text-xs">{r.email_antigo}</td>
                      <td className="p-2 font-mono text-xs">{r.email_novo}</td>
                      <td className="p-2">
                        {r.status === 'updated' ? (
                          <Badge className="bg-emerald-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Atualizado
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            {REASON_LABELS[r.reason ?? ''] || r.reason || 'Falha'}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar atualização em lote</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Você vai atualizar o email de <strong>{validRows.length} aluno(s)</strong>.</p>
                <p>• Sessões ativas serão encerradas.</p>
                <p>• Cada aluno receberá um email no novo endereço avisando da mudança.</p>
                <p>• Usuários com role protegida serão automaticamente ignorados pelo servidor.</p>
                <p>• Esta ação é registrada em auditoria e não pode ser desfeita automaticamente.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runUpdate}>Confirmar e processar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default BulkEmailUpdateTab;
