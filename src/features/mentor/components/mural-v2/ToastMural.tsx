import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/features/gestor/components/Icon';

/** Toast de sucesso do portal (docs/01 § Padrões): embaixo no centro, some em 3,2 s, `role="status"`. */
export const DURACAO_TOAST_MS = 3200;

export function useToastMural() {
  const [toast, setToast] = useState<{ texto: string; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mostrar = useCallback((texto: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ texto, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), DURACAO_TOAST_MS);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { toast, mostrar };
}

export function ToastMural({ toast }: { toast: { texto: string; id: number } | null }) {
  // A região viva fica sempre montada: leitores de tela anunciam a troca de texto.
  return (
    <div className="mural-toast-regiao" role="status" aria-live="polite">
      {toast && (
        <span key={toast.id} className="mural-toast">
          <Icon name="check" size={15} />
          {toast.texto}
        </span>
      )}
    </div>
  );
}
