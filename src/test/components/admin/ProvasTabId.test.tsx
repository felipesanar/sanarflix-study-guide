/**
 * Simulados → Provas mostra o ID de cada simulado, discreto, embaixo do nome: é o valor que o script de leitura
 * dos cartões-resposta pede em `--simulado`, e antes só dava para obtê-lo por query no banco.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { render } from '../../utils';
import ProvasTab from '@/components/admin/simulados/ProvasTab';

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('@/services/admin/simulados', () => ({ encerrarSimulado: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/services/admin/logAction', () => ({ logAdminAction: vi.fn() }));

const base = {
  descricao: null,
  data_liberacao: '2026-01-10T13:00:00.000Z',
  data_encerramento: '2027-12-20T13:00:00.000Z',
  duracao_minutos: 180,
  status: 'ativo',
  created_at: '2026-01-01T00:00:00.000Z',
  ies_ids: ['ies-1'],
  liberacao_desempenho: 'imediato',
  data_liberacao_desempenho: null,
};
const ROWS = [
  { ...base, id: '6de79f4b-7d75-4d94-9201-6e28aba056f5', nome: '1º Simulado UVA' },
  { ...base, id: '0a1b2c3d-1111-4222-8333-444455556666', nome: 'Simulado ENAMED' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockImplementation((table: string) => {
    if (table === 'ies') {
      return { select: () => ({ order: () => Promise.resolve({ data: [{ id: 'ies-1', nome: 'Alpha' }], error: null }) }) };
    }
    if (table === 'simulados_admin') {
      return { select: () => ({ order: () => Promise.resolve({ data: ROWS, error: null }) }) };
    }
    return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
  });
  mockRpc.mockResolvedValue({ data: [], error: null });
});

describe('ProvasTab — ID do simulado', () => {
  it('mostra o ID de cada simulado logo abaixo do nome', async () => {
    render(<ProvasTab />);
    const nome = await screen.findByText('1º Simulado UVA');
    const celula = nome.closest('td')!;
    expect(within(celula).getByTestId('simulado-id')).toHaveTextContent('6de79f4b-7d75-4d94-9201-6e28aba056f5');
    const outra = screen.getByText('Simulado ENAMED').closest('td')!;
    expect(within(outra).getByTestId('simulado-id')).toHaveTextContent('0a1b2c3d-1111-4222-8333-444455556666');
    expect(screen.getAllByTestId('simulado-id')).toHaveLength(2);
  });

  it('é discreto (cinza claro, fonte pequena) e selecionável com um clique', async () => {
    render(<ProvasTab />);
    const [id] = await screen.findAllByTestId('simulado-id');
    expect(id!.className).toContain('text-muted-foreground');
    expect(id!.className).toContain('text-[11px]');
    expect(id!.className).toContain('select-all');
    expect(id).toHaveAttribute('title', expect.stringMatching(/ID do simulado/));
  });
});
