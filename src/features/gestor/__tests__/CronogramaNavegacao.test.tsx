import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CronogramaSimulados } from '@/features/gestor/components/CronogramaSimulados';
import type { ContextoGestor, ItemCronograma } from '@/features/gestor/api/types';

const mocks = vi.hoisted(() => ({ useCronograma: vi.fn() }));

vi.mock('@/features/gestor/api/queries', () => ({
  useCronograma: mocks.useCronograma,
}));

/**
 * src/test/setup.ts mocka react-router-dom com useNavigate: () => vi.fn(),
 * o que torna impossível observar navegação. Aqui devolvemos o módulo real
 * (mesma convenção de src/test/components/ExperienceGuard.test.tsx).
 */
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return actual;
});

const CONTRATO: ContextoGestor['contrato'] = {
  nome: 'Academy 2026',
  simuladosContratados: 7,
  vigencia: '01/01/2026 a 31/12/2026',
};

const ITENS: ItemCronograma[] = [
  { id: 's1', nome: 'Simulado 1', data: '2026-03-10T12:00:00Z', status: 'realizado', modalidade: 'online', participantes: 88 },
  { id: 's2', nome: 'Simulado 2', data: '2026-05-12T12:00:00Z', status: 'processing', modalidade: 'presencial', participantes: null, indisponivelPorque: 'Gabarito em fechamento' },
  { id: 's3', nome: 'Simulado 3', data: '2026-09-20T12:00:00Z', status: 'agendado', modalidade: 'online', participantes: null },
  { id: 's5', nome: 'Simulado 5', data: null, status: 'previsto', modalidade: null, participantes: null, indisponivelPorque: 'Data ainda não definida' },
];

function SondaDeRota() {
  const location = useLocation();
  return <div data-testid="rota">{`${location.pathname}${location.search}`}</div>;
}

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/gestor']}>
      <SondaDeRota />
      <CronogramaSimulados iesId="ies-1" iesNome="UEA" contrato={CONTRATO} />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.useCronograma.mockReturnValue({
    isLoading: false,
    isError: false,
    data: ITENS,
    refetch: vi.fn(),
  });
});

describe('CronogramaSimulados — navegação para o Detalhamento (spec §2.1, §4.7)', () => {
  it('parte de /gestor', () => {
    montar();
    expect(screen.getByTestId('rota')).toHaveTextContent('/gestor');
  });

  it('clique em simulado realizado abre o Detalhamento já filtrado naquele simulado', async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByTestId('cronograma-item-s1'));

    expect(screen.getByTestId('rota')).toHaveTextContent(
      '/gestor/detalhamento?simulados=s1',
    );
  });

  it('simulado em processamento não é clicável e mostra o motivo', async () => {
    const user = userEvent.setup();
    montar();

    const item = screen.getByTestId('cronograma-item-s2');
    expect(item).toBeDisabled();
    expect(item).toHaveTextContent('Gabarito em fechamento');

    await user.click(item);
    expect(screen.getByTestId('rota')).toHaveTextContent('/gestor');
    expect(screen.getByTestId('rota').textContent).not.toContain('detalhamento');
  });

  it('simulado agendado não é clicável', async () => {
    const user = userEvent.setup();
    montar();

    const item = screen.getByTestId('cronograma-item-s3');
    expect(item).toBeDisabled();

    await user.click(item);
    expect(screen.getByTestId('rota').textContent).not.toContain('detalhamento');
  });

  it('simulado previsto não é clicável e mostra o motivo', async () => {
    const user = userEvent.setup();
    montar();

    const item = screen.getByTestId('cronograma-item-s5');
    expect(item).toBeDisabled();
    expect(item).toHaveTextContent('Data ainda não definida');

    await user.click(item);
    expect(screen.getByTestId('rota').textContent).not.toContain('detalhamento');
  });

  it('só o realizado é habilitado', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s1')).toBeEnabled();
    for (const id of ['s2', 's3', 's5']) {
      expect(screen.getByTestId(`cronograma-item-${id}`)).toBeDisabled();
    }
  });
});
