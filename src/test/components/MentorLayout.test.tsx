import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const logout = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ logout, access: { experiences: ['aluno', 'mentor'] }, user: { id: 'u1' } }),
}));
vi.mock('@/experiences/shared/ExperienceSwitcher', () => ({
  ExperienceSwitcher: () => <div data-testid="experience-switcher" />,
}));

const fetchMentorContexto = vi.fn();
vi.mock('@/services/mentor/contexto', () => ({
  fetchMentorContexto: () => fetchMentorContexto(),
}));

import { MentorLayout } from '@/features/mentor/MentorLayout';

function contexto(tipo: 'b2c' | 'b2b') {
  return {
    mentor: { id: 'm1', nome: 'Ana Souza', tipo, turma_nome: 'Turma A' },
    alunos_ativos: 3,
  };
}

const T = { timeout: 3000 };

/** Fresh QueryClient por teste; devolve o client para esperar o estado assentado. */
function renderLayout() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/mentor']}>
        <MentorLayout />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const settled = () =>
    waitFor(() => expect(client.getQueryState(['mentor', 'contexto'])?.status).toBe('success'), T);
  return { ...utils, client, settled };
}

describe('MentorLayout', () => {
  beforeEach(() => {
    logout.mockClear();
    fetchMentorContexto.mockReset();
    fetchMentorContexto.mockResolvedValue(contexto('b2c'));
  });

  it('tem Sair e troca de experiência no desktop e na barra mobile', async () => {
    const { settled } = renderLayout();
    await settled();
    const sair = screen.getAllByRole('button', { name: 'Sair' });
    expect(sair).toHaveLength(2);
    expect(screen.getAllByTestId('experience-switcher')).toHaveLength(2);
    expect(screen.getAllByText('Portal do Mentor')).toHaveLength(2);

    fireEvent.click(sair[1]);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('expõe os 6 itens de menu (desktop e mobile) com os hrefs certos — b2c: Minha Turma', async () => {
    const { settled } = renderLayout();
    await settled();
    expect(fetchMentorContexto).toHaveBeenCalled();
    const esperados: Array<[string, string]> = [
      ['Início', '/mentor'],
      ['Minha Turma', '/mentor/turma'],
      ['Detalhamento', '/mentor/detalhamento'],
      ['Mural', '/mentor/mural'],
      ['Sessões', '/mentor/sessoes'],
      ['Intervenções', '/mentor/intervencoes'],
    ];
    for (const [nome, href] of esperados) {
      const links = await screen.findAllByRole('link', { name: nome }, T);
      expect(links).toHaveLength(2);
      links.forEach((l) => expect(l).toHaveAttribute('href', href));
    }
    expect(screen.queryByRole('link', { name: 'Visão Geral' })).toBeNull();
  });

  it('mentor b2b vê "Visão Geral" no lugar de "Minha Turma"', async () => {
    fetchMentorContexto.mockResolvedValue(contexto('b2b'));
    const { settled } = renderLayout();
    await settled();
    const links = await screen.findAllByRole('link', { name: 'Visão Geral' }, T);
    expect(links).toHaveLength(2);
    links.forEach((l) => expect(l).toHaveAttribute('href', '/mentor/turma'));
    expect(screen.queryByRole('link', { name: 'Minha Turma' })).toBeNull();
  });
});
