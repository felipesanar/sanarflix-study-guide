import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';

export type TomToast = 'ok' | 'erro';
export interface EstadoToast { id: number; texto: string; tom: TomToast }
export type MostrarToast = (texto: string, tom?: TomToast) => void;

/** Toast de docs/01: some em 3,2 s. */
export const DURACAO_TOAST_MS = 3200;

export function useToast(): { toast: EstadoToast | null; mostrar: MostrarToast } {
  const [toast, setToast] = React.useState<EstadoToast | null>(null);
  const seq = React.useRef(0);
  React.useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), DURACAO_TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);
  const mostrar = React.useCallback<MostrarToast>((texto, tom = 'ok') => {
    seq.current += 1;
    setToast({ id: seq.current, texto, tom });
  }, []);
  return { toast, mostrar };
}

const CLASSE =
  'fixed bottom-6 left-1/2 z-[60] flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2.5 rounded-[10px] bg-[var(--gp-text-1)] px-4 py-3 text-[13.5px] text-[var(--gp-surface-1)] shadow-[0_12px_32px_-12px_rgba(0,0,0,0.4)]';

/**
 * A região `role="status"` fica sempre montada (o leitor de tela só anuncia mudança em região que já
 * existia); erro entra como `role="alert"`. Dentro do drawer, o drawer monta a própria cópia, porque o
 * modal esconde o resto da página da árvore de acessibilidade.
 */
export function Toast({ toast }: { toast: EstadoToast | null }) {
  return (
    <>
      <div role="status" aria-live="polite">
        {toast?.tom === 'ok' ? (
          <div key={toast.id} className={CLASSE}>
            <Icon name="check" size={16} />
            {toast.texto}
          </div>
        ) : null}
      </div>
      {toast?.tom === 'erro' ? (
        <div key={toast.id} role="alert" className={CLASSE}>
          <Icon name="error_outline" size={16} />
          {toast.texto}
        </div>
      ) : null}
    </>
  );
}
