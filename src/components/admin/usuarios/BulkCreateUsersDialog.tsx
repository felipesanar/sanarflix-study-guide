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
import { normalizeRoleInput, roleLabel, ROLE_VALUES_HINT, type AppUserRole } from './roles';

const MAX_BATCH_ROWS = 1000;
const CHUNK_SIZE = 3;
const INTER_CHUNK_DELAY_MS = 500;
const RATE_LIMIT_RETRY_MAX = 2;
const RATE_LIMIT_RETRY_DELAY_MS = 60_000;
// PostgREST monta `.in('email', [...])` como querystring — com até 1000
// e-mails numa chamada só, a URL estoura (mesma causa raiz do bug histórico
// "Nome não disponível" na lista de usuários). Chunka em lotes de 200.
const EMAIL_LOOKUP_CHUNK_SIZE = 200;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `setTimeout` que rejeita assim que `signal` é abortado — sem isso, o
 * backoff de RATE_LIMITED (até 60s x2) ignora o cancelamento do usuário. */
function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

const MATRICULA_MAX = 50;

interface Row {
  nome: string;
  email: string;
  semestre: number | null;
  /** `null` = coluna em branco: não altera nada em quem já existe. */
  matricula_ra: string | null;
  role: AppUserRole;
  linha: number;
  erro?: string;
}

/** Primeiro alias presente na linha normalizada (headers já em minúsculas). */
function coluna(r: Record<string, string>, aliases: string[]): string {
  for (const a of aliases) {
    if (a in r) return (r[a] ?? '').trim();
  }
  return '';
}

/**
 * `canManageRoles = false` (Atendimento/CX) só pode importar alunos — qualquer
 * outro papel na planilha vira erro de linha em vez de escalar privilégio.
 */
async function parseUsersFile(file: File, canManageRoles: boolean): Promise<Row[]> {
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
      const matriculaStr = coluna(r, ['matricula_ra', 'matricula', 'ra']);
      const papelStr = coluna(r, ['papel', 'role', 'perfil']);

      let erro: string | undefined;
      let semestre: number | null = null;
      const papel = normalizeRoleInput(papelStr);

      if (!nome || !email) {
        erro = 'Dados incompletos (nome e email obrigatórios)';
      } else if (!EMAIL_RE.test(email)) {
        erro = `Email inválido: ${email}`;
      } else if (seen.has(email)) {
        erro = 'Email duplicado neste lote';
      } else if (matriculaStr.length > MATRICULA_MAX) {
        erro = `Matrícula/RA muito longa (máx. ${MATRICULA_MAX} caracteres)`;
      } else if (papel === null) {
        erro = `Papel inválido: "${papelStr}". Use um destes: ${ROLE_VALUES_HINT}`;
      } else if (!canManageRoles && papel !== 'aluno') {
        erro = `Papel "${papelStr}" não permitido nesta operação — só é possível cadastrar alunos`;
      } else if (semestreStr) {
        const parsed = parseInt(semestreStr, 10);
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 12) erro = `Semestre inválido: ${semestreStr}`;
        else semestre = parsed;
      }

      if (!erro) seen.add(email);
      return {
        nome,
        email,
        semestre,
        matricula_ra: matriculaStr || null,
        role: papel ?? 'aluno',
        linha,
        erro,
      };
    })
    .filter((r) => r.nome || r.email); // ignora linhas totalmente vazias
}

function downloadExampleXlsx() {
  const wsData = [
    ['nome', 'email', 'semestre', 'matricula_ra', 'papel'],
    ['João Silva', 'joao@exemplo.com', 5, '2023001234', 'aluno'],
    ['Maria Souza', 'maria@exemplo.com', 3, '', ''],
    ['Carlos Prof', 'carlos@exemplo.com', '', '', 'professor'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];
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
        'Matrícula/RA': r.matricula_ra ?? '-',
        Papel: r.papel ?? '-',
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
  /** `false` (Atendimento) restringe a planilha a papel `aluno`. */
  canManageRoles?: boolean;
}

/** Diálogo de cadastro/atualização em lote (XLSX/CSV) via `useBulkRunner`. */
export function BulkCreateUsersDialog({ open, onOpenChange, iesList, onDone, canManageRoles = false }: BulkCreateUsersDialogProps) {
  const [batchIesId, setBatchIesId] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const richResultsRef = useRef<BatchResult[]>([]);
  const startedAtRef = useRef<Date | null>(null);
  // E-mails marcados como 'conflito' (já cadastrados em outra IES) no último
  // dry-run. Sem isso, `execute` processaria essas linhas normalmente e a edge
  // (fluxo UPDATE) sobrescreveria `id_ies`, migrando o aluno silenciosamente —
  // exatamente o que o aviso de conflito deveria impedir. Recalculado a cada
  // dry-run e limpo sempre que o arquivo muda.
  const conflictEmailsRef = useRef<Set<string>>(new Set());
  const [report, setReport] = useState<BatchReport | null>(null);

  const runner = useBulkRunner<Row>({
    parse: (file: File) => parseUsersFile(file, canManageRoles),
    dryRun: async (rows) => {
      const candidatas = rows.filter((r) => !r.erro);
      const emails = candidatas.map((r) => r.email);
      // email -> id_ies atual (null se o usuário existe mas sem IES definida).
      const existentes = new Map<string, string | null>();
      for (let i = 0; i < emails.length; i += EMAIL_LOOKUP_CHUNK_SIZE) {
        const chunkEmails = emails.slice(i, i + EMAIL_LOOKUP_CHUNK_SIZE);
        const { data, error } = await supabase.from('users').select('email, id_ies').in('email', chunkEmails);
        // Sem checar o erro de cada chunk, uma falha silenciosa classificaria
        // todo mundo como "novo" (e o lote tentaria recriar usuários já existentes).
        if (error) {
          throw new Error(`Falha ao verificar e-mails já cadastrados: ${error.message}`);
        }
        (data ?? []).forEach((u: { email: string; id_ies: string | null }) => existentes.set(u.email, u.id_ies));
      }

      let novos = 0;
      let atualizados = 0;
      let conflitos = 0;
      const conflictEmails = new Set<string>();
      const detalhes = rows.map((r) => {
        if (r.erro) return { linha: r.linha, status: 'erro' as const, mensagem: r.erro };
        if (existentes.has(r.email)) {
          const idIesExistente = existentes.get(r.email);
          // E-mail já pertence a outra IES: sem esse aviso a importação move
          // silenciosamente o aluno para a IES do lote atual.
          if (idIesExistente && idIesExistente !== batchIesId) {
            conflitos++;
            conflictEmails.add(r.email);
            return { linha: r.linha, status: 'conflito' as const, mensagem: 'E-mail já cadastrado em outra IES' };
          }
          atualizados++;
          return { linha: r.linha, status: 'atualizar' as const };
        }
        novos++;
        return { linha: r.linha, status: 'novo' as const };
      });
      // Só substitui o Set após classificar todas as linhas com sucesso — se o
      // dry-run falhar antes (ex.: erro na consulta de e-mails), o Set anterior
      // (de um dry-run válido) é preservado em vez de ser esvaziado.
      conflictEmailsRef.current = conflictEmails;
      return { total: rows.length, novos, atualizados, conflitos, erros: rows.filter((r) => r.erro).length, detalhes };
    },
    execute: async (chunk, signal) => {
      const outcomes = await Promise.allSettled(
        chunk.map(async (row): Promise<BatchResult> => {
          if (row.erro) {
            return { email: row.email, nome: row.nome, linha: row.linha, success: false, error: { code: 'VALIDATION_ERROR', message: row.erro } };
          }

          // Linha marcada como conflito de IES no último dry-run: NÃO chama a edge.
          // O fluxo UPDATE da edge sobrescreveria `id_ies`, migrando o aluno para a
          // IES do lote atual silenciosamente — o próprio motivo do aviso de conflito.
          if (conflictEmailsRef.current.has(row.email)) {
            return {
              email: row.email,
              nome: row.nome,
              linha: row.linha,
              success: false,
              matricula_ra: row.matricula_ra ?? undefined,
              papel: roleLabel(row.role),
              error: { code: 'IES_CONFLICT', message: 'Conflito de IES — linha ignorada; ajuste a planilha ou mova o aluno manualmente.' },
            };
          }

          let attempt = 0;
          let data = await usersService.createUser({
            nome: row.nome,
            email: row.email,
            id_ies: batchIesId,
            semestre: row.semestre,
            ...(row.matricula_ra ? { matricula_ra: row.matricula_ra } : {}),
            ...(row.role !== 'aluno' ? { role: row.role } : {}),
          });
          while (!data.success && (data.code === 'RATE_LIMITED' || data.code === 'rate_limited') && attempt < RATE_LIMIT_RETRY_MAX) {
            attempt++;
            try {
              // Sleep abortável: sem isso, cancelar durante o backoff de 60s
              // demorava até 2min para de fato parar.
              await abortableSleep(RATE_LIMIT_RETRY_DELAY_MS, signal);
            } catch {
              break; // cancelado — mantém `data` (RATE_LIMITED) como resultado desta linha
            }
            data = await usersService.createUser({
            nome: row.nome,
            email: row.email,
            id_ies: batchIesId,
            semestre: row.semestre,
            ...(row.matricula_ra ? { matricula_ra: row.matricula_ra } : {}),
            ...(row.role !== 'aluno' ? { role: row.role } : {}),
          });
          }

          if (!data.success) {
            const message = data.message ? `${data.error}: ${data.message}` : (data.error ?? 'Erro desconhecido');
            return { email: row.email, nome: row.nome, linha: row.linha, matricula_ra: row.matricula_ra ?? undefined, papel: roleLabel(row.role), success: false, error: { code: data.code ?? 'INTERNAL_ERROR', message } };
          }
          return {
            email: row.email,
            nome: row.nome,
            linha: row.linha,
            matricula_ra: row.matricula_ra ?? undefined,
            papel: roleLabel(row.role),
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
          : { email: row.email, nome: row.nome, linha: row.linha, matricula_ra: row.matricula_ra ?? undefined, papel: roleLabel(row.role), success: false, error: { code: 'INTERNAL_ERROR', message: outcome.reason?.message || 'Erro inesperado' } };
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
    // Novo arquivo invalida a classificação de conflitos do dry-run anterior —
    // `runDryRun` recalcula antes do próximo `start`, mas o Set não deve
    // sobreviver a uma troca de arquivo enquanto isso não acontece.
    conflictEmailsRef.current = new Set();
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
      conflictEmailsRef.current = new Set();
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
                Colunas: <span className="font-mono">nome</span>, <span className="font-mono">email</span> (obrigatórias),{' '}
                <span className="font-mono">semestre</span> e <span className="font-mono">matricula_ra</span> (opcionais) e{' '}
                <span className="font-mono">papel</span> (em branco = aluno).
              </p>
              <p className="text-xs text-muted-foreground">
                Papéis aceitos: <span className="font-mono">{canManageRoles ? ROLE_VALUES_HINT : 'aluno'}</span>. Qualquer outro
                valor gera erro na linha.
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
            onReset={() => { actions.reset(); setFileName(null); setReport(null); conflictEmailsRef.current = new Set(); }}
            chunkSize={CHUNK_SIZE}
            confirmWord="CADASTRAR"
            title="Confirmar cadastro em lote"
            startLabel="Iniciar cadastro"
            unidadeLabel="usuário(s)"
            metricLabels={{ novos: 'Novos', atualizados: 'Atualizar', conflitos: 'Conflitos (outra IES)', erros: 'Erros' }}
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
