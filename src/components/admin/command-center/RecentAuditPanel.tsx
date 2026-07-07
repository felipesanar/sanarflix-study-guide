import * as React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdminEmpty, MonoValue } from '@/experiences/admin/ui';
import type { AdminCommandCenterPayload } from '@/services/admin/useAdminAttention';
import { describeAuditEntry } from '@/services/admin/auditActions';

export interface RecentAuditPanelProps {
  auditRecentes: AdminCommandCenterPayload['audit_recentes'];
}

interface HumanizedEntry {
  id: string;
  createdAt: string;
  adminNome: string;
  targetEmail: string | null;
  description: string;
}

function humanize(rows: AdminCommandCenterPayload['audit_recentes']): HumanizedEntry[] {
  return rows.flatMap((row) => {
    const description = describeAuditEntry(row.action, row.metadata);
    if (!description) return [];
    return [
      {
        id: row.id,
        createdAt: row.created_at,
        adminNome: row.admin_nome,
        targetEmail: row.target_email,
        description,
      },
    ];
  });
}

/**
 * Painel "Auditoria recente" (contrato §A) — últimos eventos de
 * `admin_command_center().audit_recentes` humanizados via
 * `describeAuditEntry` (ruído `view_*`/ações sem mapeamento é filtrado) +
 * timestamp relativo + link "Ver tudo" para `/admin/auditoria`.
 */
export const RecentAuditPanel: React.FC<RecentAuditPanelProps> = ({ auditRecentes }) => {
  const entries = humanize(auditRecentes);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 lg:col-span-1"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Auditoria recente</h2>
        <Link to="/admin/auditoria" className="text-xs font-medium text-primary hover:underline">
          Ver tudo
        </Link>
      </div>

      {entries.length === 0 ? (
        <AdminEmpty title="Nenhum evento recente" description="Ações administrativas aparecem aqui." />
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="space-y-0.5 border-b border-dashed pb-3 last:border-0 last:pb-0">
              <p className="text-sm">
                <span className="font-medium">{entry.adminNome}</span> {entry.description}
                {entry.targetEmail && (
                  <>
                    {' · '}
                    <MonoValue muted>{entry.targetEmail}</MonoValue>
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(entry.createdAt), { locale: ptBR, addSuffix: true })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
};
