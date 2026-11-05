import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/features/gestor/components/Icon';

/** Duração do toast (docs/01 § Padrões: some em 3,2 s). */
export const DURACAO_TOAST_MS = 3200;

/** Toast da tela: um por vez; o novo substitui o anterior e reinicia o relógio. */
export function useToastCanais() {
  const [mensagem, setMensagem] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mostrar = useCallback((texto: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMensagem(texto);
    timer.current = setTimeout(() => setMensagem(null), DURACAO_TOAST_MS);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { mensagem, mostrar };
}

/** Embaixo no centro, fundo escuro, raio 10, 13,5px, ícone check, `role="status"` (docs/01). */
export function ToastCanais({ mensagem }: { mensagem: string | null }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {mensagem ? (
        <span
          className="inline-flex max-w-full items-center gap-2 rounded-[10px] px-4 py-2.5 text-[13.5px] font-medium"
          style={{ background: 'var(--gp-text-1)', color: 'var(--gp-surface-1)', boxShadow: '0 12px 32px -12px rgba(0,0,0,0.4)' }}
        >
          <Icon name="check" size={15} />
          <span className="min-w-0 break-words">{mensagem}</span>
        </span>
      ) : null}
    </div>
  );
}
