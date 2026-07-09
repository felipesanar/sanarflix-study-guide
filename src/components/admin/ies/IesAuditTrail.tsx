import * as React from 'react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { useAuditLog, type AuditLogRow } from '@/services/admin/audit';
import { describeAuditEntry } from '@/services/admin/auditActions';

export interface IesAuditTrailProps {
  iesId: string;
  /** Só busca (`enabled`) quando o "Histórico" do card está aberto. */
  open: boolean;
}

function auditIesId(metadata: AuditLogRow['metadata']): string | undefined {
  return (metadata as { ies_id?: string } | null)?.ies_id;
}

function auditChanges(metadata: AuditLogRow['metadata']): Record<string, boolean> {
  const changes = (metadata as { changes?: Record<string, boolean> } | null)?.changes;
  return changes && typeof changes === 'object' ? changes : {};
}

/**
 * Trilha de auditoria de uma IES — reaproveita `useAuditLog` filtrando
 * `action: 'ies_features_update'` no servidor e `metadata.ies_id` no
 * client (a RPC não filtra por IES). Mostra até 10 linhas mais recentes.
 */
export const IesAuditTrail: React.FC<IesAuditTrailProps> = ({ iesId, open }) => {
  const { data, isLoading } = useAuditLog({ action: 'ies_features_update', limit: 100 }, { enabled: open });

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    return all.filter((row) => auditIesId(row.metadata) === iesId).slice(0, 10);
  }, [data, iesId]);

  if (!open) return null;

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Carregando histórico...</p>;
  }

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem alterações registradas.</p>;
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      {rows.map((row) => {
        const changes = auditChanges(row.metadata);
        const description = describeAuditEntry(row.action, row.metadata);
        return (
          <div key={row.id} className="space-y-1 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
              <span>{new Date(row.created_at).toLocaleString('pt-BR')}</span>
              <span>{row.admin_nome ?? '—'}</span>
            </div>
            {description && <p className="text-muted-foreground">{description}</p>}
            <div className="flex flex-wrap gap-1">
              {Object.entries(changes).map(([key, value]) => (
                <Badge key={key} variant={value ? 'default' : 'secondary'} className="text-[10px] font-normal">
                  {key}: {value ? 'on' : 'off'}
                </Badge>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
