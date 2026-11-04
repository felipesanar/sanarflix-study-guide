import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const IES_B2B = '9f21b138-0027-44c8-9660-dc6706d57bc0';
const IES_B2C = 'abec7c7d-ef07-4871-9e19-090f4d951e5e';

const iesRows = [
  { id: IES_B2B, nome: 'B2B' },
  { id: IES_B2C, nome: 'B2C' },
  { id: 'ies-normal', nome: 'Faculdade Normal' },
];
const maybeSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      if (tabela === 'ies') {
        return { select: () => ({ order: () => Promise.resolve({ data: iesRows, error: null }) }) };
      }
      if (tabela === 'users') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) };
      }
      throw new Error(`tabela inesperada: ${tabela}`);
    },
  },
}));

const createUser = vi.fn();
vi.mock('@/services/usersService', () => ({
  usersService: { createUser: (...a: unknown[]) => createUser(...a) },
}));
const upsertMentor = vi.fn();
vi.mock('@/services/admin/mentores', () => ({
  upsertMentor: (...a: unknown[]) => upsertMentor(...a),
}));

import { CreateMentorDialog } from '@/components/admin/mentores/CreateMentorDialog';

const renderDialog = (onOpenChange = vi.fn()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CreateMentorDialog open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );

const preencher = () => {
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Thiago' } });
  fireEvent.change(screen.getByLabelText('E-mail de login'), { target: { value: 'Thiago@x.com' } });
  fireEvent.change(screen.getByLabelText('Nome da turma'), { target: { value: 'Tribo Carcará' } });
};

describe('CreateMentorDialog', () => {
  beforeEach(() => {
    // Radix Select precisa de scrollIntoView/hasPointerCapture, ausentes no jsdom.
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.scrollIntoView = vi.fn();
    maybeSingle.mockReset();
    createUser.mockReset();
    upsertMentor.mockReset();
    maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('no B2B oferece as IES normais e nunca as internas "B2B" e "B2C"', async () => {
    renderDialog();

    fireEvent.click(screen.getAllByRole('combobox')[0]); // Tipo
    fireEvent.click(await screen.findByRole('option', { name: 'B2B (Visão Geral)' }));

    fireEvent.click(screen.getAllByRole('combobox')[1]); // Instituição
    expect(await screen.findByRole('option', { name: 'Faculdade Normal' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'B2B' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'B2C' })).toBeNull();
  });

  it('e-mail que já existe: mostra o aviso e não chama createUser', async () => {
    maybeSingle.mockResolvedValue({ data: { id: 'u-existente' }, error: null });
    renderDialog();
    preencher();

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar mentor' }));

    expect(
      await screen.findByText('Já existe uma conta com este e-mail. O perfil de mentor precisa de um e-mail de login próprio.'),
    ).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
    expect(upsertMentor).not.toHaveBeenCalled();
  });

  it('createUser ok e upsertMentor falha: avisa e a nova tentativa só repete o upsert', async () => {
    createUser.mockResolvedValue({ success: true, userId: 'u-novo' });
    upsertMentor.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ user_id: 'u-novo', criado: true });
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);
    preencher();

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar mentor' }));
    expect(
      await screen.findByText('A conta foi criada, mas o cadastro de mentor falhou. Tente salvar de novo.'),
    ).toBeInTheDocument();
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(maybeSingle).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar mentor' }));
    await waitFor(() => expect(upsertMentor).toHaveBeenCalledTimes(2));
    expect(upsertMentor).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'u-novo' }));
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
