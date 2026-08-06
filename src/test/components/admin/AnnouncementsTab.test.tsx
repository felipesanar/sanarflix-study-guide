import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { render } from '../../utils';
import { AnnouncementsTab } from '@/components/admin/AnnouncementsTab';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Mock do sonner — precisamos espionar toast.error/success sem depender de um
// <Toaster /> montado na árvore de testes (que não renderiza texto no jsdom).
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('AnnouncementsTab', () => {
  const mockAnnouncements = [
    {
      id: '1',
      titulo: 'Aviso Importante',
      descricao: 'Esta é uma mensagem de teste',
      link_botao: null,
      texto_botao: 'Ver mais',
      paleta_cores: 'flame',
      ativo: true,
      data_expiracao: null,
      prioridade: 'alta',
      visibilidade: 'todas',
      ies_selecionadas: [],
      ies_excluidas: [],
      publico_alvo: ['aluno'],
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      titulo: 'Manutenção',
      descricao: 'Sistema em manutenção',
      link_botao: null,
      texto_botao: 'Ver mais',
      paleta_cores: 'royal',
      ativo: false,
      data_expiracao: null,
      prioridade: 'media',
      visibilidade: 'todas',
      ies_selecionadas: [],
      ies_excluidas: [],
      publico_alvo: ['gestor'],
      created_at: '2024-01-02T00:00:00Z',
    },
  ];

  const mockIES = [
    { id: 'ies-1', nome: 'USCS' },
    { id: 'ies-2', nome: 'UNIFESP' },
  ];

  function mockSupabaseFrom(overrides: Record<string, any> = {}) {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'announcements') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockAnnouncements, error: null }),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockResolvedValue({ data: null, error: null }),
          delete: vi.fn().mockReturnThis(),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          ...overrides.announcements,
        } as any;
      }

      if (table === 'ies') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockIES, error: null }),
          ...overrides.ies,
        } as any;
      }

      return {} as any;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom();
  });

  it('should render announcements tab correctly', async () => {
    render(<AnnouncementsTab />);

    await waitFor(() => {
      expect(screen.getByText('Avisos')).toBeInTheDocument();
    });
  });

  it('should display list of announcements', async () => {
    render(<AnnouncementsTab />);

    await waitFor(() => {
      expect(screen.getByText('Aviso Importante')).toBeInTheDocument();
      expect(screen.getByText('Manutenção')).toBeInTheDocument();
    });
  });

  it('should show create new announcement button', async () => {
    render(<AnnouncementsTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Novo aviso/i })).toBeInTheDocument();
    });
  });

  it('should open announcement editor when create button is clicked', async () => {
    render(<AnnouncementsTab />);

    await waitFor(() => screen.getByRole('button', { name: /Novo aviso/i }));
    fireEvent.click(screen.getByRole('button', { name: /Novo aviso/i }));

    await waitFor(() => {
      expect(screen.getByText(/Novo Aviso/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Título do aviso/i)).toBeInTheDocument();
    });
  });

  it('should filter announcements by search term', async () => {
    render(<AnnouncementsTab />);

    await waitFor(() => screen.getByPlaceholderText(/Buscar avisos/i));
    fireEvent.change(screen.getByPlaceholderText(/Buscar avisos/i), { target: { value: 'Importante' } });

    await waitFor(() => {
      expect(screen.getByText('Aviso Importante')).toBeInTheDocument();
      expect(screen.queryByText('Manutenção')).not.toBeInTheDocument();
    });
  });

  it('should open editor when edit button is clicked', async () => {
    render(<AnnouncementsTab />);

    await waitFor(() => screen.getAllByRole('button', { name: /Editar aviso/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /Editar aviso/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/Editar Aviso/i)).toBeInTheDocument();
    });
  });

  it('should call delete API when delete is confirmed', async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabaseFrom({ announcements: { delete: vi.fn(() => ({ eq: mockEq })) } });

    render(<AnnouncementsTab />);

    await waitFor(() => screen.getAllByRole('button', { name: /Excluir aviso/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /Excluir aviso/i })[0]);

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Excluir aviso/i }));

    await waitFor(() => {
      // Ordenação padrão é por data de criação desc — a primeira linha é o id '2' (mais recente).
      expect(mockEq).toHaveBeenCalledWith('id', '2');
    });
  });

  it('should toggle announcement status', async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabaseFrom({ announcements: { update: vi.fn(() => ({ eq: mockEq })) } });

    render(<AnnouncementsTab />);

    await waitFor(() => screen.getAllByRole('button', { name: /Ativar aviso|Desativar aviso/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /Ativar aviso|Desativar aviso/i })[0]);

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('id', '2');
    });
  });

  it('should show loading state while fetching announcements', () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'announcements') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
        } as any;
      }
      if (table === 'ies') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockImplementation(() => new Promise(() => {})),
        } as any;
      }
      return {} as any;
    });

    render(<AnnouncementsTab />);

    expect(screen.getByRole('status', { name: /Carregando/i })).toBeInTheDocument();
  });

  it('should validate required fields before saving an announcement (handleSave receives configToSave)', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabaseFrom({ announcements: { upsert: mockUpsert } });

    render(<AnnouncementsTab />);

    await waitFor(() => screen.getByRole('button', { name: /Novo aviso/i }));
    fireEvent.click(screen.getByRole('button', { name: /Novo aviso/i }));

    await waitFor(() => screen.getByRole('button', { name: /Salvar Aviso/i }));
    // Título e descrição continuam vazios (config padrão) — deve bloquear o save.
    fireEvent.click(screen.getByRole('button', { name: /Salvar Aviso/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Preencha título e descrição do aviso');
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('should save the announcement using the configToSave param from the editor', async () => {
    // Regressão: handleSave usava `editingConfig` cru (sem a conversão de
    // timezone da data de expiração feita pelo editor). Agora recebe
    // `configToSave` como parâmetro e é isso que deve ir para o upsert.
    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabaseFrom({ announcements: { upsert: mockUpsert } });

    render(<AnnouncementsTab />);

    await waitFor(() => screen.getByRole('button', { name: /Novo aviso/i }));
    fireEvent.click(screen.getByRole('button', { name: /Novo aviso/i }));

    await waitFor(() => screen.getByPlaceholderText(/Título do aviso/i));
    fireEvent.change(screen.getByPlaceholderText(/Título do aviso/i), { target: { value: 'Aviso de teste' } });
    fireEvent.change(screen.getByPlaceholderText(/Descrição do aviso/i), { target: { value: 'Descrição de teste' } });

    fireEvent.click(screen.getByRole('button', { name: /Salvar Aviso/i }));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: 'Aviso de teste',
          descricao: 'Descrição de teste',
        }),
      );
    });
    expect(toast.success).toHaveBeenCalledWith('Aviso criado!');
  });

  // --- público-alvo -------------------------------------------------------
  // O bloco de Avisos do gestor subia vazio: o editor não tinha campo de
  // público-alvo e o upsert (lista explícita de colunas) não mandava
  // `publico_alvo`, então todo aviso nascia com o default `{aluno}` do banco e
  // `get_gestor_avisos` — que filtra por `'gestor' = ANY(publico_alvo)` — nunca
  // devolvia nada. Estes testes cobrem o caminho inteiro: UI -> upsert.

  async function abrirNovoAviso() {
    await waitFor(() => screen.getByRole('button', { name: /Novo aviso/i }));
    fireEvent.click(screen.getByRole('button', { name: /Novo aviso/i }));
    await waitFor(() => screen.getByPlaceholderText(/Título do aviso/i));
    fireEvent.change(screen.getByPlaceholderText(/Título do aviso/i), { target: { value: 'Aviso de teste' } });
    fireEvent.change(screen.getByPlaceholderText(/Descrição do aviso/i), { target: { value: 'Descrição de teste' } });
  }

  it('novo aviso nasce com público-alvo {aluno} e leva a coluna para o upsert', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabaseFrom({ announcements: { upsert: mockUpsert } });

    render(<AnnouncementsTab />);
    await abrirNovoAviso();

    expect(screen.getByRole('checkbox', { name: /^Aluno$/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^Gestor$/i })).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Salvar Aviso/i }));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ publico_alvo: ['aluno'] }));
    });
  });

  it('publica o aviso para o gestor quando o público-alvo é marcado no editor', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabaseFrom({ announcements: { upsert: mockUpsert } });

    render(<AnnouncementsTab />);
    await abrirNovoAviso();

    fireEvent.click(screen.getByRole('checkbox', { name: /^Gestor$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Salvar Aviso/i }));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ publico_alvo: ['aluno', 'gestor'] }));
    });
  });

  it('permite um aviso só para gestor, sem aluno', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabaseFrom({ announcements: { upsert: mockUpsert } });

    render(<AnnouncementsTab />);
    await abrirNovoAviso();

    fireEvent.click(screen.getByRole('checkbox', { name: /^Gestor$/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^Aluno$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Salvar Aviso/i }));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ publico_alvo: ['gestor'] }));
    });
  });

  it('bloqueia o save quando nenhum público-alvo está marcado', async () => {
    // O CHECK do banco exige cardinality(publico_alvo) >= 1; um aviso sem
    // público nenhum seria invisível para todo mundo.
    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSupabaseFrom({ announcements: { upsert: mockUpsert } });

    render(<AnnouncementsTab />);
    await abrirNovoAviso();

    fireEvent.click(screen.getByRole('checkbox', { name: /^Aluno$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Salvar Aviso/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Selecione pelo menos um público-alvo para o aviso');
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('carrega o público-alvo do aviso existente ao abrir o editor', async () => {
    render(<AnnouncementsTab />);

    await waitFor(() => screen.getAllByRole('button', { name: /Editar aviso/i }));
    // Ordenação padrão é created_at desc — a primeira linha é o id '2', que é {gestor}.
    fireEvent.click(screen.getAllByRole('button', { name: /Editar aviso/i })[0]);

    await waitFor(() => screen.getByRole('checkbox', { name: /^Gestor$/i }));
    expect(screen.getByRole('checkbox', { name: /^Gestor$/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /^Aluno$/i })).not.toBeChecked();
  });

  it('should show error state with retry when fetch fails', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'announcements') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Erro de rede' } }),
        } as any;
      }
      if (table === 'ies') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockIES, error: null }),
        } as any;
      }
      return {} as any;
    });

    render(<AnnouncementsTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeInTheDocument();
    });
  });
});
