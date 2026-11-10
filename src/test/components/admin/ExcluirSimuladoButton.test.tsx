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

  it('mais de 5 respondentes: botão desativado e aviso', async () => {
    check.mockResolvedValue({ ...base, deletable: false, alunos: 6, respostas: 600 });
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
    expect(del).toHaveBeenCalledWith('s1', []);
  });

  it('3 respondentes: mostra lista e envia os IDs confirmados', async () => {
    const respondentes = ['u1', 'u2', 'u3'].map((id) => ({ user_id: id, nome: `Pessoa ${id}`, email: `${id}@x.com`, ies: 'B2B', roles: ['admin'], ultima_atividade: null }));
    check.mockResolvedValue({ ...base, deletable: true, modo: 'revisao', alunos: 3, respostas: 300, respondentes });
    del.mockResolvedValue(undefined);
    render(<ExcluirSimuladoButton simuladoId="s1" simuladoNome="T" onDeleted={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /excluir simulado/i });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    await screen.findByTestId('lista-respondentes');
    expect(screen.getByText('Pessoa u2')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nome do simulado'), { target: { value: 'T' } });
    fireEvent.click(screen.getByRole('button', { name: /excluir de vez/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('s1', ['u1', 'u2', 'u3']));
  });
});
