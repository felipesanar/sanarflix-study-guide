import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { BlocoProvaOficial } from '@/features/gestor/components/BlocoProvaOficial';
import type { ProvaOficialGestor } from '@/features/gestor/api/types';

/**
 * Task 4, Step 1 — fixture base da Task 5 brief: 124 participantes, conceito
 * 4 (estimado, nunca oficial), 72% proficientes, média de 66,9 acertos.
 */
const provaFake = (overrides: Partial<ProvaOficialGestor> = {}): ProvaOficialGestor => ({
  simuladoId: 'sim-enamed-1',
  nome: 'ENAMED 2026',
  data: '2026-11-08T00:00:00.000Z',
  participantes: 124,
  comTri: 124,
  conceito: 4,
  proficientesPct: 72,
  mediaAcertos: 66.9,
  totalQuestoes: 100,
  amostraPequena: false,
  numeracaoCaderno2: {},
  ...overrides,
});

describe('BlocoProvaOficial', () => {
  it('mostra nome, participantes, conceito estimado, proficientes e média de acertos', () => {
    render(<BlocoProvaOficial prova={provaFake()} onVerDetalhamento={vi.fn()} />);

    expect(screen.getByText(/ENAMED 2026/)).toBeInTheDocument();
    expect(screen.getByText(/124 participantes/)).toBeInTheDocument();
    expect(screen.getByText(/conceito estimado 4/)).toBeInTheDocument();
    expect(screen.getByText(/72% proficientes/)).toBeInTheDocument();
    expect(screen.getByText(/média de 66,9 acertos/)).toBeInTheDocument();
  });

  it('mostra o aviso de estimativa Sanar (TRI) com gabarito preliminar', () => {
    render(<BlocoProvaOficial prova={provaFake()} onVerDetalhamento={vi.fn()} />);

    expect(
      screen.getByText('Estimativa Sanar (TRI) com gabarito preliminar. O conceito oficial é divulgado pelo INEP.'),
    ).toBeInTheDocument();
  });

  it('o selo "★ Prova oficial" aparece no cabeçalho', () => {
    render(<BlocoProvaOficial prova={provaFake()} onVerDetalhamento={vi.fn()} />);
    expect(screen.getByText('★ Prova oficial')).toBeInTheDocument();
  });

  it('clicar em "Ver detalhamento" chama onVerDetalhamento com o simuladoId', async () => {
    const user = userEvent.setup();
    const aoVerDetalhamento = vi.fn();
    render(<BlocoProvaOficial prova={provaFake()} onVerDetalhamento={aoVerDetalhamento} />);

    await user.click(screen.getByRole('button', { name: 'Ver detalhamento' }));
    expect(aoVerDetalhamento).toHaveBeenCalledWith('sim-enamed-1');
  });

  it('com participantes: 0, mostra "Sem participantes neste recorte"', () => {
    render(
      <BlocoProvaOficial
        prova={provaFake({ participantes: 0, comTri: 0, conceito: null, proficientesPct: null })}
        onVerDetalhamento={vi.fn()}
      />,
    );

    expect(screen.getByText('Sem participantes neste recorte')).toBeInTheDocument();
  });

  it('com amostraPequena: true, mostra o mesmo aviso de cobertura parcial do resto do portal', () => {
    render(
      <BlocoProvaOficial prova={provaFake({ participantes: 8, amostraPequena: true })} onVerDetalhamento={vi.fn()} />,
    );

    expect(screen.getByText('cobertura parcial')).toBeInTheDocument();
  });

  it('com comTri: 0, mostra "Aguardando cálculo da nota" no lugar do conceito e dos proficientes', () => {
    render(
      <BlocoProvaOficial
        prova={provaFake({ comTri: 0, conceito: null, proficientesPct: null })}
        onVerDetalhamento={vi.fn()}
      />,
    );

    expect(screen.getByText('Aguardando cálculo da nota')).toBeInTheDocument();
    expect(screen.queryByText(/conceito estimado/)).not.toBeInTheDocument();
    expect(screen.queryByText(/proficientes/)).not.toBeInTheDocument();
  });
});
