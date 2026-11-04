import { afterEach, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { DURACAO_TOAST_MS, Toast, useToast } from '../Toast';

afterEach(() => { vi.useRealTimers(); });

it('toast some em 3,2 s e uma nova mensagem reinicia o prazo', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useToast());
  act(() => result.current.mostrar('Primeira'));
  expect(result.current.mensagem).toBe('Primeira');
  act(() => { vi.advanceTimersByTime(DURACAO_TOAST_MS - 100); });
  act(() => result.current.mostrar('Segunda'));
  act(() => { vi.advanceTimersByTime(DURACAO_TOAST_MS - 100); });
  expect(result.current.mensagem).toBe('Segunda');
  act(() => { vi.advanceTimersByTime(100); });
  expect(result.current.mensagem).toBeNull();
  expect(DURACAO_TOAST_MS).toBe(3200);
});

it('região role="status" fica montada mesmo sem mensagem', () => {
  const { rerender } = render(<Toast mensagem={null} />);
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  rerender(<Toast mensagem="Sessão salva" />);
  expect(screen.getByRole('status')).toHaveTextContent('Sessão salva');
});
