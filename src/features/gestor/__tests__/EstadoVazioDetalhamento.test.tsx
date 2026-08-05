import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/utils';
import { EstadoVazioDetalhamento } from '@/features/gestor/components/EstadoVazioDetalhamento';

describe('EstadoVazioDetalhamento (§12 caso 4)', () => {
  it('põe o seletor em evidência e nega a leitura "de todos"', () => {
    render(<EstadoVazioDetalhamento />);

    expect(screen.getByRole('heading', { name: 'Escolha ao menos um simulado' })).toBeInTheDocument();
    expect(screen.getByTestId('detalhamento-vazio')).toHaveTextContent(/não há leitura de todos/i);
  });
});
