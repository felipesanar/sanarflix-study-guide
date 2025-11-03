import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../utils';
import { AnnouncementsTab } from '@/components/admin/AnnouncementsTab';
import { supabase } from '@/integrations/supabase/client';

describe('AnnouncementsTab', () => {
  const mockAnnouncements = [
    {
      id: '1',
      titulo: 'Aviso Importante',
      mensagem: 'Esta é uma mensagem de teste',
      ativo: true,
      tipo_aviso: 'info',
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      titulo: 'Manutenção',
      mensagem: 'Sistema em manutenção',
      ativo: false,
      tipo_aviso: 'warning',
      created_at: '2024-01-02T00:00:00Z'
    }
  ];

  const mockIES = [
    { id: 'ies-1', nome: 'USCS' },
    { id: 'ies-2', nome: 'UNIFESP' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock do Supabase para listar avisos e IES
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'avisos_importantes') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: mockAnnouncements,
            error: null
          }),
          eq: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockResolvedValue({ data: null, error: null }),
          delete: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      }
      
      if (table === 'ies') {
        return {
          select: vi.fn().mockResolvedValue({
            data: mockIES,
            error: null
          }),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
        } as any;
      }
      
      return {} as any;
    });
  });

  it('should render announcements tab correctly', async () => {
    render(<AnnouncementsTab />);
    
    await waitFor(() => {
      expect(screen.getByText(/Gerenciamento de Avisos/i)).toBeInTheDocument();
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
      expect(screen.getByRole('button', { name: /Novo Aviso/i })).toBeInTheDocument();
    });
  });

  it('should open announcement editor when create button is clicked', async () => {
    render(<AnnouncementsTab />);
    
    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: /Novo Aviso/i });
      fireEvent.click(createButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Criar Novo Aviso/i)).toBeInTheDocument();
    });
  });

  it('should filter announcements by search term', async () => {
    render(<AnnouncementsTab />);
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/Buscar avisos/i);
      fireEvent.change(searchInput, { target: { value: 'Importante' } });
    });
    
    await waitFor(() => {
      expect(screen.getByText('Aviso Importante')).toBeInTheDocument();
      expect(screen.queryByText('Manutenção')).not.toBeInTheDocument();
    });
  });

  it('should filter announcements by active status', async () => {
    render(<AnnouncementsTab />);
    
    await waitFor(() => {
      const activeFilter = screen.getByText(/Apenas Ativos/i);
      fireEvent.click(activeFilter);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Aviso Importante')).toBeInTheDocument();
      expect(screen.queryByText('Manutenção')).not.toBeInTheDocument();
    });
  });

  it('should open edit modal when edit button is clicked', async () => {
    render(<AnnouncementsTab />);
    
    await waitFor(() => {
      const editButtons = screen.getAllByRole('button', { name: /Editar/i });
      fireEvent.click(editButtons[0]);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Editar Aviso/i)).toBeInTheDocument();
    });
  });

  it('should call delete API when delete is confirmed', async () => {
    const mockDelete = vi.fn().mockResolvedValue({ data: null, error: null });
    
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'avisos_importantes') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockAnnouncements, error: null }),
          eq: vi.fn().mockReturnThis(),
          delete: mockDelete,
        } as any;
      }
      return {} as any;
    });
    
    render(<AnnouncementsTab />);
    
    await waitFor(() => {
      const deleteButtons = screen.getAllByRole('button', { name: /Excluir/i });
      fireEvent.click(deleteButtons[0]);
    });
    
    await waitFor(() => {
      const confirmButton = screen.getByRole('button', { name: /Confirmar/i });
      fireEvent.click(confirmButton);
    });
    
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  it('should toggle announcement status', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ data: null, error: null });
    
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'avisos_importantes') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockAnnouncements, error: null }),
          eq: vi.fn().mockReturnThis(),
          update: mockUpdate,
        } as any;
      }
      return {} as any;
    });
    
    render(<AnnouncementsTab />);
    
    await waitFor(() => {
      const toggleButtons = screen.getAllByRole('switch');
      fireEvent.click(toggleButtons[0]);
    });
    
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ ativo: false });
    });
  });

  it('should display announcement type badges correctly', async () => {
    render(<AnnouncementsTab />);
    
    await waitFor(() => {
      expect(screen.getByText(/info/i)).toBeInTheDocument();
      expect(screen.getByText(/warning/i)).toBeInTheDocument();
    });
  });

  it('should show loading state while fetching announcements', () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'avisos_importantes') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
        } as any;
      }
      return {} as any;
    });
    
    render(<AnnouncementsTab />);
    
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
  });
});
