import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AdminEmptyProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Ação opcional (ex.: botão "Criar o primeiro..."). */
  action?: ReactNode;
  className?: string;
}

/** Estado vazio padrão do console admin — ícone + título + descrição + ação opcional. */
export function AdminEmpty({ icon = <Inbox className="h-8 w-8" />, title, description, action, className }: AdminEmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 text-center',
        className,
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
