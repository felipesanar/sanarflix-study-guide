import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';
import { EstadoVazioDetalhamento } from '@/features/gestor/components/EstadoVazioDetalhamento';

describe('EstadoVazioDetalhamento (§12 caso 4)', () => {
  it('põe o seletor em evidência e nega a leitura "de todos"', () => {
    render(<EstadoVazioDetalhamento />);

    // Copy da referência (LIGHT.html, bloco "Nenhum simulado selecionado").
    expect(screen.getByRole('heading', { name: 'Selecione um simulado' })).toBeInTheDocument();
    expect(screen.getByTestId('detalhamento-vazio')).toHaveTextContent(/não há leitura de todos/i);
  });

  it('usa o glifo Dendê no tile, nunca outra família de ícone', () => {
    const { container } = render(<EstadoVazioDetalhamento />);

    const glifo = container.querySelector('i.icon-dende-icons-insights-outlined');
    expect(glifo).not.toBeNull();
    expect(glifo).toHaveStyle({ fontSize: '26px' });
    expect(container.querySelector('svg')).toBeNull();
  });

  it('só oferece a ação primária quando há para onde ir', () => {
    const { unmount } = render(<EstadoVazioDetalhamento />);
    expect(screen.queryByRole('button', { name: 'Selecionar simulado' })).toBeNull();
    unmount();

    const aoSelecionar = vi.fn();
    render(<EstadoVazioDetalhamento aoSelecionar={aoSelecionar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar simulado' }));
    expect(aoSelecionar).toHaveBeenCalledTimes(1);
  });
});
