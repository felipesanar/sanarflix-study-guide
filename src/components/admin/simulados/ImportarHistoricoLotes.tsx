import { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminTable,
  adminTableCellClass,
  adminTableHeadClass,
  MonoValue,
  StatusPill,
} from '@/experiences/admin/ui';
import type { StatusPillVariant } from '@/experiences/admin/ui';
import { REASON_LABEL } from './importar-respostas-types';

interface BatchRow {
  id: string;
  simulado_id: string;
  simulado_nome: string;
  source_label: string;
  conflict_mode: string;
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  replaced_count: number;
  failed_count: number;
  status: string;
  created_by: string;
  created_by_email: string;
  created_at: string;
  finished_at: string | null;
}

function batchStatusDisplay(batch: BatchRow): { label: string; variant: StatusPillVariant } {
  if (batch.status === 'failed') return { label: 'Falhou', variant: 'red' };
  if (batch.status === 'in_progress') return { label: 'Em andamento', variant: 'blue' };
  if (batch.failed_count > 0) return { label: 'Parcial', variant: 'amber' };
  return { label: 'Concluído', variant: 'emerald' };
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export interface ImportarHistoricoLotesProps {
  /** Muda quando uma nova importação termina, para disparar recarga automática. */
  refreshKey: string | null;
}

/** Histórico "Últimos lotes" — sempre visível (RPC `admin_list_import_batches` já existente). */
export function ImportarHistoricoLotes({ refreshKey }: ImportarHistoricoLotesProps) {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('admin_list_import_batches', { p_limit: 50 });
      if (rpcErr) throw rpcErr;
      setBatches((data ?? []) as BatchRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar histórico.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleDownload = async (batch: BatchRow) => {
    setDownloadingId(batch.id);
    try {
      const { data, error: rpcErr } = await supabase.rpc('admin_get_batch_records', { p_batch_id: batch.id });
      if (rpcErr) throw rpcErr;
      const rows = ((data ?? []) as Array<{ email: string; status: string; reason: string | null }>).map((r) => ({
        email: r.email,
        status: r.status,
        motivo: r.reason ? REASON_LABEL[r.reason] || r.reason : '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
      const safeName = batch.simulado_nome.replace(/[^\w]/g, '_').slice(0, 40);
      XLSX.writeFile(wb, `import-${safeName}-${batch.id.slice(0, 8)}.xlsx`);
      toast.success('Relatório baixado', { description: `${rows.length} linha(s)` });
    } catch (err) {
      toast.error('Erro ao baixar relatório', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Últimos lotes</h2>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
          Atualizar
        </Button>
      </div>

      {loading ? (
        <AdminLoading rows={3} />
      ) : error ? (
        <AdminError message={error} onRetry={load} />
      ) : batches.length === 0 ? (
        <AdminEmpty title="Nenhuma importação registrada" description="Os lotes processados aparecerão aqui." />
      ) : (
        <AdminTable>
          <TableHeader>
            <TableRow>
              <TableHead className={adminTableHeadClass}>Quando</TableHead>
              <TableHead className={adminTableHeadClass}>Simulado</TableHead>
              <TableHead className={adminTableHeadClass}>Ok / Linhas</TableHead>
              <TableHead className={adminTableHeadClass}>Modo</TableHead>
              <TableHead className={adminTableHeadClass}>Status</TableHead>
              <TableHead className={adminTableHeadClass}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((b) => {
              const status = batchStatusDisplay(b);
              const ok = b.imported_count + b.replaced_count;
              return (
                <TableRow key={b.id}>
                  <TableCell className={adminTableCellClass}>
                    <MonoValue>{formatDate(b.created_at)}</MonoValue>
                  </TableCell>
                  <TableCell className={cn(adminTableCellClass, 'max-w-[220px] truncate')} title={b.simulado_nome}>
                    {b.simulado_nome}
                  </TableCell>
                  <TableCell className={adminTableCellClass}>
                    <MonoValue>
                      {ok}/{b.total_rows}
                    </MonoValue>{' '}
                    ok
                  </TableCell>
                  <TableCell className={adminTableCellClass}>{b.conflict_mode === 'skip' ? 'Pular' : 'Substituir'}</TableCell>
                  <TableCell className={adminTableCellClass}>
                    <StatusPill variant={status.variant}>{status.label}</StatusPill>
                  </TableCell>
                  <TableCell className={adminTableCellClass}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(b)}
                      disabled={downloadingId === b.id}
                      title="Baixar relatório do lote"
                    >
                      {downloadingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </AdminTable>
      )}
    </div>
  );
}
