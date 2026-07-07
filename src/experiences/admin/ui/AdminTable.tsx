import type { ReactNode } from 'react';
import { Table } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** Classe utilitária para `<TableHead>`: mono uppercase text-xs text-muted-foreground, densidade alta. */
export const adminTableHeadClass = 'h-9 px-3 font-mono text-xs uppercase tracking-wide text-muted-foreground';

/** Classe utilitária para `<TableCell>`: densidade alta (menos padding que o Table padrão). */
export const adminTableCellClass = 'px-3 py-2 text-sm';

export interface AdminTableProps {
  /** `<TableHeader>` + `<TableBody>` normais do shadcn — este wrapper não recria a tabela. */
  children: ReactNode;
  /** Barra acima da tabela (busca, filtros, seleção em massa). */
  toolbar?: ReactNode;
  /** Rodapé (paginação, contagem). */
  footer?: ReactNode;
  className?: string;
}

/**
 * Wrapper fino do Table shadcn com o vocabulário do console admin: container
 * `rounded-xl border`, cabeçalho mono uppercase (via `adminTableHeadClass`) e slots de
 * toolbar/rodapé. Uso: `<AdminTable toolbar={...}><TableHeader>...<TableBody>...</AdminTable>`,
 * aplicando `adminTableHeadClass`/`adminTableCellClass` nas células conforme necessário.
 */
export function AdminTable({ children, toolbar, footer, className }: AdminTableProps) {
  return (
    <div className="space-y-3">
      {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      <div className={cn('overflow-hidden rounded-xl border', className)}>
        <Table>{children}</Table>
      </div>
      {footer && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}
