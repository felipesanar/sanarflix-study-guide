import type { ReactNode } from 'react';
import { format } from 'date-fns';
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
                <MonoValue muted>{format(new Date(row.created_at), 'dd/MM/yyyy HH:mm:ss')}</MonoValue>
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
