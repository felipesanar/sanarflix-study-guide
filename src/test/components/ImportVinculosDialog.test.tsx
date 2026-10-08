import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const importarVinculos = vi.fn();
vi.mock('@/services/admin/mentores', () => ({
  importarVinculos: (...a: unknown[]) => importarVinculos(...a),
}));
const parseVinculosFile = vi.fn();
vi.mock('@/components/admin/mentores/parseVinculosFile', () => ({
  parseVinculosFile: (...a: unknown[]) => parseVinculosFile(...a),
}));

import { ImportVinculosDialog } from '@/components/admin/mentores/ImportVinculosDialog';

const base = {
  dry_run: true, total: 3, novos: 1, ja_com_este_mentor: 1,
  com_outro_mentor: [{ email: 'b@x.com', mentor_atual_id: 'm2', mentor_atual_nome: 'Letícia Lima' }],
  invalidos: [], inseridos: 0, trocados: 0,
};

const renderDialog = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ImportVinculosDialog open mentorId="m1" mentorNome="Thiago" onOpenChange={() => {}} />
    </QueryClientProvider>,
  );

describe('ImportVinculosDialog', () => {
  beforeEach(() => {
    importarVinculos.mockReset();
    parseVinculosFile.mockReset();
  });

  it('simula antes de aplicar e mostra quem já tem outro mentor', async () => {
    parseVinculosFile.mockResolvedValue([{ email: 'a@x.com' }, { email: 'b@x.com' }, { email: 'c@x.com' }]);
    importarVinculos.mockResolvedValue(base);
    renderDialog();

    const input = screen.getByLabelText('Planilha de alunos');
    fireEvent.change(input, { target: { files: [new File(['x'], 'alunos.xlsx')] } });

    await waitFor(() =>
      expect(importarVinculos).toHaveBeenCalledWith({ mentorId: 'm1', linhas: expect.any(Array), trocar: false, dryRun: true }),
    );
    expect(await screen.findByText(/b@x\.com/)).toBeInTheDocument();
    expect(screen.getByText(/Letícia Lima/)).toBeInTheDocument();
  });

  it('aplicar chama a RPC sem dry run, respeitando "trocar"', async () => {
    parseVinculosFile.mockResolvedValue([{ email: 'b@x.com' }]);
    importarVinculos.mockResolvedValueOnce(base).mockResolvedValueOnce({ ...base, dry_run: false, inseridos: 2, trocados: 1 });
    renderDialog();

    fireEvent.change(screen.getByLabelText('Planilha de alunos'), { target: { files: [new File(['x'], 'a.xlsx')] } });
    await screen.findByText(/b@x\.com/);

    fireEvent.click(screen.getByLabelText('Trocar o mentor de quem já tem outro'));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar importação' }));

    await waitFor(() =>
      expect(importarVinculos).toHaveBeenLastCalledWith({ mentorId: 'm1', linhas: expect.any(Array), trocar: true, dryRun: false }),
    );
    expect(await screen.findByText(/2 alunos vinculados/)).toBeInTheDocument();
  });
  it('segundo arquivo cuja simulação falha não deixa a simulação do primeiro habilitada', async () => {
    parseVinculosFile
      .mockResolvedValueOnce([{ email: 'a@x.com' }])
      .mockResolvedValueOnce([{ email: 'b@x.com' }]);
    importarVinculos
      .mockResolvedValueOnce(base)
      .mockRejectedValueOnce(new Error('Falha na simulação do arquivo B'));
    renderDialog();

    const input = screen.getByLabelText('Planilha de alunos');
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.xlsx')] } });
    await screen.findByText(/Letícia Lima/);
    expect(screen.getByRole('button', { name: 'Aplicar importação' })).toBeEnabled();

    fireEvent.change(input, { target: { files: [new File(['y'], 'b.xlsx')] } });
    expect(await screen.findByText('Falha na simulação do arquivo B')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar importação' })).toBeDisabled();
    expect(screen.queryByText(/Letícia Lima/)).not.toBeInTheDocument();
  });
});
