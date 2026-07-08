import { useEffect, useId, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type DangerZoneLevel = 'medium' | 'high';

interface DangerZoneCommonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Resumo de impacto da ação (ex.: "N respostas serão recontabilizadas"). */
  impact: ReactNode;
  actionLabel: string;
  onConfirm: () => Promise<void> | void;
  /** Estado de carregamento controlado externamente (ex.: fase 'running' de um BulkRunner). Se omitido, o próprio componente controla enquanto `onConfirm` está em andamento. */
  loading?: boolean;
  /** Mostra "Esta ação fica registrada em auditoria." — true por padrão. */
  auditNote?: boolean;
  className?: string;
}

/**
 * `level="medium"`: resumo de impacto + botão âmbar, 1 clique (ex.: anular questão).
 * `level="high"`: resumo de impacto + input mono onde a palavra exata (`confirmWord`)
 * precisa ser digitada para armar o botão vermelho/destrutivo (ex.: excluir usuário).
 */
export type DangerZoneProps =
  | (DangerZoneCommonProps & { level: 'medium'; confirmWord?: undefined })
  | (DangerZoneCommonProps & { level: 'high'; confirmWord: string });

/** Confirmação proporcional ao risco, sobre AlertDialog shadcn. Nunca usar `window.confirm`. */
export function DangerZone({
  open,
  onOpenChange,
  title,
  impact,
  level,
  confirmWord,
  actionLabel,
  onConfirm,
  loading,
  auditNote = true,
  className,
}: DangerZoneProps) {
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Único por instância — evita colisão de id quando duas DangerZones estão montadas ao mesmo tempo.
  const confirmWordId = useId();

  // Zera o texto digitado sempre que o diálogo fecha.
  useEffect(() => {
    if (!open) setConfirmText('');
  }, [open]);

  const busy = loading ?? submitting;
  const isArmed = level === 'medium' || confirmText.trim() === confirmWord;

  const handleConfirm = async () => {
    if (!isArmed || busy) return;
    try {
      setSubmitting(true);
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Erro é responsabilidade do chamador (toast); mantém o diálogo aberto para nova tentativa.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <AlertDialogContent className={className}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <div className="text-sm text-foreground">{impact}</div>
              {level === 'high' && (
                <div className="space-y-1.5">
                  <Label htmlFor={confirmWordId} className="text-xs text-muted-foreground">
                    Digite <span className="font-mono font-semibold text-foreground">{confirmWord}</span> para confirmar
                  </Label>
                  <Input
                    id={confirmWordId}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                    placeholder={confirmWord}
                    className="font-mono"
                    autoComplete="off"
                    disabled={busy}
                  />
                </div>
              )}
              {auditNote && <p className="text-xs text-muted-foreground">Esta ação fica registrada em auditoria.</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            variant={level === 'high' ? 'destructive' : 'default'}
            className={cn(level === 'medium' && 'bg-amber-500 text-white hover:bg-amber-600')}
            disabled={!isArmed || busy}
            onClick={handleConfirm}
          >
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {actionLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
