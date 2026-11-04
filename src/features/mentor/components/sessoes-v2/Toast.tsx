import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/features/gestor/components/Icon';

/** Docs/01 § Padrões: toast embaixo no centro, some em 3,2 s, `role="status"`. */
export const DURACAO_TOAST_MS = 3200;

export function useToast() {
  const [mensagem, setMensagem] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const mostrar = useCallback((texto: string) => {
    clearTimeout(timer.current);
    setMensagem(texto);
    timer.current = setTimeout(() => setMensagem(null), DURACAO_TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { mensagem, mostrar };
}

/** A região `role="status"` fica sempre montada para o leitor de tela anunciar cada mensagem. */
export function Toast({ mensagem }: { mensagem: string | null }) {
  return (
    <div role="status" aria-live="polite" className="ms-toast-regiao" data-testid="toast-sessoes">
      {mensagem && (
        <div className="ms-toast">
          <Icon name="check" size={16} />
          <span>{mensagem}</span>
        </div>
      )}
    </div>
  );
}
