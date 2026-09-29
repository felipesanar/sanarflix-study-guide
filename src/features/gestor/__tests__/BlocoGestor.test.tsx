import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/utils';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';

describe('BlocoGestor', () => {
  it('não renderiza a faixa de recorte parcial', () => {
    render(
      <BlocoGestor estado="ok">
        <p>conteúdo do bloco</p>
      </BlocoGestor>,
    );
    expect(screen.queryByTestId('faixa-parcial')).not.toBeInTheDocument();
    expect(screen.getByText('conteúdo do bloco')).toBeInTheDocument();
  });
});
