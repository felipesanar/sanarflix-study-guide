import type { ReactNode } from 'react';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminTable, adminTableCellClass, adminTableHeadClass } from '@/experiences/admin/ui/AdminTable';
import { MonoValue } from '@/experiences/admin/ui/MonoValue';
import { describeAuditEntry } from '@/services/admin/auditActions';
import type { AuditLogRow } from '@/services/admin/audit';

export interface AuditTableProps {
  rows: AuditLogRow[];
  toolbar?: ReactNode;
  footer?: ReactNode;
}

/** `metadata.ip` quando existir; nunca inventamos IP (a tabela não tem essa coluna). */
function auditIp(metadata: AuditLogRow['metadata']): string {
  const ip = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).ip : undefined;
  return typeof ip === 'string' && ip.trim() ? ip : '—';
}

/**
 * `created_at` formatado sempre em America/Sao_Paulo (independente do fuso do
 * navegador de quem está olhando) — sem isso, o mesmo evento mostra horários
 * diferentes para admins em fusos diferentes, sem qualquer indicação de qual é.
 */
const AUDIT_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function formatAuditTimestamp(iso: string): string {
  return AUDIT_TIMESTAMP_FORMATTER.format(new Date(iso));
}

/** Tabela paginada de `/admin/auditoria`: Ator · Ação · Alvo & detalhe · Quando · IP. */
export function AuditTable({ rows, toolbar, footer }: AuditTableProps) {
  return (
    <AdminTable toolbar={toolbar} footer={footer}>
      <TableHeader>
        <TableRow>
          <TableHead className={adminTableHeadClass}>Ator</TableHead>
          <TableHead className={adminTableHeadClass}>Ação</TableHead>
          <TableHead className={adminTableHeadClass}>Alvo & detalhe</TableHead>
          <TableHead className={adminTableHeadClass}>Quando</TableHead>
          <TableHead className={adminTableHeadClass}>IP</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const detail = describeAuditEntry(row.action, row.metadata);
          return (
            <TableRow key={row.id}>
              <TableCell className={adminTableCellClass}>
                <div className="font-medium">{row.admin_nome ?? '—'}</div>
                <MonoValue muted className="text-xs">
                  {row.admin_email ?? '—'}
                </MonoValue>
              </TableCell>
              <TableCell className={adminTableCellClass}>
                <MonoValue className="rounded-md bg-muted px-1.5 py-0.5 text-xs">{row.action}</MonoValue>
              </TableCell>
              <TableCell className={adminTableCellClass}>
                <div>{row.target_nome ?? '—'}</div>
                <MonoValue muted className="text-xs">
                  {row.target_email ?? '—'}
                </MonoValue>
                {detail && <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>}
              </TableCell>
              <TableCell className={adminTableCellClass}>
                <MonoValue muted>{formatAuditTimestamp(row.created_at)} (BRT)</MonoValue>
              </TableCell>
              <TableCell className={adminTableCellClass}>
                <MonoValue muted>{auditIp(row.metadata)}</MonoValue>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </AdminTable>
  );
}

export default AuditTable;
