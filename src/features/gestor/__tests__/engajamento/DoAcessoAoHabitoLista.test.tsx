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

/** "Do acesso ao hábito": clicar numa faixa lista os alunos dela, como "Quem não voltou" (§12.2). */

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

describe('DoAcessoAoHabito — lista da faixa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLista.mockReturnValue(
      resultadoGestor(listaEngajamento('habito_alto', [linhaLista({ diasAtivosMes: 11 })], { total: 35, pageSize: 5 })),
    );
  });

  it('as quatro faixas são botões; a "Base ativa" não é', () => {
    montar();
    for (const c of ['baixo', 'medio', 'alto', 'altissimo']) expect(faixa(c)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('habito-faixa-base')).not.toBeInTheDocument();
    expect(faixa('alto')).toHaveAccessibleName('Alto engajamento: 35 alunos · clique para listar');
  });

  it('sem faixa selecionada não há lista nem consulta de lista', () => {
    montar();
    expect(screen.queryByTestId('habito-lista')).not.toBeInTheDocument();
    expect(mockLista).not.toHaveBeenCalled();
  });

  it('clicar numa faixa consulta a categoria dela (5 linhas) e mostra a prévia com os dias ativos no mês', () => {
    montar();
    fireEvent.click(faixa('alto'));
    expect(faixa('alto')).toHaveAttribute('aria-pressed', 'true');
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'habito_alto', '', 1, 5);
    const lista = screen.getByTestId('habito-lista');
    expect(within(lista).getByRole('heading', { level: 3, name: 'Alunos: alto engajamento' })).toBeInTheDocument();
    expect(within(lista).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Aluno',
      'Sem.',
      'Dias ativos no mês',
      'Dias sem consumo',
    ]);
    expect(within(lista).getByRole('row', { name: /Ana Clara/ })).toHaveTextContent('11');
  });

  it.each([
    ['baixo', 'habito_baixo'],
    ['medio', 'habito_medio'],
    ['altissimo', 'habito_altissimo'],
  ])('a faixa %s consulta %s', (chave, categoria) => {
    montar();
    fireEvent.click(faixa(chave));
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, categoria, '', 1, 5);
  });

  it('clicar de novo na mesma faixa fecha a lista; clicar em outra troca', () => {
    montar();
    fireEvent.click(faixa('alto'));
    fireEvent.click(faixa('medio'));
    expect(faixa('alto')).toHaveAttribute('aria-pressed', 'false');
    expect(faixa('medio')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { level: 3, name: 'Alunos: médio engajamento' })).toBeInTheDocument();
    fireEvent.click(faixa('medio'));
    expect(screen.queryByTestId('habito-lista')).not.toBeInTheDocument();
  });

  it('"Mostrando 5 de 35 alunos" e "Ver lista completa" quando há mais de 5', () => {
    montar();
    fireEvent.click(faixa('alto'));
    expect(screen.getByText('Mostrando 1 de 35 alunos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver lista completa' })).toBeInTheDocument();
  });

  it('com 5 ou menos, sem "Ver lista completa"', () => {
    mockLista.mockReturnValue(resultadoGestor(listaEngajamento('habito_altissimo', [linhaLista()], { total: 5, pageSize: 5 })));
    montar();
    fireEvent.click(faixa('altissimo'));
    expect(screen.queryByRole('button', { name: 'Ver lista completa' })).not.toBeInTheDocument();
  });

  it('"Ver lista completa" abre o pop-up da faixa, com a coluna "Dias ativos no mês"', () => {
    montar();
    fireEvent.click(faixa('alto'));
    fireEvent.click(screen.getByRole('button', { name: 'Ver lista completa' }));
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'habito_alto', '', 1, 20);
    const dialogo = screen.getByTestId('lista-alunos-dialog');
    expect(within(dialogo).getByText('Dias ativos no mês')).toBeInTheDocument();
    expect(within(dialogo).getByText('11 dias ativos no mês')).toBeInTheDocument();
    expect(within(dialogo).getByText(/8 a 14 dias ativos no mês/)).toBeInTheDocument();
  });

  it('com aluno filtrado as faixas viram "Sim"/"Não" e não são clicáveis', () => {
    montar(visaoGeralComAluno());
    expect(screen.queryByTestId('habito-faixa-alto')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('habito-valor').length).toBeGreaterThan(0);
    expect(mockLista).not.toHaveBeenCalled();
  });

  it('sem `filtros` o bloco continua só de leitura', () => {
    montar(visaoGeralParacatu(), null);
    expect(screen.queryByTestId('habito-faixa-alto')).not.toBeInTheDocument();
  });
});
