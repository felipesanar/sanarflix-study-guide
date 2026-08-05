import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { SeletorSimulados } from '@/features/gestor/components/SeletorSimulados';
import type { ItemCronograma } from '@/features/gestor/api/types';

const item = (over: Partial<ItemCronograma>): ItemCronograma => ({
  id: 's1',
  nome: 'Simulado 1',
  data: '2026-03-10T13:00:00Z',
  status: 'realizado',
  modalidade: 'online',
  participantes: 40,
  ...over,
});

const REALIZADOS: ItemCronograma[] = [
  item({ id: 's1', nome: 'Simulado 1' }),
  item({ id: 's2', nome: 'Simulado 2' }),
  item({ id: 's3', nome: 'Simulado 3' }),
  item({ id: 's4', nome: 'Simulado 4' }),
  item({ id: 's5', nome: 'Simulado 5' }),
  item({ id: 's6', nome: 'Simulado 6' }),
];

describe('SeletorSimulados', () => {
  it('não oferece nenhuma opção "todos" — a seleção é sempre explícita (§4.7.1)', () => {
    render(<SeletorSimulados itens={REALIZADOS.slice(0, 2)} selecionados={['s1']} onChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /todos/i })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('desabilita simulado previsto e em processamento, mostrando o motivo (§4.7.1, §4.10)', () => {
    render(
      <SeletorSimulados
        itens={[
          item({ id: 's1', nome: 'Simulado 1' }),
          item({ id: 's2', nome: 'Simulado 2', status: 'processing' }),
          item({ id: 's3', nome: 'Simulado 3', status: 'previsto', data: null }),
          item({ id: 's4', nome: 'Simulado 4', status: 'agendado' }),
        ]}
        selecionados={['s1']}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Simulado 1' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Simulado 2 — Gabarito em processamento' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Simulado 3 — Simulado previsto, sem data definida' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Simulado 4 — Simulado ainda não realizado' })).toBeDisabled();
    expect(screen.getByText('Gabarito em processamento')).toBeInTheDocument();
  });

  it('soma o id ao clicar num simulado não selecionado', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SeletorSimulados itens={REALIZADOS.slice(0, 3)} selecionados={['s1']} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Simulado 2' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual(expect.arrayContaining(['s1', 's2']));
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });

  it('permite chegar a zero e então cobra a seleção mínima', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <SeletorSimulados itens={REALIZADOS.slice(0, 3)} selecionados={['s1']} onChange={onChange} />,
    );

    await user.click(screen.getByRole('button', { name: 'Simulado 1' }));
    expect(onChange).toHaveBeenCalledWith([]);

    rerender(<SeletorSimulados itens={REALIZADOS.slice(0, 3)} selecionados={[]} onChange={onChange} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha ao menos um simulado');
  });

  it('acima de 5 simulados avisa sobre legibilidade sem bloquear (§4.7.2, caso 5)', () => {
    render(<SeletorSimulados itens={REALIZADOS} selecionados={['s1', 's2', 's3', 's4', 's5', 's6']} onChange={vi.fn()} />);

    const aviso = screen.getByTestId('aviso-legibilidade');
    expect(aviso).toHaveAttribute('role', 'status');
    expect(aviso).toHaveTextContent('6 simulados selecionados');
    expect(screen.queryByRole('alert')).toBeNull();
    REALIZADOS.forEach((s) => expect(screen.getByRole('button', { name: s.nome })).toBeEnabled());
  });

  it('não avisa com exatamente 5 selecionados', () => {
    render(<SeletorSimulados itens={REALIZADOS} selecionados={['s1', 's2', 's3', 's4', 's5']} onChange={vi.fn()} />);
    expect(screen.queryByTestId('aviso-legibilidade')).toBeNull();
  });
});
