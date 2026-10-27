import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockAlunos = vi.fn();
const mockBuscarExport = vi.fn();
vi.mock('@/features/gestor/api/engajamento', () => ({
  PAGE_SIZE_ALUNOS: 20,
  useEngajamentoAlunos: (...args: unknown[]) => mockAlunos(...args),
  buscarExportAlunos: (...args: unknown[]) => mockBuscarExport(...args),
}));

const mockContexto = vi.fn();
vi.mock('@/features/gestor/api/queries', () => ({ useGestorContexto: () => mockContexto() }));

const mockBaixarCsv = vi.fn();
vi.mock('@/features/gestor/lib/exportarCsv', async () => ({
  ...(await vi.importActual<typeof import('@/features/gestor/lib/exportarCsv')>('@/features/gestor/lib/exportarCsv')),
  baixarCsv: (...args: unknown[]) => mockBaixarCsv(...args),
}));

import { ConsumoAlunos } from '@/features/gestor/components/engajamento/ConsumoAlunos';
import type { FiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import type { VisaoGeralEngajamento } from '@/features/gestor/api/types-engajamento';
import { alunosEngajamento, linhaAluno, TRES_ALUNOS } from '../fixtures/engajamento/alunos';
import { resultadoGestor, visaoGeralComAluno, visaoGeralParacatu, visaoGeralSemestre8 } from '../fixtures/engajamento/visaoGeral';

/** "Consumo dos alunos" e tabela "Por aluno" (spec 2026-10-22-engajamento §8.2, §12.2). */

const setAluno = vi.fn();

const filtros = (extra: Partial<FiltrosEngajamento> = {}): FiltrosEngajamento => ({
  iesId: 'ies-1',
  periodo: '6m',
  de: null,
  ate: null,
  inicio: '2026-05-01',
  fim: '2026-10-22',
  semestre: null,
  alunoId: null,
  tipo: 'todos',
  setPeriodo: vi.fn(),
  setSemestre: vi.fn(),
  setAluno,
  setTipo: vi.fn(),
  limparFiltroPagina: vi.fn(),
  ...extra,
});

/** Filtro de 14 dias controlado, como faz a rota. */
function Hospedeiro({
  dados,
  f,
  onAbrir,
  sem14Inicial = false,
  onSem14,
}: {
  dados: VisaoGeralEngajamento;
  f: FiltrosEngajamento;
  onAbrir?: (id: string) => void;
  sem14Inicial?: boolean;
  onSem14?: (v: boolean) => void;
}) {
  const [sem14, setSem14] = React.useState(sem14Inicial);
  return (
    <ConsumoAlunos
      dados={dados}
      consulta={resultadoGestor(dados)}
      filtros={f}
      sem14={sem14}
      onSem14Change={(v) => {
        onSem14?.(v);
        setSem14(v);
      }}
      onAbrirDetalhes={onAbrir ?? vi.fn()}
    />
  );
}

const montar = (dados = visaoGeralParacatu(), f = filtros(), extra: Partial<React.ComponentProps<typeof Hospedeiro>> = {}) =>
  render(
    <TooltipProvider>
      <MemoryRouter>
        <Hospedeiro dados={dados} f={f} {...extra} />
      </MemoryRouter>
    </TooltipProvider>,
  );

const cartoes = () =>
  screen.getAllByTestId('consumo-kpi').map((c) => ({
    titulo: c.firstElementChild?.textContent,
    valor: within(c).getByTestId('consumo-kpi-valor').textContent,
    nota: c.lastElementChild === c.firstElementChild || c.lastElementChild?.getAttribute('data-testid') === 'consumo-kpi-valor' ? undefined : c.lastElementChild?.textContent,
  }));

const abrirAba = (nome: string) => fireEvent.click(screen.getByRole('tab', { name: nome }));

describe('ConsumoAlunos — cabeçalho e abas (§12.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContexto.mockReturnValue({ data: { podeExportar: true } });
    mockAlunos.mockReturnValue(resultadoGestor(alunosEngajamento(TRES_ALUNOS)));
  });

  it('sobretítulo, H2, descrição e tablist "Tipo de consumo" com as 3 abas', () => {
    montar();
    expect(screen.getByText('Acompanhamento')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Consumo dos alunos' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'O que os alunos estão resolvendo, assistindo e lendo no SanarFlix · clique no nome para filtrar a página, na seta para ver o detalhe',
      ),
    ).toBeInTheDocument();
    const lista = screen.getByRole('tablist', { name: 'Tipo de consumo' });
    expect(within(lista).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Questões', 'Vídeos', 'Documentos']);
    expect(screen.getByRole('tab', { name: 'Questões' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Vídeos' })).toHaveAttribute('aria-selected', 'false');
  });

  it('a seta → / ← troca de aba e move o foco', () => {
    montar();
    const q = screen.getByRole('tab', { name: 'Questões' });
    q.focus();
    fireEvent.keyDown(q, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Vídeos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Vídeos' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Vídeos' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Questões' })).toHaveAttribute('aria-selected', 'true');
  });

  it('o painel é rotulado pela aba selecionada', () => {
    montar();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Questões');
    abrirAba('Vídeos');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Vídeos');
  });
});

describe('ConsumoAlunos — KPIs sem aluno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContexto.mockReturnValue({ data: { podeExportar: true } });
    mockAlunos.mockReturnValue(resultadoGestor(alunosEngajamento(TRES_ALUNOS)));
  });

  it('Questões: total, % de acerto e "alunos que resolveram", sem comparativo (anterior 0)', () => {
    montar();
    expect(cartoes()).toEqual([
      { titulo: 'Questões resolvidas', valor: '145.873', nota: 'sem comparativo para este período' },
      { titulo: '% de acerto', valor: '66%', nota: 'sem comparativo para este período' },
      { titulo: 'Alunos que resolveram', valor: '296 de 521', nota: '225 sem nenhuma questão no período' },
    ]);
  });

  it('Questões comparáveis: "+X% sobre os 6 meses anteriores" e "▲ X p.p. sobre os 6 meses anteriores"', () => {
    const d = visaoGeralParacatu();
    d.consumo.questoes = { ...d.consumo.questoes, totalAnterior: 100000, acertoPctAnterior: 60.0 };
    montar(d);
    const c = cartoes();
    expect(c[0].nota).toBe('+46% sobre os 6 meses anteriores');
    expect(c[1].nota).toBe('▲ 6 p.p. sobre os 6 meses anteriores');
  });

  it('Questões: queda mostra "−X%" com sinal de menos real', () => {
    const d = visaoGeralParacatu();
    d.consumo.questoes = { ...d.consumo.questoes, totalAnterior: 200000 };
    montar(d);
    expect(cartoes()[0].nota).toBe('−27% sobre os 6 meses anteriores');
  });

  it('com semestre: "IES inteira: …" e "média da IES: …%"', () => {
    const d = visaoGeralSemestre8();
    d.consumo.questoes = { ...d.consumo.questoes, totalIes: 145873, acertoPctIes: 66.4 };
    montar(d);
    const c = cartoes();
    expect(c[0].nota).toBe('IES inteira: 145.873');
    expect(c[1].nota).toBe('média da IES: 66%');
  });

  it('Vídeos: média por aluno que assistiu (1 casa) e alunos que assistiram', () => {
    montar();
    abrirAba('Vídeos');
    expect(cartoes()).toEqual([
      { titulo: 'Vídeos assistidos', valor: '8.810', nota: 'sem comparativo para este período' },
      { titulo: 'Média por aluno que assistiu', valor: '42,2', nota: 'vídeos no período' },
      { titulo: 'Alunos que assistiram', valor: '209 de 521', nota: '312 sem nenhum vídeo no período' },
    ]);
  });

  it('Documentos: média por aluno que leu e alunos que leram', () => {
    montar();
    abrirAba('Documentos');
    expect(cartoes()).toEqual([
      { titulo: 'Documentos lidos', valor: '5.027', nota: 'sem comparativo para este período' },
      { titulo: 'Média por aluno que leu', valor: '17,8', nota: 'documentos no período' },
      { titulo: 'Alunos que leram', valor: '282 de 521', nota: '239 sem nenhum documento no período' },
    ]);
  });

  it('conteúdos usam a comparabilidade de conteúdos (D10), não a de questões', () => {
    const d = visaoGeralParacatu();
    d.consumo.videos = { ...d.consumo.videos, totalAnterior: 5000 };
    montar(d);
    abrirAba('Vídeos');
    expect(cartoes()[0].nota).toBe('sem comparativo para este período'); // comparavelConteudos = false
  });

  it('média com 0 alunos fica "—", nunca "NaN"', () => {
    const d = visaoGeralParacatu();
    d.consumo.videos = { ...d.consumo.videos, total: 0, alunos: 0 };
    montar(d);
    abrirAba('Vídeos');
    expect(cartoes()[1].valor).toBe('—');
  });
});

describe('ConsumoAlunos — KPIs com aluno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContexto.mockReturnValue({ data: { podeExportar: true } });
    mockAlunos.mockReturnValue(resultadoGestor(alunosEngajamento(TRES_ALUNOS)));
  });

  it('Questões: total, acerto e dias com questões, com a média do semestre', () => {
    montar(visaoGeralComAluno());
    expect(cartoes()).toEqual([
      { titulo: 'Questões resolvidas', valor: '1.284', nota: 'média do semestre: 420' },
      { titulo: '% de acerto', valor: '74%', nota: 'média do semestre: 66%' },
      { titulo: 'Dias com questões', valor: '38', nota: 'de 42 dias ativos' },
    ]);
  });

  it('Vídeos: média do semestre, média por mês e especialidade mais assistida', () => {
    montar(visaoGeralComAluno());
    abrirAba('Vídeos');
    expect(cartoes()).toEqual([
      { titulo: 'Vídeos assistidos', valor: '142', nota: 'média do semestre: 9,1' },
      { titulo: 'Média por mês', valor: '23,7', nota: 'vídeos' },
      { titulo: 'Especialidade mais assistida', valor: 'Cardiologia', nota: '21 vídeos' },
    ]);
  });

  it('Documentos: especialidade mais lida; sem nenhuma, "—" e sem nota', () => {
    const d = visaoGeralComAluno();
    montar(d);
    abrirAba('Documentos');
    expect(cartoes()[2]).toEqual({ titulo: 'Especialidade mais lida', valor: 'Pediatria', nota: '12 documentos' });
  });

  it('sem especialidade destacada: valor "—"', () => {
    const d = visaoGeralComAluno();
    d.aluno = { ...d.aluno!, especialidadeMaisAssistida: null };
    montar(d);
    abrirAba('Vídeos');
    expect(cartoes()[2].valor).toBe('—');
  });
});

describe('ConsumoAlunos — gráfico mensal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContexto.mockReturnValue({ data: { podeExportar: true } });
    mockAlunos.mockReturnValue(resultadoGestor(alunosEngajamento(TRES_ALUNOS)));
  });

  it('título com o mês parcial, e o gráfico troca com a aba', () => {
    montar();
    expect(screen.getByRole('heading', { level: 3, name: 'Questões resolvidas por mês · Out parcial até 22/10' })).toBeInTheDocument();
    const g = screen.getByRole('img', { name: 'Questões resolvidas por mês · Out parcial até 22/10' });
    expect(within(g).getByText('31.000')).toBeInTheDocument();

    abrirAba('Vídeos');
    expect(screen.getByRole('heading', { level: 3, name: 'Vídeos assistidos por mês · Out parcial até 22/10' })).toBeInTheDocument();
    expect(within(screen.getByRole('img', { name: /Vídeos assistidos por mês/ })).getByText('1.900')).toBeInTheDocument();

    abrirAba('Documentos');
    expect(screen.getByRole('heading', { level: 3, name: 'Documentos lidos por mês · Out parcial até 22/10' })).toBeInTheDocument();
  });

  it('com aluno, o título leva " · {nome}"', () => {
    montar(visaoGeralComAluno());
    expect(
      screen.getByRole('heading', { level: 3, name: 'Questões resolvidas por mês · Ana Clara Ribeiro · Out parcial até 22/10' }),
    ).toBeInTheDocument();
  });

  it('sem mês parcial no fim, o título não cita parcial', () => {
    const d = visaoGeralParacatu();
    d.meses = d.meses.map((m) => ({ ...m, parcial: false }));
    montar(d);
    expect(screen.getByRole('heading', { level: 3, name: 'Questões resolvidas por mês' })).toBeInTheDocument();
  });
});

describe('TabelaPorAluno (§8.2, §12.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContexto.mockReturnValue({ data: { podeExportar: true } });
    mockAlunos.mockReturnValue(resultadoGestor(alunosEngajamento(TRES_ALUNOS)));
  });
  afterEach(() => vi.useRealTimers());

  it('título "Por aluno", colunas e "Detalhes" só para leitor de tela', () => {
    montar();
    expect(screen.getByRole('heading', { level: 3, name: 'Por aluno' })).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: 'Consumo por aluno' });
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Aluno',
      'Semestre',
      'Questões resolvidas',
      '% de acerto',
      'Vídeos assistidos',
      'Documentos lidos',
      'Última atividade',
      'Detalhes',
    ]);
    expect(within(tabela).getByRole('columnheader', { name: 'Detalhes' })).toHaveClass('sr-only');
  });

  it('consulta ordenada por questões (maior primeiro), página 1, sem busca e sem o filtro de 14 dias', () => {
    montar();
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.objectContaining({ iesId: 'ies-1' }), 'questoes', 'desc', '', false, 1);
  });

  it('trocar de aba NÃO reordena a tabela: a consulta continua a mesma', () => {
    montar();
    mockAlunos.mockClear();
    abrirAba('Vídeos');
    abrirAba('Documentos');
    for (const chamada of mockAlunos.mock.calls) {
      expect(chamada.slice(1)).toEqual(['questoes', 'desc', '', false, 1]);
    }
  });

  it('trocar de aba só muda o realce: cabeçalho e células da(s) coluna(s) da aba levam o sombreamento', () => {
    montar();
    const tabela = screen.getByRole('table', { name: 'Consumo por aluno' });
    const realcado = (el: HTMLElement) => el.style.background.includes('--gp-brand-surface-soft');
    const cab = () => within(tabela).getAllByRole('columnheader');
    // Questões: Questões resolvidas (2) e % de acerto (3)
    expect(cab().map(realcado)).toEqual([false, false, true, true, false, false, false, false]);
    abrirAba('Vídeos');
    expect(cab().map(realcado)).toEqual([false, false, false, false, true, false, false, false]);
    const ana = within(screen.getByRole('row', { name: /Ana Clara/ })).getAllByRole('cell');
    expect(ana.map(realcado)).toEqual([false, false, false, false, true, false, false, false]);
    abrirAba('Documentos');
    expect(cab().map(realcado)).toEqual([false, false, false, false, false, true, false, false]);
  });

  it('clicar no cabeçalho ordena: 1º clique na direção padrão, 2º inverte, e volta para a página 1', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Página 3' }));
    const cabecalho = (nome: RegExp) => screen.getByRole('columnheader', { name: nome });
    fireEvent.click(within(cabecalho(/Vídeos assistidos/)).getByRole('button'));
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'videos', 'desc', '', false, 1);
    expect(cabecalho(/Vídeos assistidos/)).toHaveAttribute('aria-sort', 'descending');
    expect(cabecalho(/Questões resolvidas/)).toHaveAttribute('aria-sort', 'none');
    fireEvent.click(within(cabecalho(/Vídeos assistidos/)).getByRole('button'));
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'videos', 'asc', '', false, 1);
    expect(cabecalho(/Vídeos assistidos/)).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(within(cabecalho(/^Aluno/)).getByRole('button'));
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'nome', 'asc', '', false, 1);
    fireEvent.click(within(cabecalho(/Última atividade/)).getByRole('button'));
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'ultima_atividade', 'desc', '', false, 1);
  });

  it('a ordenação escolhida sobrevive à troca de aba e vai junto na exportação', async () => {
    mockBuscarExport.mockResolvedValue([]);
    montar();
    fireEvent.click(within(screen.getByRole('columnheader', { name: /% de acerto/ })).getByRole('button'));
    abrirAba('Documentos');
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'acerto', 'desc', '', false, 1);
    fireEvent.click(screen.getByRole('button', { name: /Exportar base de alunos \(CSV\)/ }));
    await act(async () => {});
    expect(mockBuscarExport).toHaveBeenCalledWith(expect.anything(), 'acerto', 'desc', '', false);
  });

  it('células: semestre, números, acerto "—" e recência', () => {
    montar();
    const linha = (nome: RegExp) => screen.getByRole('row', { name: nome });
    const ana = within(linha(/Ana Clara/)).getAllByRole('cell');
    expect(ana.map((c) => c.textContent)).toEqual(['Ana Clara Ribeiro', '12º', '1.284', '74%', '142', '61', 'hoje', '']);
    const camila = within(linha(/Camila/)).getAllByRole('cell');
    expect(camila.map((c) => c.textContent)).toEqual(['Camila Souza', '3º', '0', '—', '0', '0', 'nunca', '']);
  });

  it('alertas: acerto crítico e recência ≥ 14 dias (ou nunca) em --gp-danger-on', () => {
    montar();
    const bruno = within(screen.getByRole('row', { name: /Bruno/ })).getAllByRole('cell');
    expect(bruno[3].style.color).toContain('--gp-danger-on'); // 41%
    expect(bruno[6].style.color).toContain('--gp-danger-on'); // há 21 dias
    const ana = within(screen.getByRole('row', { name: /Ana Clara/ })).getAllByRole('cell');
    expect(ana[3].style.color).not.toContain('--gp-danger-on');
    expect(ana[6].style.color).not.toContain('--gp-danger-on');
    const camila = within(screen.getByRole('row', { name: /Camila/ })).getAllByRole('cell');
    expect(camila[6].style.color).toContain('--gp-danger-on'); // nunca
    expect(camila[3].style.color).not.toContain('--gp-danger-on'); // acerto "—" não é crítico
  });

  it('as colunas da aba ativa ficam realçadas', () => {
    montar();
    const ana = () => within(screen.getByRole('row', { name: /Ana Clara/ })).getAllByRole('cell');
    const realcada = (c: HTMLElement) => c.style.background.includes('--gp-brand-surface-soft');
    expect(ana().map(realcada)).toEqual([false, false, true, true, false, false, false, false]);
    abrirAba('Vídeos');
    expect(ana().map(realcada)).toEqual([false, false, false, false, true, false, false, false]);
    abrirAba('Documentos');
    expect(ana().map(realcada)).toEqual([false, false, false, false, false, true, false, false]);
  });

  it('clicar no nome filtra a página; clicar de novo no selecionado limpa', () => {
    const { unmount } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Bruno Alves' }));
    expect(setAluno).toHaveBeenLastCalledWith('aluno-2');
    unmount();

    montar(visaoGeralComAluno(), filtros({ alunoId: 'aluno-2' }));
    const botao = screen.getByRole('button', { name: 'Bruno Alves' });
    expect(botao).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(botao);
    expect(setAluno).toHaveBeenLastCalledWith(null);
  });

  it('linha do aluno filtrado: fundo --gp-brand-surface e os outros nomes não pressionados', () => {
    montar(visaoGeralComAluno(), filtros({ alunoId: 'aluno-2' }));
    expect(screen.getByRole('row', { name: /Bruno/ }).style.background).toContain('--gp-brand-surface');
    expect(screen.getByRole('button', { name: 'Ana Clara Ribeiro' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('a seta "Abrir detalhes de {nome}" chama onAbrirDetalhes com o id', () => {
    const onAbrir = vi.fn();
    montar(visaoGeralParacatu(), filtros(), { onAbrir });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalhes de Camila Souza' }));
    expect(onAbrir).toHaveBeenCalledWith('aluno-3');
  });

  it('rodapé "Mostrando a–b de total alunos" e paginação', () => {
    montar();
    expect(screen.getByText('Mostrando 1–20 de 521 alunos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'questoes', 'desc', '', false, 2);
    expect(screen.getByText('Mostrando 21–40 de 521 alunos')).toBeInTheDocument();
  });

  it('trocar a ordenação volta a tabela para a página 1; trocar de aba não mexe na página', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Página 3' }));
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'questoes', 'desc', '', false, 3);
    abrirAba('Vídeos');
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'questoes', 'desc', '', false, 3);
    fireEvent.click(within(screen.getByRole('columnheader', { name: /Semestre/ })).getByRole('button'));
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'semestre', 'asc', '', false, 1);
  });

  it('a busca só vira parâmetro após 300 ms e volta para a página 1', () => {
    vi.useFakeTimers();
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    fireEvent.change(screen.getByPlaceholderText('Buscar aluno pelo nome'), { target: { value: 'conceicao' } });
    expect(screen.getByLabelText('Buscar aluno nesta lista')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'questoes', 'desc', '', false, 2);
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'questoes', 'desc', 'conceicao', false, 1);
  });

  it('grupo "Filtrar alunos": "Todos" e "Sem atividade há 14 dias" com aria-pressed; ligar volta para a página 1', () => {
    const onSem14 = vi.fn();
    montar(visaoGeralParacatu(), filtros(), { onSem14 });
    const grupo = screen.getByRole('group', { name: 'Filtrar alunos' });
    expect(within(grupo).getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    fireEvent.click(within(grupo).getByRole('button', { name: 'Sem atividade há 14 dias' }));
    expect(onSem14).toHaveBeenCalledWith(true);
    expect(within(grupo).getByRole('button', { name: 'Sem atividade há 14 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'questoes', 'desc', '', true, 1);
  });

  it('o filtro de 14 dias iniciado pelo pai (Quem não voltou) já chega ligado', () => {
    montar(visaoGeralParacatu(), filtros(), { sem14Inicial: true });
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'questoes', 'desc', '', true, 1);
    expect(screen.getByRole('button', { name: 'Sem atividade há 14 dias' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sem linhas: "Nenhum aluno encontrado neste recorte." e sem rodapé', () => {
    mockAlunos.mockReturnValue(resultadoGestor(alunosEngajamento([], { total: 0 })));
    montar();
    expect(screen.getByText('Nenhum aluno encontrado neste recorte.')).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it('carregando: esqueleto no corpo, cabeçalho continua montado', () => {
    mockAlunos.mockReturnValue(resultadoGestor(undefined, { isLoading: true }));
    montar();
    expect(screen.getByRole('columnheader', { name: 'Aluno' })).toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it('erro: "Tentar novamente" refaz a consulta da tabela', () => {
    const refetch = vi.fn();
    mockAlunos.mockReturnValue(resultadoGestor(undefined, { isError: true, refetch }));
    montar();
    const tabela = screen.getByTestId('tabela-por-aluno');
    fireEvent.click(within(tabela).getByRole('button', { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('trocando filtro (placeholder): o dado anterior fica com aria-busy', () => {
    mockAlunos.mockReturnValue(resultadoGestor(alunosEngajamento(TRES_ALUNOS), { isPlaceholderData: true }));
    montar();
    expect(screen.getByRole('table', { name: 'Consumo por aluno' }).closest('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Ana Clara Ribeiro')).toBeInTheDocument();
  });
});

describe('TabelaPorAluno — Exportar base de alunos (CSV) (§10.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContexto.mockReturnValue({ data: { podeExportar: true } });
    mockAlunos.mockReturnValue(resultadoGestor(alunosEngajamento(TRES_ALUNOS)));
  });

  const exportar = async () => {
    fireEvent.click(screen.getByRole('button', { name: /Exportar base de alunos \(CSV\)/ }));
    await act(async () => {});
  };

  it('com podeExportar, baixa a base com os filtros da tabela e as colunas da spec', async () => {
    mockBuscarExport.mockResolvedValue([
      { nome: 'Ana Clara Ribeiro', email: 'ana@exemplo.com', semestre: 12, questoes: 1284, acertoPct: 74.0, videos: 142, documentos: 61, ultimaAtividade: '2026-10-22', diasSemAtividade: 0 },
      { nome: 'Camila Souza', email: 'camila@exemplo.com', semestre: 3, questoes: 0, acertoPct: null, videos: 0, documentos: 0, ultimaAtividade: null, diasSemAtividade: null },
    ]);
    montar(visaoGeralParacatu(), filtros(), { sem14Inicial: true });
    abrirAba('Vídeos');
    await exportar();

    expect(mockBuscarExport).toHaveBeenCalledWith(expect.objectContaining({ iesId: 'ies-1' }), 'questoes', 'desc', '', true);
    expect(mockBaixarCsv).toHaveBeenCalledTimes(1);
    const [nome, colunas, linhas] = mockBaixarCsv.mock.calls[0];
    expect(nome).toMatch(/^gestor-engajamento-base-alunos-paracatu-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(colunas.map((c: { cabecalho: string }) => c.cabecalho)).toEqual([
      'Aluno',
      'E-mail cadastrado',
      'Semestre',
      'Questões resolvidas',
      '% de acerto',
      'Vídeos assistidos',
      'Documentos lidos',
      'Última atividade',
      'Dias sem consumo',
    ]);
    const celulas = (i: number) => colunas.map((c: { valor: (l: unknown) => unknown }) => c.valor(linhas[i]));
    expect(celulas(0)).toEqual(['Ana Clara Ribeiro', 'ana@exemplo.com', 12, 1284, '74%', 142, 61, '22/10/2026', 0]);
    // nunca acessou: última atividade e dias sem consumo vazios
    expect(celulas(1)).toEqual(['Camila Souza', 'camila@exemplo.com', 3, 0, '', 0, 0, '', null]);
  });

  it('sem podeExportar o botão some', () => {
    mockContexto.mockReturnValue({ data: { podeExportar: false } });
    montar();
    expect(screen.queryByRole('button', { name: /Exportar base de alunos/ })).not.toBeInTheDocument();
  });

  it('a lista de contexto ainda não carregada também não oferece o botão', () => {
    mockContexto.mockReturnValue({ data: undefined });
    montar();
    expect(screen.queryByRole('button', { name: /Exportar base de alunos/ })).not.toBeInTheDocument();
  });
});

describe('ConsumoAlunos — estados do bloco (§11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContexto.mockReturnValue({ data: { podeExportar: true } });
    mockAlunos.mockReturnValue(resultadoGestor(alunosEngajamento(TRES_ALUNOS)));
  });

  it('âncora #consumo para o link de "Quem não voltou"', () => {
    const { container } = montar();
    expect(container.querySelector('#consumo')).not.toBeNull();
  });

  it('erro da visão geral: "Tentar novamente", sem tabela', () => {
    const refetch = vi.fn();
    render(
      <TooltipProvider>
        <MemoryRouter>
          <ConsumoAlunos
            dados={undefined}
            consulta={resultadoGestor(undefined, { isError: true, refetch })}
            filtros={filtros()}
            sem14={false}
            onSem14Change={vi.fn()}
            onAbrirDetalhes={vi.fn()}
          />
        </MemoryRouter>
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

// Evita aviso de import não usado quando `linhaAluno` só é consumida pelo fixture.
void linhaAluno;
