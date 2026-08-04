import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CronogramaSimulados,
  proximoSimulado,
  MSG_AGENDAR,
  MSG_CONSULTOR,
  WHATSAPP_SANAR,
} from '@/features/gestor/components/CronogramaSimulados';
import type { ContextoGestor, ItemCronograma } from '@/features/gestor/api/types';

const mocks = vi.hoisted(() => ({ useCronograma: vi.fn() }));

vi.mock('@/features/gestor/api/queries', () => ({
  useCronograma: mocks.useCronograma,
}));

const CONTRATO: ContextoGestor['contrato'] = {
  nome: 'Academy 2026',
  simuladosContratados: 7,
  vigencia: '01/01/2026 a 31/12/2026',
};

/** Um item por status. s4 (18/08) é o próximo: vence s3 (20/09) na ordenação. */
const ITENS: ItemCronograma[] = [
  { id: 's1', nome: 'Simulado 1', data: '2026-03-10T12:00:00Z', status: 'realizado', modalidade: 'online', participantes: 88 },
  { id: 's2', nome: 'Simulado 2', data: '2026-05-12T12:00:00Z', status: 'processing', modalidade: 'presencial', participantes: null, indisponivelPorque: 'Gabarito em fechamento' },
  { id: 's3', nome: 'Simulado 3', data: '2026-09-20T12:00:00Z', status: 'agendado', modalidade: 'online', participantes: null },
  { id: 's4', nome: 'Simulado 4', data: '2026-08-18T12:00:00Z', status: 'reagendado', modalidade: 'presencial', participantes: null },
  { id: 's5', nome: 'Simulado 5', data: null, status: 'previsto', modalidade: null, participantes: null, indisponivelPorque: 'Data ainda não definida' },
];

const resultado = (over: Record<string, unknown> = {}) => ({
  isLoading: false,
  isError: false,
  data: undefined,
  refetch: vi.fn(),
  ...over,
});

const montar = (props?: Partial<React.ComponentProps<typeof CronogramaSimulados>>) =>
  render(
    <CronogramaSimulados iesId="ies-1" iesNome="UEA" contrato={CONTRATO} {...props} />,
  );

beforeEach(() => {
  mocks.useCronograma.mockReturnValue(resultado({ data: ITENS }));
});

describe('proximoSimulado', () => {
  it('devolve o agendado/reagendado com a data mais próxima', () => {
    expect(proximoSimulado(ITENS)).toBe('s4');
  });

  it('ignora realizado, em processamento e previsto', () => {
    const soPassado: ItemCronograma[] = [ITENS[0], ITENS[1], ITENS[4]];
    expect(proximoSimulado(soPassado)).toBeNull();
  });

  it('devolve null com lista vazia', () => {
    expect(proximoSimulado([])).toBeNull();
  });
});

describe('CronogramaSimulados — os 5 status (spec §6.4)', () => {
  it('rotula cada um dos 5 status', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s1')).toHaveTextContent('Realizado');
    expect(screen.getByTestId('cronograma-item-s2')).toHaveTextContent('Em processamento');
    expect(screen.getByTestId('cronograma-item-s3')).toHaveTextContent('Agendado');
    expect(screen.getByTestId('cronograma-item-s4')).toHaveTextContent('Reagendado');
    expect(screen.getByTestId('cronograma-item-s5')).toHaveTextContent('A definir');
  });

  it('previsto exibe "A definir" e nenhuma data', () => {
    montar();
    const previsto = screen.getByTestId('cronograma-item-s5');
    expect(previsto).toHaveTextContent('A definir');
    expect(previsto.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('rotula a data conforme a modalidade: online = Início, presencial = Realização', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s1')).toHaveTextContent('Início: 10/03/2026');
    expect(screen.getByTestId('cronograma-item-s4')).toHaveTextContent('Realização: 18/08/2026');
  });

  it('mostra o motivo de indisponibilidade quando o servidor manda', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s2')).toHaveTextContent('Gabarito em fechamento');
  });

  it('destaca o próximo simulado e só ele', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s4')).toHaveAttribute('data-destaque', 'true');
    expect(screen.getByTestId('cronograma-item-s3')).toHaveAttribute('data-destaque', 'false');
    expect(screen.getByText('Próximo simulado')).toBeInTheDocument();
  });
});

describe('CronogramaSimulados — bloco de contratados sem data', () => {
  it('agrupa os previstos com a contagem', () => {
    montar();
    const bloco = screen.getByTestId('cronograma-sem-data');
    expect(bloco).toHaveTextContent('Contratados sem data (1)');
    expect(bloco).toContainElement(screen.getByTestId('cronograma-item-s5'));
  });

  it('Agendar e Falar com consultor abrem o WhatsApp com textos diferentes', async () => {
    const abrir = vi.fn();
    vi.stubGlobal('open', abrir);
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole('button', { name: /agendar/i }));
    await user.click(screen.getByRole('button', { name: /falar com consultor/i }));

    expect(abrir).toHaveBeenCalledTimes(2);
    const [urlAgendar] = abrir.mock.calls[0] as [string];
    const [urlConsultor] = abrir.mock.calls[1] as [string];

    expect(urlAgendar).toBe(
      `https://wa.me/${WHATSAPP_SANAR}?text=${encodeURIComponent(MSG_AGENDAR('UEA'))}`,
    );
    expect(urlConsultor).toBe(
      `https://wa.me/${WHATSAPP_SANAR}?text=${encodeURIComponent(MSG_CONSULTOR('UEA'))}`,
    );
    expect(urlAgendar).not.toBe(urlConsultor);
  });

  it('não renderiza o bloco quando todo simulado tem data', () => {
    mocks.useCronograma.mockReturnValue(resultado({ data: ITENS.slice(0, 4) }));
    montar();
    expect(screen.queryByTestId('cronograma-sem-data')).not.toBeInTheDocument();
  });
});

describe('CronogramaSimulados — proveniência e estados (§8.4)', () => {
  it('mostra o contrato e a vigência no rodapé', () => {
    montar();
    expect(screen.getByTestId('cronograma-proveniencia')).toHaveTextContent(
      'Academy 2026 · vigência 01/01/2026 a 31/12/2026',
    );
  });

  it('omite o rodapé quando não há contrato', () => {
    montar({ contrato: null });
    expect(screen.queryByTestId('cronograma-proveniencia')).not.toBeInTheDocument();
  });

  it('loading: skeleton que reserva altura, sem itens', () => {
    mocks.useCronograma.mockReturnValue(resultado({ isLoading: true }));
    montar();
    expect(screen.getAllByTestId('cronograma-skeleton')).toHaveLength(4);
    expect(screen.queryByTestId('cronograma-item-s1')).not.toBeInTheDocument();
  });

  it('empty: nenhum simulado contratado', () => {
    mocks.useCronograma.mockReturnValue(resultado({ data: [] }));
    montar();
    expect(screen.getByText(/nenhum simulado contratado/i)).toBeInTheDocument();
  });

  it('error: mensagem + Tentar novamente refaz só esta query', async () => {
    const refetch = vi.fn();
    mocks.useCronograma.mockReturnValue(resultado({ isError: true, refetch }));
    const user = userEvent.setup();
    montar();

    expect(screen.getByText(/não foi possível carregar o cronograma/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
