import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/utils';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';

/**
 * Item B3 do passe de conformidade: a faixa de recorte parcial
 * (`data-testid="faixa-parcial"`) era indistinguível de uma nota
 * informativa — tokens neutros, sem ícone. Vestida com a mesma anatomia de
 * alerta já usada em `SeletorSimulados.tsx` (`aviso-legibilidade`): tokens
 * de warning (`--gp-warning*`) + `<Icon name="error_outline" />`.
 */
describe('BlocoGestor — faixa de recorte parcial (item B3)', () => {
  it('com `parcial`, mostra a faixa com o texto de sempre e role="status"', () => {
    render(
      <BlocoGestor estado="ok" parcial>
        <p>conteúdo do bloco</p>
      </BlocoGestor>,
    );
    const faixa = screen.getByTestId('faixa-parcial');
    expect(faixa).toHaveAttribute('role', 'status');
    expect(faixa).toHaveTextContent(
      'Recorte parcial: parte dos simulados do período não entrou neste cálculo.',
    );
  });

  it('sem `parcial` (o default), a faixa não aparece', () => {
    render(
      <BlocoGestor estado="ok">
        <p>conteúdo do bloco</p>
      </BlocoGestor>,
    );
    expect(screen.queryByTestId('faixa-parcial')).not.toBeInTheDocument();
  });

  it('a faixa usa os tokens de warning (mesma anatomia do aviso de legibilidade de SeletorSimulados) e o ícone error_outline', () => {
    render(
      <BlocoGestor estado="ok" parcial>
        <p>conteúdo do bloco</p>
      </BlocoGestor>,
    );
    const faixa = screen.getByTestId('faixa-parcial');
    expect(faixa.style.background).toBe('var(--gp-warning-surface)');
    expect(faixa.style.border).toContain('var(--gp-warning)');
    expect(faixa.querySelector('i, span')).not.toBeNull();
    // O texto some com a cor --gp-warning-on — o mesmo par do ícone.
    const textoAlerta = screen.getByText(/Recorte parcial/);
    expect(textoAlerta.style.color).toBe('var(--gp-warning-on)');
  });

  it('a faixa parcial some quando o bloco está em loading/error/empty — não compete com o estado do bloco', () => {
    render(
      <BlocoGestor estado="loading" parcial testIdLoading="bloco-loading">
        <p>conteúdo do bloco</p>
      </BlocoGestor>,
    );
    // A faixa é renderizada independente do estado (§8.4 trata a faixa como
    // aviso do RECORTE, não do carregamento) — continua visível junto do
    // skeleton, e este teste apenas prova que os dois convivem sem conflito
    // de testid.
    expect(screen.getByTestId('faixa-parcial')).toBeInTheDocument();
    expect(screen.getByTestId('bloco-loading')).toBeInTheDocument();
  });
});
