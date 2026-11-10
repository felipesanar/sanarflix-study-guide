import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const check = vi.fn();
const del = vi.fn();
vi.mock('@/services/admin/simulados', () => ({
  checkSimuladoDeletable: (...a: unknown[]) => check(...a),
  deleteSimulado: (...a: unknown[]) => del(...a),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ExcluirSimuladoButton from '@/components/admin/simulados/ExcluirSimuladoButton';

const base = { respostas: 0, filhos: 0, tri_alunos: 0, tri_ies: 0 };

describe('ExcluirSimuladoButton', () => {
  beforeEach(() => { check.mockReset(); del.mockReset(); });

  it('simulado com respostas: botão desativado e aviso', async () => {
    check.mockResolvedValue({ ...base, deletable: false, alunos: 12, respostas: 1200 });
    render(<ExcluirSimuladoButton simuladoId="s1" simuladoNome="Teste" onDeleted={vi.fn()} />);
    await screen.findByTestId('excluir-bloqueado');
    expect(screen.getByRole('button', { name: /excluir simulado/i })).toBeDisabled();
  });

  it('sem respostas: exige nome digitado antes de excluir', async () => {
    check.mockResolvedValue({ ...base, deletable: true, alunos: 0 });
    del.mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(<ExcluirSimuladoButton simuladoId="s1" simuladoNome="Teste X" onDeleted={onDeleted} />);
    const btn = screen.getByRole('button', { name: /excluir simulado/i });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    const confirmar = await screen.findByRole('button', { name: /excluir de vez/i });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nome do simulado'), { target: { value: 'Teste X' } });
    fireEvent.click(confirmar);
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(del).toHaveBeenCalledWith('s1');
  });
});
