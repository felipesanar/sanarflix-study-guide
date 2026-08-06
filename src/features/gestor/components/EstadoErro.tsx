import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';

interface EstadoErroProps {
  titulo?: string;
  descricao?: string;
  /** Refaz APENAS a query deste bloco (spec §8.4). */
  onRetry: () => void;
  altura?: number | string;
  className?: string;
}

/**
 * Falha de um bloco, com retry local — a tela inteira continua utilizável.
 *
 * Copy e anatomia vêm da referência §9 ("Estados de dados"): tile CIRCULAR de
 * 36px com `error_outline-filled` a 18px, "Algo deu errado", a linha de apoio
 * que diz que o resto segue de pé e o botão "Tentar novamente" — só texto, sem
 * ícone. O título e a descrição são defaults e não overrides de cada chamador
 * de propósito: a gestora tem que ler a MESMA frase em qualquer bloco que
 * falhe, senão cada erro parece um problema diferente.
 */
export const EstadoErro: React.FC<EstadoErroProps> = ({
  titulo = 'Algo deu errado',
  descricao = 'Os demais componentes seguem disponíveis.',
  onRetry,
  altura,
  className,
}) => (
  <div
    role="alert"
    style={altura ? { minHeight: typeof altura === 'number' ? `${altura}px` : altura } : undefined}
    className={cn(
      'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center',
      className,
    )}
  >
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: 36,
        height: 36,
        borderRadius: 'var(--gp-radius-pill)',
        background: 'var(--gp-danger-surface)',
        color: 'var(--gp-danger-on)',
      }}
    >
      <Icon name="error_outline" variant="filled" size={18} />
    </span>
    <p className="text-sm font-medium text-foreground">{titulo}</p>
    {descricao && <p className="max-w-sm text-xs text-muted-foreground">{descricao}</p>}
    <Button
      variant="outline"
      size="sm"
      className="mt-1 h-auto rounded-sm px-3 py-1.5 text-[11px] font-semibold"
      onClick={onRetry}
    >
      Tentar novamente
    </Button>
  </div>
);
