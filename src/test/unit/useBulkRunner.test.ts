import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useBulkRunner } from '@/experiences/admin/ui/useBulkRunner';
import type { PreviewStats } from '@/experiences/admin/ui/bulk-types';

interface Row {
  linha: number;
  email: string;
}

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({ linha: i + 1, email: `user${i + 1}@exemplo.com` }));
}

const previewStats: PreviewStats = {
  total: 3,
  novos: 3,
  erros: 0,
  detalhes: [],
};

describe('experiences/admin/ui/useBulkRunner', () => {
  it('parte em idle, sem linhas', () => {
    const { result } = renderHook(() =>
      useBulkRunner<Row>({
        dryRun: vi.fn(),
        execute: vi.fn(),
        chunkSize: 50,
      }),
    );
    expect(result.current.phase).toBe('idle');
    expect(result.current.rows).toEqual([]);
    expect(result.current.progress).toEqual({ done: 0, total: 0 });
  });

  it('setRows carrega as linhas e runDryRun preenche previewStats', async () => {
    const dryRun = vi.fn().mockResolvedValue(previewStats);
    const { result } = renderHook(() =>
      useBulkRunner<Row>({ dryRun, execute: vi.fn(), chunkSize: 50 }),
    );

    act(() => result.current.actions.setRows(makeRows(3)));
    expect(result.current.rows).toHaveLength(3);

    await act(async () => {
      await result.current.actions.runDryRun();
    });

    expect(dryRun).toHaveBeenCalledWith(makeRows(3));
    expect(result.current.phase).toBe('preview');
    expect(result.current.previewStats).toEqual(previewStats);
  });

  it('start processa em chunks e agrega ok/falhas no resultado final (done com falhas>0)', async () => {
    const rows = makeRows(5); // chunkSize 2 => chunks [1,2] [3,4] [5]
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ ok: 2, falhas: [] })
      .mockResolvedValueOnce({ ok: 1, falhas: [{ linha: 4, mensagem: 'e-mail inválido' }] })
      .mockResolvedValueOnce({ ok: 1, falhas: [] });

    const { result } = renderHook(() =>
      useBulkRunner<Row>({ dryRun: vi.fn(), execute, chunkSize: 2 }),
    );

    act(() => result.current.actions.setRows(rows));

    await act(async () => {
      await result.current.actions.start();
    });

    expect(execute).toHaveBeenCalledTimes(3);
    expect(result.current.phase).toBe('done');
    expect(result.current.progress).toEqual({ done: 5, total: 5 });
    expect(result.current.result).toEqual({
      ok: 4,
      falhas: 1,
      canceladas: 0,
      itens: [{ linha: 4, status: 'erro', mensagem: 'e-mail inválido' }],
    });
  });

  it('cancel() interrompe entre chunks e marca canceladas', async () => {
    const rows = makeRows(6); // chunkSize 2 => 3 chunks
    let callCount = 0;
    const { result } = renderHook(() =>
      useBulkRunner<Row>({
        dryRun: vi.fn(),
        // Cancela depois do 1º chunk, antes do 2º ser processado.
        execute: vi.fn().mockImplementation(async () => {
          callCount += 1;
          if (callCount === 1) {
            result.current.actions.cancel();
          }
          return { ok: 2, falhas: [] };
        }),
        chunkSize: 2,
      }),
    );

    act(() => result.current.actions.setRows(rows));

    await act(async () => {
      await result.current.actions.start();
    });

    await waitFor(() => expect(result.current.phase).toBe('cancelled'));
    expect(callCount).toBe(1);
    expect(result.current.result).toEqual({
      ok: 2,
      falhas: 0,
      canceladas: 4,
      itens: [],
    });
  });

  it('reset() volta tudo para idle', async () => {
    const dryRun = vi.fn().mockResolvedValue(previewStats);
    const { result } = renderHook(() =>
      useBulkRunner<Row>({ dryRun, execute: vi.fn(), chunkSize: 50 }),
    );

    act(() => result.current.actions.setRows(makeRows(3)));
    await act(async () => {
      await result.current.actions.runDryRun();
    });
    expect(result.current.phase).toBe('preview');

    act(() => result.current.actions.reset());

    expect(result.current.phase).toBe('idle');
    expect(result.current.rows).toEqual([]);
    expect(result.current.previewStats).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('erro no dryRun leva a phase error com mensagem', async () => {
    const dryRun = vi.fn().mockRejectedValue(new Error('RPC indisponível'));
    const { result } = renderHook(() =>
      useBulkRunner<Row>({ dryRun, execute: vi.fn(), chunkSize: 50 }),
    );

    act(() => result.current.actions.setRows(makeRows(2)));
    await act(async () => {
      await result.current.actions.runDryRun();
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('RPC indisponível');
  });
});
