import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { render } from '../../utils';
import { AnnouncementsTab } from '@/components/admin/AnnouncementsTab';
import { supabase } from '@/integrations/supabase/client';

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
