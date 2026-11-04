/** Minha Turma com os hooks reais sobre a fonte mock (dados do protótipo B2C), sem mockar `queries.ts`. */
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { _definirConfigParaTestes } from '@/features/mentor/api/ativa';
import MinhaTurma from '@/features/mentor/routes/v2/MinhaTurma';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/features/gestor/hooks/useCountUp', () => ({ useCountUp: (v: number | null) => v }));

beforeEach(() => _definirConfigParaTestes({ fonte: 'mock', modalidade: 'b2c', latenciaMs: 0 }));
afterAll(() => _definirConfigParaTestes(null));

function montar(path = '/mentor/turma') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path="/mentor/*" element={<MinhaTurma />} /></Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

it('carrega a turma do protótipo pelos hooks e cria intervenção no kanban mock', async () => {
  montar('/mentor/turma?alerta=regrediram');
  const tabela = await screen.findByRole('table', { name: 'Alunos da turma' });
  await waitFor(() => expect(within(tabela).getAllByRole('button').map((b) => b.textContent)).toEqual(['Caio Menezes', 'Rafael Nogueira', 'Luana Castro']));
  expect(screen.getByText('Alerta: Regrediram · 3')).toBeVisible();
  expect(within(screen.getByTestId('kpi-possivel-aprovacao')).getByTestId('kpi-valor')).toHaveTextContent('34%');
  expect(screen.getByRole('link', { name: /Detalhar 5º Simulado PRO/ })).toBeVisible();

  const temas = await screen.findByRole('table', { name: 'Temas críticos' });
  fireEvent.click(within(temas).getAllByRole('button', { name: /^Expandir/ })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Criar intervenção' }));
  expect(await screen.findByText(/^Intervenção criada em A fazer: /)).toBeVisible();
});
