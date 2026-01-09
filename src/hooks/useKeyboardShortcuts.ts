import { useEffect, useCallback } from 'react';

type KeyAction = () => void;

interface KeyboardShortcuts {
  '1'?: KeyAction;
  '2'?: KeyAction;
  '3'?: KeyAction;
  '4'?: KeyAction;
  'ArrowLeft'?: KeyAction;
  'ArrowRight'?: KeyAction;
  'f'?: KeyAction;
  'F'?: KeyAction;
  'Escape'?: KeyAction;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventInInputs?: boolean;
}

/**
 * Hook para gerenciar atalhos de teclado
 * 
 * Atalhos disponíveis no Modo Prova:
 * - 1/2/3/4: Selecionar alternativas A/B/C/D
 * - ←/→: Navegar entre questões
 * - F: Marcar/desmarcar para revisão
 * - Esc: Abrir dialog de finalização
 */
export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcuts,
  options: UseKeyboardShortcutsOptions = {}
) => {
  const { enabled = true, preventInInputs = true } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Ignora se estiver em inputs
    if (preventInInputs) {
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
    }

    const key = event.key;
    const action = shortcuts[key as keyof KeyboardShortcuts];

    if (action) {
      event.preventDefault();
      action();
    }
  }, [enabled, preventInInputs, shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

/**
 * Mapeamento de teclas para letras de alternativas
 */
export const KEY_TO_ALTERNATIVE: Record<string, 'A' | 'B' | 'C' | 'D'> = {
  '1': 'A',
  '2': 'B',
  '3': 'C',
  '4': 'D',
};
