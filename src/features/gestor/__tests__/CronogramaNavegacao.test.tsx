import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CronogramaSimulados } from '@/features/gestor/components/CronogramaSimulados';
import type { ItemCronograma } from '@/features/gestor/api/types';

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

/**
 * Data relativa a hoje. `CronogramaSimulados` chama `proximoSimulado` com o
 * relógio real, e é o "próximo" que decide qual ANATOMIA cada item recebe
 * (cartão de destaque × linha de lista). Com data fixa, o teste passaria a
 * afirmar outra coisa sozinho no dia em que aquela data virasse passado.
 */
const emDias = (dias: number): string => {
  const data = new Date();
  data.setUTCHours(12, 0, 0, 0);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString();
};

const ITENS: ItemCronograma[] = [
  { id: 's1', nome: 'Simulado 1', data: '2026-03-10T12:00:00Z', status: 'realizado', modalidade: 'online', participantes: 88 },
  { id: 's2', nome: 'Simulado 2', data: '2026-05-12T12:00:00Z', status: 'processing', modalidade: 'presencial', participantes: null, indisponivelPorque: 'Gabarito em fechamento' },
  { id: 's3', nome: 'Simulado 3', data: emDias(45), status: 'agendado', modalidade: 'online', participantes: null },
  { id: 's5', nome: 'Simulado 5', data: null, status: 'previsto', modalidade: null, participantes: null, indisponivelPorque: 'Data ainda não definida' },
];

function SondaDeRota() {
  const location = useLocation();
  return <div data-testid="rota">{`${location.pathname}${location.search}`}</div>;
}

const montar = (initialEntries: string[] = ['/gestor']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <SondaDeRota />
      <CronogramaSimulados iesId="ies-1" iesNome="UEA" />
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

  /**
   * A partir da anatomia da §10.12 o bloco deixou de ser uma lista uniforme de
   * botões: o próximo simulado é um CARTÃO de leitura e o contratado sem data é
   * uma moldura tracejada com a ação de agendar. Nenhum dos dois é um controle
   * de navegação — agendado e previsto não têm resultado para abrir —, então o
   * que estes testes cobram não é mais `disabled`, é que nenhum caminho leve ao
   * Detalhamento e que a afordância "Resultados" não seja oferecida.
   */
  it('simulado agendado não navega — o próximo é um cartão de leitura, não um controle', async () => {
    const user = userEvent.setup();
    montar();

    const item = screen.getByTestId('cronograma-item-s3');
    expect(item).toHaveAttribute('data-destaque', 'true');
    // Um <button> do tamanho do cartão prometeria um clique que não existe.
    expect(item.tagName).not.toBe('BUTTON');
    expect(item).not.toHaveTextContent('Resultados');

    await user.click(item);
    expect(screen.getByTestId('rota').textContent).not.toContain('detalhamento');
  });

  it('simulado previsto não navega, mostra o motivo e só oferece Agendar data', async () => {
    const user = userEvent.setup();
    montar();

    const item = screen.getByTestId('cronograma-item-s5');
    expect(item).toHaveTextContent('Data ainda não definida');
    expect(item.tagName).not.toBe('BUTTON');
    expect(item).not.toHaveTextContent('Resultados');

    // A moldura tracejada tem UM controle, e ele não é navegação.
    const controles = Array.from(item.querySelectorAll('button'));
    expect(controles).toHaveLength(1);
    expect(controles[0]).toHaveTextContent('Agendar data');

    await user.click(item);
    expect(screen.getByTestId('rota').textContent).not.toContain('detalhamento');
  });

  it('só o realizado abre o Detalhamento', () => {
    montar();

    const realizado = screen.getByTestId('cronograma-item-s1');
    expect(realizado).toBeEnabled();
    expect(realizado).toHaveTextContent('Resultados');

    // Em processamento continua sendo linha de lista — botão, porém inerte.
    expect(screen.getByTestId('cronograma-item-s2')).toBeDisabled();

    for (const id of ['s3', 's5']) {
      const item = screen.getByTestId(`cronograma-item-${id}`);
      expect(item.tagName).not.toBe('BUTTON');
      expect(item).not.toHaveTextContent('Resultados');
    }
  });

  it('preserva ies e semestre já na URL — só troca/adiciona simulados (achado de QA 04/08)', async () => {
    const user = userEvent.setup();
    montar(['/gestor?ies=fai-id&semestre=6ano']);

    await user.click(screen.getByTestId('cronograma-item-s1'));

    const rota = screen.getByTestId('rota').textContent ?? '';
    expect(rota).toContain('/gestor/detalhamento');
    expect(rota).toContain('ies=fai-id');
    expect(rota).toContain('semestre=6ano');
    expect(rota).toContain('simulados=s1');
  });
});
