/**
 * Cobre `UsersListTable` (fatia B — Usuários), que passou a concentrar a
 * lógica antes espalhada em `UsersTab` (removido — sem lógica própria após a
 * reescrita para o vocabulário do console admin). Mantido neste caminho de
 * arquivo por instrução explícita ("reescreva o teste para o fluxo novo em
 * vez de deletar"); o antigo suite testava um fluxo B2B/B2C que não existe
 * mais no componente atual.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, userEvent, waitFor } from '../../utils';
import { UsersListTable } from '@/components/admin/UsersListTable';
import { supabase } from '@/integrations/supabase/client';
import type { Access } from '@/experiences/access';

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/components/admin/UserSupportPanel', () => ({
  UserSupportPanel: () => null,
}));

vi.mock('@/services/admin/logAction', () => ({
  logAdminAction: vi.fn(),
}));

const IES_LIST = [{ id: 'ies-1', nome: 'IES Exemplo' }];

const SAMPLE_USERS = [
  { id: 'u-1', nome: 'Ana Aluna', email: 'ana@exemplo.com', id_ies: 'ies-1', semestre: 3, ies: { nome: 'IES Exemplo' } },
  { id: 'u-2', nome: 'Gustavo Gestor', email: 'gustavo@exemplo.com', id_ies: 'ies-1', semestre: null, ies: { nome: 'IES Exemplo' } },
];

const SAMPLE_ROLES = [{ user_id: 'u-2', role: 'gestor' }];

const ADMIN_ACCESS: Access = { roles: ['admin'], experiences: ['admin'], capabilities: ['users.manage', 'impersonate'] };
const SUPPORT_ACCESS: Access = { roles: ['atendimento'], experiences: ['atendimento'], capabilities: ['users.support'] };

/** Builder encadeável mínimo: cada método devolve o próprio objeto (thenable),
 * então `await query.a().b().c()` resolve para `result` independente de qual
 * método foi chamado por último — espelha o builder real do supabase-js. */
function makeQueryBuilder(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'or', 'order', 'range', 'in', 'delete', 'insert', 'update']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function mockSupabaseTables() {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'users') {
      return makeQueryBuilder({ data: SAMPLE_USERS, count: SAMPLE_USERS.length, error: null }) as never;
    }
    if (table === 'user_roles') {
      return makeQueryBuilder({ data: SAMPLE_ROLES, count: SAMPLE_ROLES.length, error: null }) as never;
    }
    return makeQueryBuilder({ data: [], count: 0, error: null }) as never;
  });
}

describe('UsersListTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseTables();
    mockUseAuth.mockReturnValue({ startImpersonation: vi.fn(), access: ADMIN_ACCESS });
  });

  it('carrega e exibe os usuários com a coluna de seleção quando pode gerenciar', async () => {
    render(<UsersListTable iesList={IES_LIST} canManage canSupport={false} onOpenBulkEmail={vi.fn()} />);

    expect(await screen.findByText('Ana Aluna')).toBeInTheDocument();
    expect(screen.getByText('Gustavo Gestor')).toBeInTheDocument();
    expect(screen.getByLabelText('Selecionar todos')).toBeInTheDocument();
  });

  it('esconde seleção em massa e ações de gestão para o Atendimento (canManage=false)', async () => {
    mockUseAuth.mockReturnValue({ startImpersonation: vi.fn(), access: SUPPORT_ACCESS });
    render(<UsersListTable iesList={IES_LIST} canManage={false} canSupport onOpenBulkEmail={vi.fn()} />);

    await screen.findByText('Ana Aluna');
    expect(screen.queryByLabelText('Selecionar todos')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Mais ações' })[0]);
    expect(screen.getByText('Reenviar Convite')).toBeInTheDocument();
    expect(screen.queryByText('Remover Usuário')).not.toBeInTheDocument();
    expect(screen.queryByText('Promover a Admin')).not.toBeInTheDocument();
  });

  it('exige a palavra EXCLUIR para habilitar a exclusão de um usuário', async () => {
    render(<UsersListTable iesList={IES_LIST} canManage canSupport={false} onOpenBulkEmail={vi.fn()} />);

    await screen.findByText('Ana Aluna');
    await userEvent.click(screen.getAllByRole('button', { name: 'Mais ações' })[0]);
    await userEvent.click(screen.getByText('Remover Usuário'));

    const confirmButton = await screen.findByRole('button', { name: 'Excluir' });
    expect(confirmButton).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText('EXCLUIR'), 'EXCLUIR');
    await waitFor(() => expect(confirmButton).toBeEnabled());
  });

  it('mostra "Acessar como Gestor" para usuário com role gestor quando pode impersonar', async () => {
    render(<UsersListTable iesList={IES_LIST} canManage canSupport={false} onOpenBulkEmail={vi.fn()} />);

    await screen.findByText('Gustavo Gestor');
    await userEvent.click(screen.getAllByRole('button', { name: 'Mais ações' })[1]);
    expect(screen.getByText('Acessar como Gestor')).toBeInTheDocument();
  });

  it('não mostra "Acessar como Gestor" para aluno sem essa role', async () => {
    render(<UsersListTable iesList={IES_LIST} canManage canSupport={false} onOpenBulkEmail={vi.fn()} />);

    await screen.findByText('Ana Aluna');
    await userEvent.click(screen.getAllByRole('button', { name: 'Mais ações' })[0]);
    expect(screen.queryByText('Acessar como Gestor')).not.toBeInTheDocument();
  });
});
