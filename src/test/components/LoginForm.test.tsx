import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../utils';
import { LoginForm } from '@/components/LoginForm';

// Mock do hook de autenticação. `vi.mock` é içado para o topo do arquivo, então
// o estado de loading fica numa variável mutável (nunca declarar um segundo
// vi.mock dentro de um teste — o último içado venceria para TODOS os testes).
const mockLogin = vi.fn();
let mockIsLoading = false;
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    isLoading: mockIsLoading,
  }),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
  });

  it('renderiza o formulário de login (e-mail, senha, entrar)', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument();
  });

  it('chama login com as credenciais normalizadas', async () => {
    mockLogin.mockResolvedValue(true);
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/e-mail/i), { target: { value: 'Test@Example.com ' } });
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^entrar$/i }));

    await waitFor(() => {
      // LoginForm normaliza: trim + lowercase no e-mail.
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('alterna a visibilidade da senha', () => {
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText(/^senha$/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: /mostrar senha/i }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: /ocultar senha/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('mostra estado de carregamento durante o login', () => {
    mockIsLoading = true;
    render(<LoginForm />);

    const submitButton = screen.getByRole('button', { name: /entrando/i });
    expect(submitButton).toBeDisabled();
  });
});
