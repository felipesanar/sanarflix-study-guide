/** Toast da tela (docs/01 § Padrões): embaixo no centro, some em 3,2 s, `role="status"`. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/features/gestor/components/Icon';

export const DURACAO_TOAST_MS = 3200;
export interface Toast { texto: string; tipo: 'sucesso' | 'erro' }

export function useToastTurma() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const mostrar = useCallback((texto: string, tipo: Toast['tipo'] = 'sucesso') => {
    clearTimeout(timer.current);
    setToast({ texto, tipo });
    timer.current = setTimeout(() => setToast(null), DURACAO_TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, mostrar };
}

/** A região viva fica sempre montada, para o leitor de tela anunciar a troca de texto. */
export function ToastTurma({ toast }: { toast: Toast | null }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-6 z-50 flex justify-center">
      {toast ? (
        <span className="inline-flex max-w-full items-center gap-2 rounded-[10px] bg-[var(--gp-text-1)] px-4 py-2.5 text-[13.5px] text-white"
          style={{ boxShadow: '0 12px 32px -12px rgba(0,0,0,0.4)' }}>
          <Icon name={toast.tipo === 'erro' ? 'error_outline' : 'check'} size={16} />
          <span>{toast.texto}</span>
        </span>
      ) : null}
    </div>
  );
}
