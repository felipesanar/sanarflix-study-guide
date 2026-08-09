import { describe, expect, it, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AlternadorDensidade,
  CabecalhoTabela,
  Celula,
  CelulaCabecalho,
  CorpoTabela,
  definirDensidade,
  LinhaTabela,
  PADDING_DENSIDADE,
  TabelaGestor,
} from '@/features/gestor/components/tabela';

/**
 * Onda 4 do roadmap de UI (item 6 do Top 10): densidade de linha. O store é de
 * módulo, então cada teste devolve o padrão no `afterEach` — sem isso a ordem
 * dos testes passaria a importar.
 */
afterEach(() => definirDensidade('confortavel'));

function Tabela() {
  return (
    <>
      <AlternadorDensidade />
      <TabelaGestor rotulo="Alunos">
        <CabecalhoTabela>
          <tr>
            <CelulaCabecalho>Aluno</CelulaCabecalho>
          </tr>
        </CabecalhoTabela>
        <CorpoTabela>
          <LinhaTabela ultima>
            <Celula>Fulano</Celula>
          </LinhaTabela>
        </CorpoTabela>
      </TabelaGestor>
    </>
  );
}

describe('densidade da tabela (Onda 4)', () => {
  it('começa em confortável, com a régua original do handoff §6', () => {
    render(<Tabela />);

    expect(screen.getByRole('radio', { name: /confortável/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('cell', { name: 'Fulano' })).toHaveStyle({
      padding: PADDING_DENSIDADE.confortavel.celula,
    });
  });

  it('compacta reduz a altura de linha do cabeçalho e da célula sem mexer na fonte', async () => {
    const user = userEvent.setup();
    render(<Tabela />);

    await user.click(screen.getByRole('radio', { name: /compacta/i }));

    expect(screen.getByRole('cell', { name: 'Fulano' })).toHaveStyle({
      padding: PADDING_DENSIDADE.compacta.celula,
      fontSize: '12px',
    });
    expect(screen.getByRole('columnheader', { name: 'Aluno' })).toHaveStyle({
      padding: PADDING_DENSIDADE.compacta.cabecalho,
    });
  });

  it('a escolha é global: uma tabela montada depois já nasce compacta', () => {
    definirDensidade('compacta');
    render(<Tabela />);

    expect(screen.getByRole('radio', { name: /compacta/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('cell', { name: 'Fulano' })).toHaveStyle({
      padding: PADDING_DENSIDADE.compacta.celula,
    });
  });
});
