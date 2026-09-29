import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProvaOficialPage from '../pages/ProvaOficialPage';
import type { ProvaOficialAluno } from '../types';

// `src/test/setup.ts` troca `useParams`/`Link` globalmente (retorna sempre
// `{}`), o que apagaria justamente o `:id` que esta página lê. O módulo real
// (`vi.importActual`) devolve o comportamento de verdade; o `MemoryRouter` +
// `Routes` abaixo continuam sendo o sandbox — mesmo padrão de
// `src/features/gestor/__tests__/queries.test.tsx`.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockUseProvaOficialAluno = vi.fn();
vi.mock('../api', () => ({
  useProvaOficialAluno: (id: string | undefined) => mockUseProvaOficialAluno(id),
}));

const FIXTURE: ProvaOficialAluno = {
  simuladoId: 'sim-1',
  nome: 'ENAMED 2026',
  dataRealizacao: '2026-09-13T00:00:00Z',
  caderno: 2,
  acertos: 1,
  totalValidas: 3,
  emBranco: 1,
  areas: [
    { area: 'Clínica Médica', acertos: 1, total: 2 },
    { area: 'Cirurgia', acertos: 0, total: 1 },
  ],
  trajetoria: [
    { simuladoId: 's0', nome: 'Simulado 1', data: '2026-08-01T00:00:00Z', acertoPct: 60, provaOficial: false },
    { simuladoId: 'sim-1', nome: 'ENAMED 2026', data: '2026-09-13T00:00:00Z', acertoPct: 33, provaOficial: true },
  ],
  questoes: [
    {
      questionId: 'q1', posicao: 36, numeroCaderno1: 7, grandeArea: 'Clínica Médica', especialidade: null,
      enunciado: 'Enunciado 1', alternativas: { A: 'a1', B: 'b1', C: 'c1', D: 'd1' },
      imagem: null, imagem2: null, imagemComentario: null,
      correta: 'A', resposta: 'A', acertou: true, anulada: false, comentario: null,
    },
    {
      questionId: 'q2', posicao: 37, numeroCaderno1: 8, grandeArea: 'Clínica Médica', especialidade: null,
      enunciado: 'Enunciado 2', alternativas: { A: 'a2', B: 'b2', C: 'c2', D: 'd2' },
      imagem: null, imagem2: null, imagemComentario: null,
      correta: 'B', resposta: 'C', acertou: false, anulada: false, comentario: null,
    },
    {
      questionId: 'q3', posicao: 38, numeroCaderno1: 9, grandeArea: 'Cirurgia', especialidade: null,
      enunciado: 'Enunciado 3', alternativas: { A: 'a3', B: 'b3', C: 'c3', D: 'd3' },
      imagem: null, imagem2: null, imagemComentario: null,
      correta: 'D', resposta: null, acertou: false, anulada: false, comentario: null,
    },
  ],
};

const renderPagina = (id = 'sim-1') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/simulados/${id}/prova-oficial`]}>
        <Routes>
          <Route path="/simulados/:id/prova-oficial" element={<ProvaOficialPage />} />
          <Route path="/simulados" element={<div>tela de simulados</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('ProvaOficialPage', () => {
  it('sem resultado liberado, mostra aviso e link de volta para /simulados', () => {
    mockUseProvaOficialAluno.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() });
    renderPagina();

    expect(screen.getByText('Resultado ainda não disponível')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /simulados/i });
    expect(link).toHaveAttribute('href', '/simulados');
  });

  it('com resultado liberado, mostra cabeçalho, áreas, questões no caderno do aluno e nunca TRI/nota', async () => {
    mockUseProvaOficialAluno.mockReturnValue({ data: FIXTURE, isLoading: false, isError: false, refetch: vi.fn() });
    renderPagina();

    const header = screen.getByTestId('prova-oficial-header');
    expect(within(header).getByText(/ENAMED 2026/)).toBeInTheDocument();
    expect(within(header).getByText(/Caderno 2/)).toBeInTheDocument();
    expect(within(header).getByText(/1 de 3/)).toBeInTheDocument();

    expect(screen.getByText('Por área')).toBeInTheDocument();
    expect(screen.getAllByText('Clínica Médica').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cirurgia').length).toBeGreaterThan(0);

    // Primeira questão exibida segue a ordem/numeração do CADERNO DO ALUNO
    // (posicao 36, não a ordem de inserção na RPC).
    expect(screen.getByText('Caderno 2 · Questão 36')).toBeInTheDocument();
    expect(screen.getByText(/no Caderno 1 era a questão 7/)).toBeInTheDocument();

    // Filtro "Erradas" deixa só a questão 37 (errada) — some as 36 (certa) e 38 (branco).
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Erradas' }));
    expect(screen.getByText('Caderno 2 · Questão 37')).toBeInTheDocument();
    expect(screen.queryByText('Caderno 2 · Questão 36')).not.toBeInTheDocument();
    expect(screen.queryByText('Caderno 2 · Questão 38')).not.toBeInTheDocument();

    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/TRI/);
    expect(texto.toLowerCase()).not.toMatch(/proficiente/);
    expect(texto.toLowerCase()).not.toMatch(/nota estimada/);

    expect(texto.toLowerCase()).toMatch(/gabarito preliminar do inep/);
  });
});
