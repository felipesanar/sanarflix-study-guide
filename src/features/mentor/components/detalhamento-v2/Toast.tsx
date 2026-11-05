import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';

/** Toast de sucesso do portal (docs/01 § Padrões): embaixo no centro, `#111212`/branco, raio 10, some em 3,2 s. */
export const DURACAO_TOAST_MS = 3200;

export function useToast() {
  const [mensagem, setMensagem] = React.useState<{ texto: string; id: number } | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>();
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const mostrar = React.useCallback((texto: string) => {
    clearTimeout(timer.current);
    setMensagem({ texto, id: Date.now() });
    timer.current = setTimeout(() => setMensagem(null), DURACAO_TOAST_MS);
  }, []);
  return { mensagem: mensagem?.texto ?? null, mostrar };
}

/** A região `role="status"` fica sempre montada: leitor de tela anuncia a troca do texto. */
export function Toast({ mensagem }: { mensagem: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-6 z-[60] flex justify-center"
    >
      {mensagem ? (
        <span
          data-testid="toast-detalhamento"
          className="inline-flex max-w-full items-center gap-2"
          style={{
            background: '#111212',
            color: '#FFFFFF',
            borderRadius: 10,
            padding: '10px 16px',
            fontSize: 13.5,
            boxShadow: '0 12px 32px -12px rgba(0,0,0,0.4)',
          }}
        >
          <Icon name="check" size={16} className="shrink-0" />
          {mensagem}
        </span>
      ) : null}
    </div>
  );
}
