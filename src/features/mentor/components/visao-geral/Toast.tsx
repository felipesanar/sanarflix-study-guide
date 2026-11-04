import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/features/gestor/components/Icon';

/** docs/01 § Padrões: toast embaixo no centro, `#111212`/branco, raio 10, 13.5px, check, some em 3,2 s. */
export const DURACAO_TOAST_MS = 3200;

export function useToast(): { mostrar: (mensagem: string) => void; elemento: ReactNode } {
  const [mensagem, setMensagem] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const mostrar = useCallback((m: string) => {
    clearTimeout(timer.current);
    setMensagem(m);
    timer.current = setTimeout(() => setMensagem(null), DURACAO_TOAST_MS);
  }, []);
  const elemento = mensagem ? (
    <div role="status" aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[60] flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2.5 rounded-[10px] px-4 py-3 text-[13.5px]"
      style={{ background: 'var(--gp-text-1)', color: 'var(--gp-surface-1)', boxShadow: '0 12px 32px -12px rgba(0,0,0,0.4)' }}>
      <Icon name="check" size={16} />
      <span>{mensagem}</span>
    </div>
  ) : null;
  return { mostrar, elemento };
}
