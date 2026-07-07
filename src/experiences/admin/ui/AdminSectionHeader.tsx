import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface AdminSectionHeaderProps {
  /** Título principal da tela (H1). */
  title: string;
  /** Linha de contexto abaixo do título. */
  subtitle?: ReactNode;
  /** Slot de ações (botões) alinhado à direita. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão de toda tela do console admin: H1 + subtítulo muted + ações à direita.
 * Cada página do admin renderiza o próprio header (não há topbar global — ver AdminLayout).
 */
export function AdminSectionHeader({ title, subtitle, actions, className }: AdminSectionHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
