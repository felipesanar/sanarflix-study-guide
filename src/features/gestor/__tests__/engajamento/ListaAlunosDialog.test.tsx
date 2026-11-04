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

import {
  ListaAlunosDialog,
  rotuloRecorteLista,
  textoDetalheLinha,
  type ColunaDetalhe,
} from '@/features/gestor/components/engajamento/ListaAlunosDialog';
import type { CategoriaLista } from '@/features/gestor/api/types-engajamento';
import { listaEngajamento, linhaLista } from '../fixtures/engajamento/lista';
import { resultadoGestor } from '../fixtures/engajamento/visaoGeral';

/**
 * Pop-up de lista de alunos (spec 2026-10-22-engajamento §8.3, §12.2), aberto por
 * "Ver lista completa" de Quem não voltou e pelas faixas de Do acesso ao hábito.
 * Aqui o pop-up é renderizado direto, com um disparador mínimo para o foco.
 */

const FILTROS = {
  iesId: 'ies-1',
  inicio: '2026-05-01',
  fim: '2026-10-22',
  semestre: null,
  alunoId: null,
  tipo: 'todos' as const,
};

interface Opcoes {
  categoria?: CategoriaLista;
  titulo?: string;
  regra?: string;
  colunaDetalhe?: ColunaDetalhe;
  filtros?: typeof FILTROS & { semestre: number | null };
  onFechar?: () => void;
}

function Host({ categoria = 'sumidos60', titulo = 'Sumidos há 60+ dias', regra, colunaDetalhe = 'ultima', filtros = FILTROS, onFechar }: Opcoes) {
  const [aberto, setAberto] = React.useState(false);
  return (
    <>
      <button onClick={() => setAberto(true)}>abrir lista</button>
      {aberto ? (
        <ListaAlunosDialog
          categoria={categoria}
          titulo={titulo}
          regra={regra}
          colunaDetalhe={colunaDetalhe}
          filtros={filtros}
          iesNome="PARACATU"
          periodoRotulo="últimos 6 meses"
          onFechar={() => {
            onFechar?.();
            setAberto(false);
          }}
        />
      ) : null}
    </>
  );
}

const montar = (opcoes: Opcoes = {}) =>
  render(
    <TooltipProvider>
      <MemoryRouter>
        <Host {...opcoes} />
      </MemoryRouter>
    </TooltipProvider>,
  );

const abrir = async (opcoes: Opcoes = {}) => {
  const user = userEvent.setup();
  montar(opcoes);
  const disparador = screen.getByRole('button', { name: 'abrir lista' });
  await user.click(disparador);
  return { user, disparador, dialog: screen.getByRole('dialog') };
};

describe('ListaAlunosDialog — conteúdo e consulta (§12.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContexto.mockReturnValue({ data: { podeExportar: true } });
    mockLista.mockReturnValue(resultadoGestor(listaEngajamento('sumidos60', [linhaLista()], { total: 4 })));
  });

  it('abre com título, subtítulo (total · IES · período), colunas e busca', async () => {
    const { dialog } = await abrir();
    expect(within(dialog).getByRole('heading', { name: 'Sumidos há 60+ dias' })).toBeInTheDocument();
    expect(within(dialog).getByText('4 alunos · PARACATU · últimos 6 meses')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Aluno',
      'Sem.',
      'Última atividade',
      'Dias sem consumo',
    ]);
    expect(within(dialog).getByPlaceholderText('Buscar aluno pelo nome')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Buscar aluno nesta lista')).toBeInTheDocument();
  });

  it('a descrição da faixa entra no subtítulo, entre o total e o recorte', async () => {
    const { dialog } = await abrir({ regra: 'De 4 a 7 dias ativos no mês' });
    expect(within(dialog).getByText('4 alunos · De 4 a 7 dias ativos no mês · PARACATU · últimos 6 meses')).toBeInTheDocument();
  });

  it('consulta a lista da categoria, página 1 de 20, com o recorte da página', async () => {
    await abrir();
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'sumidos60', '', 1, 20);
  });

  it('faixas de recência: "02/08 · Questões de Cardiologia" e "Dias sem consumo"', async () => {
    mockLista.mockReturnValue(
      resultadoGestor(
        listaEngajamento('sumidos60', [
          linhaLista({ detalhe: { dia: '2026-08-02', tipo: 'questoes', especialidade: 'Cardiologia' }, diasSemAtividade: 81 }),
        ]),
      ),
    );
    const { dialog } = await abrir();
    const linha = within(dialog).getByRole('row', { name: /Ana Clara Ribeiro/ });
    expect(within(linha).getByText('8º')).toBeInTheDocument();
    expect(within(linha).getByText('02/08 · Questões de Cardiologia')).toBeInTheDocument();
    expect(within(linha).getAllByRole('cell').at(-1)).toHaveTextContent('81');
  });

  it('nunca acessou: "Dias sem consumo" vazio e "nenhuma atividade registrada"', async () => {
    mockLista.mockReturnValue(
      resultadoGestor(
        listaEngajamento('nunca_acessou', [
          linhaLista({ id: 'b', nome: 'João Pedro Silva', diasSemAtividade: null, ultimaAtividade: null, detalhe: null }),
        ]),
      ),
    );
    const { dialog } = await abrir({ categoria: 'nunca_acessou', titulo: 'Nunca acessaram' });
    const linha = within(dialog).getByRole('row', { name: /João Pedro Silva/ });
    expect(within(linha).getByText('nenhuma atividade registrada')).toBeInTheDocument();
    expect(within(linha).getAllByRole('cell').at(-1)).toHaveTextContent('—');
  });

  it('faixas do hábito: coluna "Dias ativos no mês"', async () => {
    mockLista.mockReturnValue(resultadoGestor(listaEngajamento('habito_alto', [linhaLista({ diasAtivosMes: 11 })])));
    const { dialog } = await abrir({ categoria: 'habito_alto', titulo: 'Alunos: alto engajamento', colunaDetalhe: 'diasAtivosMes' });
    expect(within(dialog).getByRole('columnheader', { name: 'Dias ativos no mês' })).toBeInTheDocument();
    expect(within(within(dialog).getByRole('row', { name: /Ana Clara Ribeiro/ })).getByText('11')).toBeInTheDocument();
  });

  it('subtítulo do recorte com semestre filtrado: "filtro: 8º semestre"', async () => {
    const { dialog } = await abrir({ filtros: { ...FILTROS, semestre: 8 } });
    expect(within(dialog).getByText(/· filtro: 8º semestre$/)).toBeInTheDocument();
  });

  it('rotuloRecorteLista: aluno vence semestre, que vence IES · período', () => {
    const base = { iesNome: 'PARACATU', periodoRotulo: 'últimos 6 meses' };
    expect(rotuloRecorteLista({ ...base, alunoNome: 'Ana Clara Ribeiro', semestre: null })).toBe('filtro: Ana Clara Ribeiro');
    expect(rotuloRecorteLista({ ...base, alunoNome: null, semestre: 8 })).toBe('filtro: 8º semestre');
    expect(rotuloRecorteLista({ ...base, alunoNome: null, semestre: null })).toBe('PARACATU · últimos 6 meses');
  });

  it('fechar: botão "Fechar lista" fecha e devolve o foco ao disparador', async () => {
    const onFechar = vi.fn();
    const { user, disparador } = await abrir({ onFechar });
    await user.click(screen.getByRole('button', { name: 'Fechar lista' }));
    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(disparador).toHaveFocus();
  });

  it('Esc também fecha', async () => {
    const { user } = await abrir();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lista vazia da faixa: mensagem própria', async () => {
    mockLista.mockReturnValue(resultadoGestor(listaEngajamento('sumidos60', [])));
    const { dialog } = await abrir();
    expect(within(dialog).getByText('Nenhum aluno nesta faixa neste recorte.')).toBeInTheDocument();
    expect(within(dialog).queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it('carregando: linhas de esqueleto, sem afirmar total', async () => {
    mockLista.mockReturnValue(resultadoGestor(undefined, { isLoading: true }));
    const { dialog } = await abrir();
    expect(within(dialog).getByText('0 alunos', { exact: false })).toBeInTheDocument();
    expect(within(dialog).queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it('erro: "Tentar novamente" refaz a consulta', async () => {
    const refetch = vi.fn();
    mockLista.mockReturnValue(resultadoGestor(undefined, { isError: true, refetch }));
    const { dialog } = await abrir();
    fireEvent.click(within(dialog).getByRole('button', { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('ListaAlunosDialog — busca, paginação e exportação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContexto.mockReturnValue({ data: { podeExportar: true } });
    mockLista.mockReturnValue(resultadoGestor(listaEngajamento('sumidos60', [linhaLista()], { total: 45 })));
  });
  afterEach(() => vi.useRealTimers());

  const abrirSemUserEvent = () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'abrir lista' }));
    return screen.getByRole('dialog');
  };

  it('a busca só vira parâmetro depois de 300 ms e volta à página 1', () => {
    vi.useFakeTimers();
    const dialog = abrirSemUserEvent();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Próxima' }));
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'sumidos60', '', 2, 20);

    fireEvent.change(within(dialog).getByPlaceholderText('Buscar aluno pelo nome'), { target: { value: 'ana' } });
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'sumidos60', '', 2, 20);

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'sumidos60', '', 2, 20);

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'sumidos60', 'ana', 1, 20);
  });

  it('"Mostrando a–b de total" e "Anterior"/"Próxima" trocam a página', () => {
    const dialog = abrirSemUserEvent();
    expect(within(dialog).getByText('Mostrando 1–20 de 45')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Anterior' })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Próxima' }));
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'sumidos60', '', 2, 20);
    expect(within(dialog).getByText('Mostrando 21–40 de 45')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Próxima' }));
    expect(within(dialog).getByText('Mostrando 41–45 de 45')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Próxima' })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Anterior' }));
    expect(within(dialog).getByText('Mostrando 21–40 de 45')).toBeInTheDocument();
  });

  it('"Exportar CSV" baixa a lista completa (5.000) com o cabeçalho da §10.7 e o e-mail de cada aluno', async () => {
    mockBuscarListaCompleta.mockResolvedValue(
      listaEngajamento(
        'sumidos60',
        [
          linhaLista({ email: 'ana@exemplo.com' }),
          linhaLista({ id: 'u-2', nome: 'Bruno Alves', email: 'bruno@exemplo.com', semestre: 7, diasSemAtividade: 70, detalhe: { dia: '2026-08-13', tipo: 'video', especialidade: 'Pediatria' } }),
        ],
        { pageSize: 5000 },
      ),
    );
    const dialog = abrirSemUserEvent();
    fireEvent.click(within(dialog).getByRole('button', { name: /Exportar CSV/ }));
    await act(async () => {});

    expect(mockBuscarListaCompleta).toHaveBeenCalledWith(FILTROS, 'sumidos60', '');
    expect(mockBaixarCsv).toHaveBeenCalledTimes(1);
    const [nome, colunas, linhas] = mockBaixarCsv.mock.calls[0];
    expect(nome).toMatch(/^gestor-engajamento-sumidos60-paracatu-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(colunas.map((c: { cabecalho: string }) => c.cabecalho)).toEqual([
      'Aluno',
      'E-mail cadastrado',
      'Semestre',
      'Última atividade',
      'Dias sem consumo',
    ]);
    expect(linhas).toHaveLength(2);
    expect(colunas[1].valor(linhas[0])).toBe('ana@exemplo.com');
    expect(colunas[1].valor(linhas[1])).toBe('bruno@exemplo.com');
    expect(colunas[3].valor(linhas[1])).toBe('13/08 · Vídeo de Pediatria');
  });

  it('a lista paginada da tela não pede nem mostra o e-mail (só o "Exportar CSV" pede)', () => {
    const dialog = abrirSemUserEvent();
    expect(within(dialog).queryByRole('columnheader', { name: /e-?mail/i })).not.toBeInTheDocument();
  });

  it('sem podeExportar o botão não aparece', () => {
    mockContexto.mockReturnValue({ data: { podeExportar: false } });
    const dialog = abrirSemUserEvent();
    expect(within(dialog).queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument();
  });
});

describe('textoDetalheLinha (§12.2)', () => {
  it('"ultima": usa textoDetalhe(detalhe); sem detalhe, "nenhuma atividade registrada"', () => {
    expect(textoDetalheLinha(linhaLista({ detalhe: { dia: '2026-08-02', tipo: 'questoes', especialidade: 'Cardiologia' } }), 'ultima')).toBe(
      '02/08 · Questões de Cardiologia',
    );
    expect(textoDetalheLinha(linhaLista({ detalhe: null, diasSemAtividade: null }), 'ultima')).toBe('nenhuma atividade registrada');
  });

  it('"diasAtivosMes": os dias ativos no mês de referência', () => {
    expect(textoDetalheLinha(linhaLista({ diasAtivosMes: 11 }), 'diasAtivosMes')).toBe('11');
  });
});
