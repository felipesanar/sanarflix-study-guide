import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../utils';
import { UsersTab } from '@/components/admin/UsersTab';
import { supabase } from '@/integrations/supabase/client';

describe('UsersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock da resposta do Supabase para IES
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { id: 'ies-1', nome: 'USCS' },
          { id: 'ies-2', nome: 'UNIFESP' }
        ],
        error: null
      }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    } as any);
  });

  it('should render the users tab correctly', async () => {
    render(<UsersTab />);
    
    await waitFor(() => {
      expect(screen.getByText(/Gerenciamento de Usuários/i)).toBeInTheDocument();
    });
  });

  it('should display IES selection dropdown', async () => {
    render(<UsersTab />);
    
    await waitFor(() => {
      expect(screen.getByText(/Selecione uma IES/i)).toBeInTheDocument();
    });
  });

  it('should show B2B creation form', async () => {
    render(<UsersTab />);
    
    await waitFor(() => {
      expect(screen.getByText(/Criação B2B/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/nome/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    });
  });

  it('should show B2C creation form', async () => {
    render(<UsersTab />);
    
    const b2cTab = screen.getByText(/Criação B2C/i);
    fireEvent.click(b2cTab);
    
    await waitFor(() => {
      expect(screen.getByText(/Upload de Arquivo CSV/i)).toBeInTheDocument();
    });
  });

  it('should validate required fields for B2B creation', async () => {
    render(<UsersTab />);
    
    const createButton = screen.getByRole('button', { name: /Criar Usuário B2B/i });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      // Form validation should prevent submission with empty fields
      expect(vi.mocked(supabase.functions.invoke)).not.toHaveBeenCalled();
    });
  });

  it('should call B2B creation API with correct data', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: { 
        user: { email: 'test@example.com' },
        password: 'generated-password'
      },
      error: null
    });
    
    vi.mocked(supabase.functions.invoke).mockImplementation(mockInvoke);
    
    render(<UsersTab />);
    
    // Select IES
    const iesSelect = screen.getByText(/Selecione uma IES/i);
    fireEvent.click(iesSelect);
    
    await waitFor(() => {
      const uscsOption = screen.getByText('USCS');
      fireEvent.click(uscsOption);
    });
    
    // Fill form
    const nameInput = screen.getByPlaceholderText(/nome/i);
    const emailInput = screen.getByPlaceholderText(/email/i);
    const semesterInput = screen.getByPlaceholderText(/semestre/i);
    
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(semesterInput, { target: { value: '5' } });
    
    const createButton = screen.getByRole('button', { name: /Criar Usuário B2B/i });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('b2b-create-user', {
        body: expect.objectContaining({
          nome: 'Test User',
          email: 'test@example.com',
          semestre: 5
        })
      });
    });
  });

  it('should display error message on API failure', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Failed to create user' }
    });
    
    vi.mocked(supabase.functions.invoke).mockImplementation(mockInvoke);
    
    render(<UsersTab />);
    
    // Fill form and submit
    const nameInput = screen.getByPlaceholderText(/nome/i);
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    
    const createButton = screen.getByRole('button', { name: /Criar Usuário B2B/i });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Erro ao criar usuário/i)).toBeInTheDocument();
    });
  });

  it('should show copy password button after successful creation', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: { 
        user: { email: 'test@example.com' },
        password: 'generated-password-123'
      },
      error: null
    });
    
    vi.mocked(supabase.functions.invoke).mockImplementation(mockInvoke);
    
    render(<UsersTab />);
    
    const nameInput = screen.getByPlaceholderText(/nome/i);
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    
    const createButton = screen.getByRole('button', { name: /Criar Usuário B2B/i });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(screen.getByText(/generated-password-123/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copiar/i })).toBeInTheDocument();
    });
  });

  it('should accept CSV file upload', async () => {
    render(<UsersTab />);
    
    const b2cTab = screen.getByText(/Criação B2C/i);
    fireEvent.click(b2cTab);
    
    await waitFor(() => {
      const fileInput = screen.getByLabelText(/Upload de Arquivo CSV/i);
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('accept', '.csv');
    });
  });
});
