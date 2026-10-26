import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockLista = vi.fn();
const mockBuscarListaCompleta = vi.fn();
vi.mock('@/features/gestor/api/engajamento', () => ({
  useEngajamentoLista: (...args: unknown[]) => mockLista(...args),
  buscarListaCompleta: (...args: unknown[]) => mockBuscarListaCompleta(...args),
}));

const mockContexto = vi.fn();
vi.mock('@/features/gestor/api/queries', () => ({
  useGestorContexto: () => mockContexto(),
}));

const mockBaixarCsv = vi.fn();
vi.mock('@/features/gestor/lib/exportarCsv', async () => ({
  ...(await vi.importActual<typeof import('@/features/gestor/lib/exportarCsv')>('@/features/gestor/lib/exportarCsv')),
  baixarCsv: (...args: unknown[]) => mockBaixarCsv(...args),
}));

import { NivelEngajamento } from '@/features/gestor/components/engajamento/NivelEngajamento';
import { rotuloRecorteLista, textoDetalheLinha } from '@/features/gestor/components/engajamento/ListaAlunosDialog';
import { listaEngajamento, linhaLista } from '../fixtures/engajamento/lista';
import { resultadoGestor, visaoGeralComAluno, visaoGeralParacatu } from '../fixtures/engajamento/visaoGeral';

/** Nível de engajamento e pop-up de lista (spec 2026-10-22-engajamento §4.4, §8.3, §12.2). */

const FILTROS = {
  iesId: 'ies-1',
  inicio: '2026-05-01',
  fim: '2026-10-22',
  semestre: null,
  alunoId: null,
  tipo: 'todos' as const,
  periodo: '6m',
};

const montar = (dados = visaoGeralParacatu(), filtros: typeof FILTROS & Record<string, unknown> = FILTROS) =>
  render(
    <TooltipProvider>
      <MemoryRouter>
        <NivelEngajamento dados={dados} consulta={resultadoGestor(dados)} filtros={filtros} />
      </MemoryRouter>
    </TooltipProvider>,
  );

const cartao = (nivel: string) => screen.getByTestId(`nivel-${nivel}`);

describe('NivelEngajamento — cartões (§12.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContexto.mockReturnValue({ data: { podeExportar: true } });
    mockLista.mockReturnValue(resultadoGestor(listaEngajamento('frequente', [linhaLista()])));
  });

  it('título, descrição e os 4 cartões na ordem fixa', () => {
    montar();
    expect(screen.getByRole('heading', { level: 2, name: 'Nível de engajamento' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Combina recência (acessou nos últimos 30 dias?) com frequência (quantos dias estudou) · toda a base ativa cai em exatamente uma categoria',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Ativo e frequente',
      'Ativo, mas esporádico',
      'Era frequente e parou',
      'Nunca engajou',
    ]);
  });

  it('cada cartão mostra a regra (na linha e no aria-label do "i")', () => {
    montar();
    const regras: Record<string, string> = {
      frequente: 'Acessou nos últimos 30 dias e estudou em 15 dias ou mais nesse intervalo',
      esporadico: 'Acessou nos últimos 30 dias, mas estudou em menos de 15 dias',
      parou: 'Sem atividade há mais de 30 dias, mas teve algum mês do período com 15 dias ativos ou mais',
      nunca: 'Sem atividade há mais de 30 dias e nenhum mês com 15 dias ativos, ou nunca acessou',
    };
    for (const [nivel, regra] of Object.entries(regras)) {
      expect(within(cartao(nivel)).getByText(regra)).toBeInTheDocument();
      expect(within(cartao(nivel)).getByRole('button', { name: regra })).toHaveAttribute('title', regra);
    }
  });

  it('contagem e "ALUNOS · pct%" sobre a base; as quatro somam a base (V9)', () => {
    const d = visaoGeralParacatu();
    expect(d.niveis.reduce((s, n) => s + n.total, 0)).toBe(d.kpis.baseAtiva);
    montar(d);
    const lido = (n: string) => ({
      total: within(cartao(n)).getByTestId('nivel-total').textContent,
      pct: within(cartao(n)).getByText(/^ALUNOS ·/).textContent,
    });
    expect(lido('frequente')).toEqual({ total: '4', pct: 'ALUNOS · 1%' });
    expect(lido('esporadico')).toEqual({ total: '193', pct: 'ALUNOS · 37%' });
    expect(lido('parou')).toEqual({ total: '15', pct: 'ALUNOS · 3%' });
    expect(lido('nunca')).toEqual({ total: '309', pct: 'ALUNOS · 59%' });
  });

  it('3 chips de amostra e "+N" só quando há mais do que a amostra', () => {
    montar();
    const frequente = within(cartao('frequente'));
    expect(frequente.getByText('Ana Clara Ribeiro')).toBeInTheDocument();
    expect(frequente.getByRole('button', { name: 'Ver todos os 4 alunos com ativo e frequente' })).toHaveTextContent('+1');
    expect(
      within(cartao('esporadico')).getByRole('button', { name: 'Ver todos os 193 alunos com ativo, mas esporádico' }),
    ).toHaveTextContent('+190');
    expect(within(cartao('nunca')).getByRole('button', { name: 'Ver todos os 309 alunos com nunca engajou' })).toHaveTextContent('+306');
  });

  it('sem "+N" quando todos cabem na amostra', () => {
    const d = visaoGeralParacatu();
    d.niveis = d.niveis.map((n) => (n.nivel === 'frequente' ? { ...n, total: 3 } : n));
    montar(d);
    expect(within(cartao('frequente')).queryByRole('button', { name: /Ver todos/ })).not.toBeInTheDocument();
  });

  it('cartão vazio: "Nenhum aluno nesta categoria neste recorte", sem chips', () => {
    const d = visaoGeralParacatu();
    d.niveis = d.niveis.map((n) => (n.nivel === 'parou' ? { ...n, total: 0, amostra: [] } : n));
    montar(d);
    expect(within(cartao('parou')).getByText('Nenhum aluno nesta categoria neste recorte')).toBeInTheDocument();
    expect(within(cartao('parou')).getByTestId('nivel-total')).toHaveTextContent('0');
    expect(within(cartao('parou')).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('rodapé com a base ativa; com aluno filtrado, "(1 aluno)"', () => {
    const { unmount } = montar();
    expect(
      screen.getByText(
        'As quatro categorias somam a base ativa (521 alunos). Régua única: 15 dias ativos em 30 (ou num mês) define "frequente".',
      ),
    ).toBeInTheDocument();
    unmount();

    montar(visaoGeralComAluno());
    expect(
      screen.getByText(
        'As quatro categorias somam a base ativa (1 aluno). Régua única: 15 dias ativos em 30 (ou num mês) define "frequente".',
      ),
    ).toBeInTheDocument();
  });

  it('cores da §13: topo semântico nos três primeiros e neutro em "Nunca engajou"', () => {
    montar();
    expect(cartao('frequente').style.borderTop).toContain('--gp-success');
    expect(cartao('esporadico').style.borderTop).toContain('--gp-warning');
    expect(cartao('parou').style.borderTop).toContain('--gp-danger');
    expect(cartao('nunca').style.borderTop).toContain('--gp-text-3');
    expect(within(cartao('parou')).getByTestId('nivel-total').style.color).toContain('--gp-danger-on');
  });
});

describe('ListaAlunosDialog — aberto pelo "+N" (§12.2)', () => {
  const abrir = async (nivel: string, nome: string) => {
    const user = userEvent.setup();
    const botao = within(cartao(nivel)).getByRole('button', { name: new RegExp(`alunos com ${nome}`, 'i') });
    await user.click(botao);
    return { user, botao };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockContexto.mockReturnValue({ data: { podeExportar: true } });
    mockLista.mockReturnValue(
      resultadoGestor(listaEngajamento('frequente', [linhaLista()], { total: 4 })),
    );
  });

  it('abre com título, subtítulo (total · regra · IES · período), colunas e busca', async () => {
    montar();
    await abrir('frequente', 'ativo e frequente');

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Ativo e frequente' })).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        '4 alunos · Acessou nos últimos 30 dias e estudou em 15 dias ou mais nesse intervalo · PARACATU · últimos 6 meses',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Aluno',
      'Sem.',
      'Última atividade',
      'Dias sem consumo',
    ]);
    expect(within(dialog).getByPlaceholderText('Buscar aluno pelo nome')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Buscar aluno nesta lista')).toBeInTheDocument();
  });

  it('consulta a lista da categoria, página 1 de 20, com o recorte da página', async () => {
    montar();
    await abrir('frequente', 'ativo e frequente');
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'frequente', '', 1, 20);
  });

  it('frequente/esporádico: "última: há 3 dias · 9 dias ativos em 30" e "Dias sem consumo"', async () => {
    montar();
    await abrir('frequente', 'ativo e frequente');
    const linha = within(screen.getByRole('dialog')).getByRole('row', { name: /Ana Clara Ribeiro/ });
    expect(within(linha).getByText('8º')).toBeInTheDocument();
    expect(within(linha).getByText('última: há 3 dias · 9 dias ativos em 30')).toBeInTheDocument();
    expect(within(linha).getAllByRole('cell').at(-1)).toHaveTextContent('3');
  });

  it('parou/nunca: coluna "Melhor mês" com "set/26 · 18 dias ativos", "— (nunca acessou)" e "— (sem atividade no período)"', async () => {
    mockLista.mockReturnValue(
      resultadoGestor(
        listaEngajamento('parou', [
          linhaLista({ id: 'a', nome: 'Gabriela Dias', diasSemAtividade: 45 }),
          linhaLista({ id: 'b', nome: 'João Pedro Silva', melhorMes: null, melhorMesDias: 0, diasSemAtividade: null, ultimaAtividade: null, detalhe: null }),
          linhaLista({ id: 'c', nome: 'Karina Pires', melhorMes: null, melhorMesDias: 0, diasSemAtividade: 400 }),
        ]),
      ),
    );
    montar();
    await abrir('parou', 'era frequente e parou');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('columnheader', { name: 'Melhor mês' })).toBeInTheDocument();
    expect(within(dialog).getByText('set/26 · 18 dias ativos')).toBeInTheDocument();
    expect(within(dialog).getByText('— (nunca acessou)')).toBeInTheDocument();
    expect(within(dialog).getByText('— (sem atividade no período)')).toBeInTheDocument();
    // nunca acessou: "Dias sem consumo" vazio
    const nunca = within(dialog).getByRole('row', { name: /João Pedro Silva/ });
    expect(within(nunca).getAllByRole('cell').at(-1)).toHaveTextContent('—');
  });

  it('subtítulo do recorte com semestre filtrado: "filtro: 8º semestre"', async () => {
    montar(visaoGeralParacatu(), { ...FILTROS, semestre: 8 });
    await abrir('frequente', 'ativo e frequente');
    expect(within(screen.getByRole('dialog')).getByText(/· filtro: 8º semestre$/)).toBeInTheDocument();
  });

  it('rotuloRecorteLista: aluno vence semestre, que vence IES · período', () => {
    const base = { iesNome: 'PARACATU', periodoRotulo: 'últimos 6 meses' };
    expect(rotuloRecorteLista({ ...base, alunoNome: 'Ana Clara Ribeiro', semestre: null })).toBe('filtro: Ana Clara Ribeiro');
    expect(rotuloRecorteLista({ ...base, alunoNome: null, semestre: 8 })).toBe('filtro: 8º semestre');
    expect(rotuloRecorteLista({ ...base, alunoNome: null, semestre: null })).toBe('PARACATU · últimos 6 meses');
  });

  it('fechar: botão "Fechar lista" fecha e devolve o foco ao "+N"', async () => {
    montar();
    const { user, botao } = await abrir('frequente', 'ativo e frequente');
    await user.click(screen.getByRole('button', { name: 'Fechar lista' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it('Esc também fecha', async () => {
    montar();
    const { user } = await abrir('frequente', 'ativo e frequente');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lista vazia da categoria: mensagem própria', async () => {
    mockLista.mockReturnValue(resultadoGestor(listaEngajamento('frequente', [])));
    montar();
    await abrir('frequente', 'ativo e frequente');
    expect(within(screen.getByRole('dialog')).getByText('Nenhum aluno nesta categoria neste recorte')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it('carregando: linhas de esqueleto, sem afirmar total', async () => {
    mockLista.mockReturnValue(resultadoGestor(undefined, { isLoading: true }));
    montar();
    await abrir('frequente', 'ativo e frequente');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('0 alunos', { exact: false })).toBeInTheDocument();
    expect(within(dialog).queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it('erro: "Tentar novamente" refaz a consulta', async () => {
    const refetch = vi.fn();
    mockLista.mockReturnValue(resultadoGestor(undefined, { isError: true, refetch }));
    montar();
    await abrir('frequente', 'ativo e frequente');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('ListaAlunosDialog — busca, paginação e exportação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContexto.mockReturnValue({ data: { podeExportar: true } });
    mockLista.mockReturnValue(
      resultadoGestor(listaEngajamento('esporadico', [linhaLista()], { total: 45 })),
    );
  });
  afterEach(() => vi.useRealTimers());

  const abrirSemUserEvent = () => {
    montar();
    fireEvent.click(within(cartao('esporadico')).getByRole('button', { name: /Ver todos os 193 alunos/ }));
    return screen.getByRole('dialog');
  };

  it('a busca só vira parâmetro depois de 300 ms e volta à página 1', () => {
    vi.useFakeTimers();
    const dialog = abrirSemUserEvent();
    // vai para a página 2 primeiro
    fireEvent.click(within(dialog).getByRole('button', { name: 'Próxima' }));
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'esporadico', '', 2, 20);

    fireEvent.change(within(dialog).getByPlaceholderText('Buscar aluno pelo nome'), { target: { value: 'ana' } });
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'esporadico', '', 2, 20);

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'esporadico', '', 2, 20);

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'esporadico', 'ana', 1, 20);
  });

  it('"Mostrando a–b de total" e "Anterior"/"Próxima" trocam a página', () => {
    const dialog = abrirSemUserEvent();
    expect(within(dialog).getByText('Mostrando 1–20 de 45')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Anterior' })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Próxima' }));
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'esporadico', '', 2, 20);
    expect(within(dialog).getByText('Mostrando 21–40 de 45')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Próxima' }));
    expect(within(dialog).getByText('Mostrando 41–45 de 45')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Próxima' })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Anterior' }));
    expect(within(dialog).getByText('Mostrando 21–40 de 45')).toBeInTheDocument();
  });

  it('"Exportar CSV" baixa a lista completa (5.000) com o cabeçalho da §10.7', async () => {
    mockBuscarListaCompleta.mockResolvedValue(
      listaEngajamento('esporadico', [linhaLista(), linhaLista({ id: 'u-2', nome: 'Bruno Alves', semestre: 7, diasSemAtividade: 0, diasAtivos30: 12 })], { pageSize: 5000 }),
    );
    const dialog = abrirSemUserEvent();
    fireEvent.click(within(dialog).getByRole('button', { name: /Exportar CSV/ }));
    await act(async () => {});

    expect(mockBuscarListaCompleta).toHaveBeenCalledWith(FILTROS, 'esporadico', '');
    expect(mockBaixarCsv).toHaveBeenCalledTimes(1);
    const [nome, colunas, linhas] = mockBaixarCsv.mock.calls[0];
    expect(nome).toMatch(/^gestor-engajamento-esporadico-paracatu-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(colunas.map((c: { cabecalho: string }) => c.cabecalho)).toEqual(['Aluno', 'Semestre', 'Última atividade', 'Dias sem consumo']);
    expect(linhas).toHaveLength(2);
    expect(colunas[2].valor(linhas[1])).toBe('última: hoje · 12 dias ativos em 30');
  });

  it('sem podeExportar o botão não aparece', () => {
    mockContexto.mockReturnValue({ data: { podeExportar: false } });
    const dialog = abrirSemUserEvent();
    expect(within(dialog).queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument();
  });
});

describe('textoDetalheLinha — faixas de recência (§12.2)', () => {
  it('usa textoDetalhe(detalhe); sem detalhe, "nenhuma atividade registrada"', () => {
    expect(textoDetalheLinha(linhaLista({ detalhe: { dia: '2026-08-02', tipo: 'questoes', especialidade: 'Cardiologia' } }), 'sumidos60', 'ultima')).toBe(
      '02/08 · Questões de Cardiologia',
    );
    expect(textoDetalheLinha(linhaLista({ detalhe: null, diasSemAtividade: null }), 'nunca_acessou', 'ultima')).toBe(
      'nenhuma atividade registrada',
    );
  });
});
