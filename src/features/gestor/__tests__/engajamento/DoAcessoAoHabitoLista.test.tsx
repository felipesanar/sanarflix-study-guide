import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockLista = vi.fn();
vi.mock('@/features/gestor/api/engajamento', () => ({
  useEngajamentoLista: (...args: unknown[]) => mockLista(...args),
  buscarListaCompleta: vi.fn(),
}));
vi.mock('@/features/gestor/api/queries', () => ({ useGestorContexto: () => ({ data: { podeExportar: false } }) }));

import { DoAcessoAoHabito } from '@/features/gestor/components/engajamento/DoAcessoAoHabito';
import { linhaLista, listaEngajamento } from '../fixtures/engajamento/lista';
import { resultadoGestor, visaoGeralComAluno, visaoGeralParacatu } from '../fixtures/engajamento/visaoGeral';

/** "Do acesso ao hábito": clicar numa faixa abre o pop-up com os alunos dela (§12.2). */

const FILTROS = { iesId: 'ies-1', inicio: '2026-05-01', fim: '2026-10-22', semestre: null, alunoId: null, tipo: 'todos' as const, periodo: '6m' };

const montar = (d = visaoGeralParacatu(), filtros: typeof FILTROS | null = FILTROS) =>
  render(
    <TooltipProvider>
      <MemoryRouter>
        <DoAcessoAoHabito dados={d} consulta={resultadoGestor(d)} filtros={filtros ?? undefined} />
      </MemoryRouter>
    </TooltipProvider>,
  );

const faixa = (chave: string) => screen.getByTestId(`habito-faixa-${chave}`);

describe('DoAcessoAoHabito — pop-up da faixa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLista.mockReturnValue(
      resultadoGestor(listaEngajamento('habito_alto', [linhaLista({ diasAtivosMes: 11 })], { total: 35, pageSize: 20 })),
    );
  });

  it('as quatro faixas são botões que abrem pop-up; a "Base ativa" não é', () => {
    montar();
    for (const c of ['baixo', 'medio', 'alto', 'altissimo']) expect(faixa(c)).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByTestId('habito-faixa-base')).not.toBeInTheDocument();
    expect(faixa('alto')).toHaveAccessibleName('Alto engajamento: 35 alunos · ver lista de alunos');
  });

  it('sinaliza que dá para clicar: "Ver alunos" em cada faixa, e só nelas', () => {
    montar();
    expect(screen.getAllByTestId('habito-dica-clique')).toHaveLength(4);
    for (const c of ['baixo', 'medio', 'alto', 'altissimo']) {
      expect(within(faixa(c)).getByTestId('habito-dica-clique')).toHaveTextContent('Ver alunos');
    }
    expect(within(screen.getByTestId('habito-base')).queryByTestId('habito-dica-clique')).not.toBeInTheDocument();
  });

  it('sem clique não há pop-up nem consulta de lista', () => {
    montar();
    expect(screen.queryByTestId('lista-alunos-dialog')).not.toBeInTheDocument();
    expect(mockLista).not.toHaveBeenCalled();
  });

  it.each([
    ['baixo', 'habito_baixo'],
    ['medio', 'habito_medio'],
    ['alto', 'habito_alto'],
    ['altissimo', 'habito_altissimo'],
  ])('clicar em %s abre o pop-up e consulta %s (20 por página)', (chave, categoria) => {
    montar();
    fireEvent.click(faixa(chave));
    expect(screen.getByTestId('lista-alunos-dialog')).toBeInTheDocument();
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, categoria, '', 1, 20);
  });

  it('o pop-up traz as colunas Aluno, Sem., Dias ativos no mês e Dias sem consumo, e o bloco não expande', () => {
    montar();
    fireEvent.click(faixa('alto'));
    const dialogo = screen.getByTestId('lista-alunos-dialog');
    expect(within(dialogo).getByRole('heading', { name: 'Alunos: alto engajamento' })).toBeInTheDocument();
    expect(within(dialogo).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Aluno',
      'Sem.',
      'Dias ativos no mês',
      'Dias sem consumo',
    ]);
    expect(within(dialogo).getByRole('row', { name: /Ana Clara/ })).toHaveTextContent('11');
    expect(within(dialogo).getByText(/8 a 14 dias ativos no mês/)).toBeInTheDocument();
    // nada de lista dentro do bloco
    expect(screen.queryByTestId('habito-lista')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('bloco-do-acesso-ao-habito')).queryAllByRole('table')).toHaveLength(0);
  });

  it('fechar o pop-up volta ao bloco', () => {
    montar();
    fireEvent.click(faixa('medio'));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar lista' }));
    expect(screen.queryByTestId('lista-alunos-dialog')).not.toBeInTheDocument();
  });

  it('com aluno filtrado as faixas viram "Sim"/"Não", sem sinalização e sem clique', () => {
    montar(visaoGeralComAluno());
    expect(screen.queryByTestId('habito-faixa-alto')).not.toBeInTheDocument();
    expect(screen.queryByTestId('habito-dica-clique')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('habito-valor').length).toBeGreaterThan(0);
    expect(mockLista).not.toHaveBeenCalled();
  });

  it('sem `filtros` o bloco continua só de leitura', () => {
    montar(visaoGeralParacatu(), null);
    expect(screen.queryByTestId('habito-faixa-alto')).not.toBeInTheDocument();
    expect(screen.queryByTestId('habito-dica-clique')).not.toBeInTheDocument();
  });
});
