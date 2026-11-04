import { afterEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DURACAO_TOAST_MS, useToast } from '../Toast';

function Demo() {
  const toast = useToast();
  return <><button type="button" onClick={() => toast.mostrar('Sessão salva')}>disparar</button>{toast.elemento}</>;
}

afterEach(() => { vi.useRealTimers(); });

it('toast role="status" some depois de 3,2 s', () => {
  vi.useFakeTimers();
  render(<Demo />);
  fireEvent.click(screen.getByRole('button', { name: 'disparar' }));
  expect(screen.getByRole('status')).toHaveTextContent('Sessão salva');
  expect(DURACAO_TOAST_MS).toBe(3200);
  act(() => { vi.advanceTimersByTime(3199); });
  expect(screen.getByRole('status')).toHaveTextContent('Sessão salva');
  act(() => { vi.advanceTimersByTime(1); });
  expect(screen.queryByText('Sessão salva')).not.toBeInTheDocument();
});
