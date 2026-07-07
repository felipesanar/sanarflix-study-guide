import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface GestorPanelProps {
  /** Título curto do painel (sm, semibold). */
  title?: string;
  /** Subtítulo muted abaixo do título. */
  subtitle?: string;
  /** Ação/slot no canto direito do header (ex.: botão, badge). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Card padrão do console de Gestão: borda 1px, sem sombra pesada, header
 * opcional com título sm + subtítulo muted. Envelope fino sobre `Card`
 * shadcn — use para qualquer bloco de conteúdo das telas do gestor.
 */
export const GestorPanel: React.FC<GestorPanelProps> = ({
  title,
  subtitle,
  action,
  children,
  className,
  contentClassName,
}) => (
  <Card className={cn('shadow-none', className)}>
    {(title || subtitle || action) && (
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1">
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
    )}
    <CardContent className={cn(title || subtitle || action ? 'pt-0' : undefined, contentClassName)}>
      {children}
    </CardContent>
  </Card>
);
