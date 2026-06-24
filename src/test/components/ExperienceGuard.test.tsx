import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import type { Experience } from '@/utils/experiences';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { roles: ['admin'] } }),
}));
vi.mock('@/hooks/useAccessRules', () => ({
  useAccessRules: () => ({
    accessRules: { userManagement: true },
    loading: false,
  }),
}));

const renderAt = (path: string, experience: Experience) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/gestor"
          element={
            <ExperienceGuard experience={experience}>
              <div>GESTOR</div>
            </ExperienceGuard>
          }
        />
        <Route path="/admin/usuarios" element={<div>ADMIN ENTRYPOINT</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ExperienceGuard', () => {
  it('admin tentando /gestor é redirecionado ao seu entrypoint', () => {
    renderAt('/gestor', 'gestao');
    expect(screen.getByText('ADMIN ENTRYPOINT')).toBeInTheDocument();
  });

  it('experiência compatível renderiza o conteúdo', () => {
    renderAt('/gestor', 'admin'); // user é admin → experiência admin combina
    expect(screen.getByText('GESTOR')).toBeInTheDocument();
  });
});
