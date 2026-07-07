/**
 * Fatia B — Usuários: "Trocar e-mail em massa".
 *
 * Migrado para `useBulkRunner`/`BulkRunnerPanel` (contrato §B): preview
 * client-side (a edge `admin-bulk-update-email` NÃO tem `dry_run` — só valida
 * formato/duplicidade/cadeia no cliente, igual ao fluxo anterior; a validação
 * real de role protegida/colisão só acontece no servidor durante a execução),
 * chunk de 50 (limite da edge), cancelável entre chunks (correção do fluxo
 * anterior, que não permitia cancelar) e confirmação `DangerZone` nível alto
 * (via `confirmWord="IMPORTAR"` do próprio `BulkRunnerPanel`).
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Mail, ShieldAlert, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BulkRunnerPanel, useBulkRunner } from '@/experiences/admin/ui';
import { supabase } from '@/integrations/supabase/client';
import { usersService, type BulkEmailUpdateRowResult } from '@/services/usersService';

const MAX_CSV_ROWS = 500;
const CHUNK_SIZE = 50;
const CHUNK_DELAY_MS = 250;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Remove caracteres invisíveis/zero-width/bidi-control que passam despercebidos
// em copy-paste de planilhas (ex.: LRM no fim do email). Filtra por code point
// em vez de um literal de regex para não depender de caracteres não-imprimíveis
// no código-fonte.
const INVISIBLE_CHAR_RANGES: Array<[number, number]> = [
  [0x200b, 0x200f], // zero-width space/joiners, marcas LRM/RLM
  [0x202a, 0x202e], // controles de embutimento/override bidi
  [0x2060, 0x206f], // word joiner e afins
  [0xfeff, 0xfeff], // BOM / zero-width no-break space
];

function isInvisibleCodePoint(code: number): boolean {
  return INVISIBLE_CHAR_RANGES.some(([start, end]) => code >= start && code <= end);
}

function sanitizeEmail(raw: string): string {
  let cleaned = '';
  for (const ch of raw) {
    if (!isInvisibleCodePoint(ch.codePointAt(0) ?? 0)) cleaned += ch;
  }
  return cleaned.trim().toLowerCase();
}

interface EmailRow {
  email_antigo: string;
  email_novo: string;
  linha: number;
  erro?: string;
}

function parseCsv(text: string): EmailRow[] {
  const clean = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trim();
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw new Error('CSV vazio.');

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const idxOld = header.indexOf('email_antigo');
  const idxNew = header.indexOf('email_novo');
  if (idxOld === -1 || idxNew === -1) {
    throw new Error('Cabeçalho inválido. Esperado: email_antigo,email_novo');
  }

  const rows: EmailRow[] = [];
  const seenOld = new Set<string>();
  const seenNew = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const ea = sanitizeEmail(cols[idxOld] || '');
    const en = sanitizeEmail(cols[idxNew] || '');
    const row: EmailRow = { email_antigo: ea, email_novo: en, linha: i + 1 };
    if (!ea || !en) row.erro = 'Linha incompleta';
    else if (!EMAIL_RE.test(ea)) row.erro = 'email_antigo inválido';
    else if (!EMAIL_RE.test(en)) row.erro = 'email_novo inválido';
    else if (ea === en) row.erro = 'email_antigo igual ao email_novo';
    else if (seenOld.has(ea)) row.erro = 'email_antigo duplicado no CSV';
    else if (seenNew.has(en)) row.erro = 'email_novo duplicado no CSV';
    else {
      seenOld.add(ea);
      seenNew.add(en);
    }
    rows.push(row);
  }
  for (const r of rows) {
    if (!r.erro && seenOld.has(r.email_novo)) {
      r.erro = 'Cadeia detectada (novo aparece como antigo em outra linha)';
    }
  }
  if (rows.length > MAX_CSV_ROWS) {
    throw new Error(`CSV excede o limite de ${MAX_CSV_ROWS} linhas (encontrado ${rows.length}).`);
  }
  return rows;
}

async function parseEmailFile(file: File): Promise<EmailRow[]> {
  const text = await file.text();
  return parseCsv(text);
}

function downloadTemplate() {
  const content = 'email_antigo,email_novo\naluno.antigo@faculdade.edu.br,aluno.novo@faculdade.edu.br\n';
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
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runner = useBulkRunner<EmailRow>({
    parse: parseEmailFile,
    dryRun: async (rows) => {
      const erros = rows.filter((r) => r.erro).length;
      const detalhes = rows.map((r) =>
        r.erro ? { linha: r.linha, status: 'erro' as const, mensagem: r.erro } : { linha: r.linha, status: 'ok' as const },
      );
      return { total: rows.length, erros, detalhes };
    },
    execute: async (chunk) => {
      const invalid = chunk.filter((r) => r.erro);
      const valid = chunk.filter((r) => !r.erro);
      const falhas: Array<{ linha: number; mensagem: string }> = invalid.map((r) => ({ linha: r.linha, mensagem: r.erro! }));
      let ok = 0;

      if (valid.length > 0) {
        // Guard: sessão válida antes de disparar o invoke — sem isso um
        // refresh_token expirado faz o chunk inteiro falhar com erro genérico.
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData?.user) {
          throw new Error('Sua sessão expirou. Faça login novamente para continuar.');
        }

        const res = await usersService.bulkUpdateEmail(valid.map((r) => ({ email_antigo: r.email_antigo, email_novo: r.email_novo })));
        if (res.error === 'session_expired') {
          throw new Error('Sua sessão expirou durante o processamento. Faça login novamente.');
        }
        if (!res.success && (!res.results || res.results.length === 0)) {
          valid.forEach((r) => falhas.push({ linha: r.linha, mensagem: res.error || 'Falha ao atualizar e-mails' }));
        } else {
          const byOldEmail = new Map<string, BulkEmailUpdateRowResult>(res.results.map((r) => [r.email_antigo, r]));
          valid.forEach((r) => {
            const result = byOldEmail.get(r.email_antigo);
            if (result?.status === 'updated') ok++;
            else falhas.push({ linha: r.linha, mensagem: REASON_LABELS[result?.reason ?? ''] || result?.reason || 'Falha desconhecida' });
          });
        }
      }
      return { ok, falhas };
    },
    chunkSize: CHUNK_SIZE,
    interChunkDelayMs: CHUNK_DELAY_MS,
  });

  const { phase, rows, actions, error } = runner;

  // `loadFile` guarda erro de parsing no estado sem trocar de fase (fica em
  // 'idle', onde o BulkRunnerPanel não é renderizado) — sem isso, um CSV
  // inválido (cabeçalho errado, vazio) falharia silenciosamente.
  useEffect(() => {
    if (phase === 'idle' && error) toast.error(error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    await actions.loadFile(file);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const reset = () => {
    actions.reset();
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Comportamento e segurança</AlertTitle>
        <AlertDescription className="space-y-1 text-sm">
          <p>• <strong>Apenas alunos</strong> podem ter o email alterado — admins, gestores, professores e atendimento são bloqueados pelo servidor.</p>
          <p>• <strong>Nenhum dado é perdido</strong>: progresso, simulados, calendário e histórico são vinculados ao ID interno, não ao email.</p>
          <p>• O usuário recebe um email no <strong>novo endereço</strong> avisando a mudança. Todas as sessões ativas são encerradas.</p>
          <p>• Limite de <strong>{MAX_CSV_ROWS} linhas</strong> por CSV. Processado em lotes de {CHUNK_SIZE}.</p>
          <p>• Operação <strong>auditada</strong> em <code className="text-xs">admin_audit_log</code>.</p>
        </AlertDescription>
      </Alert>

      {phase === 'idle' && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Baixar modelo CSV
          </Button>
          <label className="inline-flex">
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onPickFile} />
            <Button asChild variant="default">
              <span>
                <Upload className="h-4 w-4 mr-2" /> Selecionar CSV
              </span>
            </Button>
          </label>
          {fileName && (
            <Badge variant="secondary" className="gap-1">
              <FileSpreadsheet className="h-3 w-3" /> {fileName}
            </Badge>
          )}
        </div>
      )}

      {phase === 'idle' && rows.length > 0 && (
        <div className="space-y-3">
          {/* Preview "atual → novo" — renderizado acima do BulkRunnerPanel (contrato §B.4). */}
          <div className="border rounded-lg overflow-auto max-h-72">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-2 w-12">#</th>
                  <th className="text-left p-2">Atual</th>
                  <th className="text-left p-2">Novo</th>
                  <th className="text-left p-2 w-48">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 text-muted-foreground">{r.linha}</td>
                    <td className="p-2 font-mono text-xs">{r.email_antigo}</td>
                    <td className="p-2 font-mono text-xs">{r.email_novo}</td>
                    <td className="p-2">
                      {r.erro ? (
                        <Badge variant="destructive" className="text-xs">{r.erro}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">OK</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 100 && (
              <div className="p-2 text-xs text-muted-foreground text-center bg-muted">Mostrando 100 de {rows.length} linhas</div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => actions.runDryRun()}>
              <Mail className="h-4 w-4 mr-2" /> Pré-visualizar ({rows.length} linha(s))
            </Button>
            <Button variant="ghost" onClick={reset}>Limpar</Button>
          </div>
        </div>
      )}

      {phase !== 'idle' && (
        <BulkRunnerPanel
          state={runner}
          onStart={actions.start}
          onCancel={actions.cancel}
          onReset={reset}
          chunkSize={CHUNK_SIZE}
          confirmWord="IMPORTAR"
          title="Confirmar atualização em lote"
          startLabel="Processar atualização"
          unidadeLabel="linha(s)"
          reportFileName={`relatorio_atualizacao_emails_${new Date().toISOString().slice(0, 10)}.xlsx`}
        />
      )}
    </div>
  );
};

export default BulkEmailUpdateTab;
