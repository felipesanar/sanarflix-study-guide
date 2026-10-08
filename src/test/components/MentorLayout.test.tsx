import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const logout = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ logout, access: { experiences: ['aluno', 'mentor'] }, user: { id: 'u1' } }),
}));
vi.mock('@/experiences/shared/ExperienceSwitcher', () => ({
  ExperienceSwitcher: () => <div data-testid="experience-switcher" />,
}));

import { MentorLayout } from '@/features/mentor/MentorLayout';

describe('MentorLayout', () => {
  it('tem Sair e troca de experiência no desktop e na barra mobile', () => {
    render(
      <MemoryRouter initialEntries={['/mentor']}>
        <MentorLayout />
      </MemoryRouter>,
    );
    const sair = screen.getAllByRole('button', { name: 'Sair' });
    expect(sair).toHaveLength(2);
    expect(screen.getAllByTestId('experience-switcher')).toHaveLength(2);
    expect(screen.getAllByText('Portal do Mentor')).toHaveLength(2);

    fireEvent.click(sair[1]);
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
