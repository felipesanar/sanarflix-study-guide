import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanaisTribo } from '../../mural-v2/CanaisTribo';

describe('Canais da tribo', () => {
  it('dois Enters seguidos salvam uma unica vez e liberam a trava apos erro', async () => {
    let rejeitar!: (erro: Error) => void;
    const onSalvar = vi.fn(() => new Promise((_, reject) => { rejeitar = reject; }));
    render(<CanaisTribo canais={[{ tipo: 'grupo_turma', url: 'https://chat.whatsapp.com/abc', editavel: true }]} carregando={false} erro={false} onTentarNovamente={vi.fn()} triboNome="Carcara" onSalvar={onSalvar} avisar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar link' }));
    const input = screen.getByRole('textbox', { name: 'Link do grupo da tribo' });
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(onSalvar).toHaveBeenCalledTimes(1);
    await act(async () => { rejeitar(new Error('Falha')); });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSalvar).toHaveBeenCalledTimes(2);
    await act(async () => { rejeitar(new Error('Falha')); });
  });
});
