import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface GestorPanelProps {
  /** Título curto do painel (sm, semibold). */
  title?: string;
  /** Subtítulo muted abaixo do título. */
  subtitle?: string;
  /** Ícone opcional exibido em container tintado antes do título/subtítulo. */
  icon?: LucideIcon;
  /** Ação/slot no canto direito do header (ex.: botão, badge). */
  action?: React.ReactNode;
  /**
   * Quando `true`, aplica `card-premium` (hover translateY(-2px) automático)
   * — use em painéis clicáveis/navegáveis. Quando `false` (padrão), aplica
   * `card-premium-static` (mesma moldura, sem hover-lift) — a maioria dos
   * painéis do console não é clicável. @default false
   */
  hoverLift?: boolean;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Card padrão do console de Gestão: moldura premium (`card-premium` ou
 * `card-premium-static`, conforme `hoverLift`), header opcional com ícone
 * tintado + título sm + subtítulo muted. Envelope fino sobre `Card` shadcn —
 * use para qualquer bloco de conteúdo das telas do gestor.
 */
export const GestorPanel: React.FC<GestorPanelProps> = ({
  title,
  subtitle,
  icon: Icon,
  action,
  hoverLift = false,
  children,
  className,
  contentClassName,
}) => (
  <Card className={cn(hoverLift ? 'card-premium' : 'card-premium-static', className)}>
    {(title || subtitle || action) && (
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
          <div className="space-y-1">
            {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
    )}
    <CardContent className={cn(title || subtitle || action ? 'pt-0' : undefined, contentClassName)}>
      {children}
    </CardContent>
  </Card>
);
