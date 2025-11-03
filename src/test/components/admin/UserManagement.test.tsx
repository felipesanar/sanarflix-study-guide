import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../utils';
import UserManagement from '@/pages/UserManagement';

// Mock do useAuth
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

describe('UserManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display access denied for non-admin users', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        roles: ['student']
      }
    });

    render(<UserManagement />);
    
    expect(screen.getByText(/Acesso Negado/i)).toBeInTheDocument();
    expect(screen.getByText(/Você não tem permissão/i)).toBeInTheDocument();
  });

  it('should render admin portal for admin users', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        roles: ['admin']
      }
    });

    render(<UserManagement />);
    
    await waitFor(() => {
      expect(screen.getByText(/Portal do Administrador/i)).toBeInTheDocument();
    });
  });

  it('should display tabs for users and announcements', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        roles: ['admin']
      }
    });

    render(<UserManagement />);
    
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Usuários/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Avisos/i })).toBeInTheDocument();
    });
  });

  it('should switch between tabs when clicked', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        roles: ['admin']
      }
    });

    render(<UserManagement />);
    
    await waitFor(() => {
      const usersTab = screen.getByRole('tab', { name: /Usuários/i });
      const announcementsTab = screen.getByRole('tab', { name: /Avisos/i });
      
      expect(usersTab).toHaveAttribute('data-state', 'active');
      
      fireEvent.click(announcementsTab);
      
      expect(announcementsTab).toHaveAttribute('data-state', 'active');
    });
  });

  it('should render UsersTab component by default', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        roles: ['admin']
      }
    });

    render(<UserManagement />);
    
    await waitFor(() => {
      expect(screen.getByText(/Gerenciamento de Usuários/i)).toBeInTheDocument();
    });
  });

  it('should render AnnouncementsTab when announcements tab is clicked', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        roles: ['admin']
      }
    });

    render(<UserManagement />);
    
    const announcementsTab = screen.getByRole('tab', { name: /Avisos/i });
    fireEvent.click(announcementsTab);
    
    await waitFor(() => {
      expect(screen.getByText(/Gerenciamento de Avisos/i)).toBeInTheDocument();
    });
  });

  it('should display admin shield icon', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        roles: ['admin']
      }
    });

    render(<UserManagement />);
    
    await waitFor(() => {
      const shieldIcon = screen.getByText(/Portal do Administrador/i)
        .parentElement?.querySelector('svg');
      expect(shieldIcon).toBeInTheDocument();
    });
  });

  it('should not render admin content for null user', () => {
    mockUseAuth.mockReturnValue({
      user: null
    });

    render(<UserManagement />);
    
    expect(screen.getByText(/Acesso Negado/i)).toBeInTheDocument();
  });

  it('should handle user with undefined roles', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        roles: undefined
      }
    });

    render(<UserManagement />);
    
    expect(screen.getByText(/Acesso Negado/i)).toBeInTheDocument();
  });
});
