import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockLista = vi.fn();
const mockAlunos = vi.fn();
const mockVisaoGeral = vi.fn();
vi.mock('@/features/gestor/api/engajamento', () => ({
  PAGE_SIZE_ALUNOS: 20,
  useEngajamentoVisaoGeral: (...args: unknown[]) => mockVisaoGeral(...args),
  useEngajamentoLista: (...args: unknown[]) => mockLista(...args),
  useEngajamentoAlunos: (...args: unknown[]) => mockAlunos(...args),
  useEngajamentoAluno: () => ({ data: undefined, isLoading: true, isError: false, isPlaceholderData: false, refetch: () => undefined }),
  buscarExportAlunos: vi.fn(),
  buscarListaCompleta: vi.fn(),
}));
vi.mock('@/features/gestor/api/queries', () => ({ useGestorContexto: () => ({ data: { podeExportar: false } }) }));

import { ComparativoSemestres } from '@/features/gestor/components/engajamento/ComparativoSemestres';
import { EspecialidadesPraticadas } from '@/features/gestor/components/engajamento/EspecialidadesPraticadas';
import { QuemNaoVoltou } from '@/features/gestor/components/engajamento/QuemNaoVoltou';
import VisaoGeralEngajamento from '@/features/gestor/routes/engajamento/VisaoGeralEngajamento';
import { alunosEngajamento, TRES_ALUNOS } from '../fixtures/engajamento/alunos';
import { linhaLista, listaEngajamento } from '../fixtures/engajamento/lista';
import { resultadoGestor, visaoGeralComAluno, visaoGeralParacatu } from '../fixtures/engajamento/visaoGeral';

/** Quem não voltou, Especialidades mais praticadas e Comparativo entre semestres (spec §12.2). */

const FILTROS = { iesId: 'ies-1', inicio: '2026-05-01', fim: '2026-10-22', semestre: null, alunoId: null, tipo: 'todos' as const, periodo: '6m' };

const Sonda = () => {
  const { pathname, search } = useLocation();
  return <span data-testid="url">{pathname + search}</span>;
};

const envolver = (ui: React.ReactElement, url = '/gestor/engajamento?ies=ies-1') =>
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[url]}>
        {ui}
        <Sonda />
      </MemoryRouter>
    </TooltipProvider>,
  );

const SEG = (id: string) => screen.getByTestId(`segmento-${id}`);

describe('QuemNaoVoltou (§12.2)', () => {
  const onFiltrarTabela = vi.fn();
  const montar = (d = visaoGeralParacatu()) =>
    envolver(<QuemNaoVoltou dados={d} consulta={resultadoGestor(d)} filtros={FILTROS} onFiltrarTabela={onFiltrarTabela} />);

  beforeEach(() => {
    vi.clearAllMocks();
    mockLista.mockReturnValue(resultadoGestor(listaEngajamento('sumidos30a59', [linhaLista()], { total: 69, pageSize: 5 })));
  });

  it('título, descrição e o botão-link "Filtrar na tabela de alunos"', () => {
    montar();
    expect(screen.getByRole('heading', { level: 2, name: 'Quem não voltou' })).toBeInTheDocument();
    expect(screen.getByText('Base ativa pelo tempo desde a última atividade')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar na tabela de alunos' }));
    expect(onFiltrarTabela).toHaveBeenCalledTimes(1);
  });

  it('barra empilhada: grupo rotulado e um botão por faixa com "{nome}: {n} alunos"', () => {
    montar();
    const grupo = screen.getByRole('group', {
      name: 'Distribuição da base pelo tempo desde a última atividade · clique numa faixa para listar os alunos',
    });
    expect(within(grupo).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Ativos nos últimos 30 dias: 197 alunos',
      'Sumidos há 30–59 dias: 69 alunos',
      'Sumidos há 60+ dias: 64 alunos',
      'Nunca acessaram: 191 alunos',
    ]);
    for (const b of within(grupo).getAllByRole('button')) expect(b).toHaveAttribute('aria-pressed', 'false');
  });

  it('a largura de cada segmento é n ÷ base e as quatro fecham 100% (V8)', () => {
    const d = visaoGeralParacatu();
    montar(d);
    const larguras = ['ativos30', 'sumidos30a59', 'sumidos60', 'nunca_acessou'].map((id) => parseFloat(SEG(id).style.width));
    expect(larguras[1]).toBeCloseTo((100 * 69) / 521, 5);
    expect(larguras.reduce((s, v) => s + v, 0)).toBeCloseTo(100, 5);
  });

  it('legenda com os 4 nomes (e "Nunca acessaram" sem "no período") e as contagens', () => {
    montar();
    const itens = screen.getAllByRole('listitem').slice(0, 4).map((li) => li.textContent);
    expect(itens).toEqual([
      'Ativos nos últimos 30 dias197',
      'Sumidos há 30–59 dias69',
      'Sumidos há 60+ dias64',
      'Nunca acessaram191',
    ]);
    expect(screen.queryByText(/no período/)).not.toBeInTheDocument();
  });

  it('segmento com 0 alunos some da barra, mas continua na legenda', () => {
    const d = visaoGeralParacatu();
    d.recencia = { ...d.recencia, sumidos60: 0 };
    montar(d);
    expect(screen.queryByTestId('segmento-sumidos60')).not.toBeInTheDocument();
    expect(screen.getByText('Sumidos há 60+ dias').closest('li')).toHaveTextContent('0');
  });

  it('sem faixa: "Alunos sumidos há 30+ dias" com a prévia da visão geral, sem consultar a lista', () => {
    montar();
    expect(screen.getByRole('heading', { level: 3, name: 'Alunos sumidos há 30+ dias' })).toBeInTheDocument();
    expect(mockLista).not.toHaveBeenCalled();
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Aluno', 'Sem.', 'Última atividade', 'Dias sem consumo']);
    const linhas = screen.getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(5);
    expect(within(linhas[0]).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Marina Duarte', '8º', '02/08 · Questões de Cardiologia', '81']);
    expect(within(linhas[1]).getByText('19/08 · Vídeo de Farmacologia')).toBeInTheDocument();
    expect(within(linhas[2]).getByText('27/08 · Documento de Obstetrícia')).toBeInTheDocument();
    expect(within(linhas[3]).getByText('01/09 · Questões')).toBeInTheDocument();
    expect(within(linhas[4]).getByText('nenhuma atividade registrada')).toBeInTheDocument();
  });

  it('"Mostrando 5 de 133 alunos" e "Ver lista completa" quando há mais de 5', () => {
    montar();
    expect(screen.getByText('Mostrando 5 de 133 alunos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver lista completa' })).toBeInTheDocument();
  });

  it('com 5 ou menos, sem "Ver lista completa"', () => {
    const d = visaoGeralParacatu();
    d.recencia = { ...d.recencia, sumidos30a59: 3, sumidos60: 2 };
    montar(d);
    expect(screen.queryByRole('button', { name: 'Ver lista completa' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it('prévia vazia: "Nenhum aluno nesta faixa neste recorte."', () => {
    const d = visaoGeralParacatu();
    d.recencia = { ...d.recencia, sumidos30a59: 0, sumidos60: 0, previaSumidos30mais: [] };
    montar(d);
    expect(screen.getByText('Nenhum aluno nesta faixa neste recorte.')).toBeInTheDocument();
  });

  it('clicar na faixa consulta a lista com 5 por página, troca o título e marca aria-pressed; clicar de novo desmarca', () => {
    montar();
    fireEvent.click(SEG('sumidos30a59'));
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'sumidos30a59', '', 1, 5);
    expect(SEG('sumidos30a59')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { level: 3, name: 'Sumidos há 30–59 dias' })).toBeInTheDocument();
    expect(screen.getByText('Ana Clara Ribeiro')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1 de 69 alunos')).toBeInTheDocument();

    fireEvent.click(SEG('sumidos30a59'));
    expect(SEG('sumidos30a59')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { level: 3, name: 'Alunos sumidos há 30+ dias' })).toBeInTheDocument();
  });

  it('faixa "Nunca acessaram": detalhe "nenhuma atividade registrada" e "—" nos dias sem consumo', () => {
    mockLista.mockReturnValue(
      resultadoGestor(
        listaEngajamento('nunca_acessou', [linhaLista({ nome: 'João Pedro Silva', detalhe: null, diasSemAtividade: null, ultimaAtividade: null })], { total: 191, pageSize: 5 }),
      ),
    );
    montar();
    fireEvent.click(SEG('nunca_acessou'));
    const linha = screen.getByRole('row', { name: /João Pedro Silva/ });
    expect(within(linha).getAllByRole('cell').map((c) => c.textContent)).toEqual(['João Pedro Silva', '8º', 'nenhuma atividade registrada', '—']);
  });

  it('faixa vazia no recorte: "Nenhum aluno nesta faixa neste recorte."', () => {
    mockLista.mockReturnValue(resultadoGestor(listaEngajamento('sumidos60', [], { total: 0, pageSize: 5 })));
    montar();
    fireEvent.click(SEG('sumidos60'));
    expect(screen.getByText('Nenhum aluno nesta faixa neste recorte.')).toBeInTheDocument();
  });

  it('"Ver lista completa" abre o pop-up da faixa selecionada (ou "sumidos30mais" sem faixa)', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver lista completa' }));
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'sumidos30mais', '', 1, 20);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Alunos sumidos há 30+ dias' })).toBeInTheDocument();
    expect(within(dialog).getByText(/133 alunos · PARACATU · últimos 6 meses|0 alunos|69 alunos/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar lista' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(SEG('sumidos60'));
    fireEvent.click(screen.getByRole('button', { name: 'Ver lista completa' }));
    expect(mockLista).toHaveBeenLastCalledWith(FILTROS, 'sumidos60', '', 1, 20);
    expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Sumidos há 60+ dias' })).toBeInTheDocument();
  });

  it('erro da consulta da faixa: "Tentar novamente"', () => {
    const refetch = vi.fn();
    mockLista.mockReturnValue(resultadoGestor(undefined, { isError: true, refetch }));
    montar();
    fireEvent.click(SEG('sumidos60'));
    fireEvent.click(screen.getAllByRole('button', { name: /Tentar novamente/ }).at(-1) as HTMLElement);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('EspecialidadesPraticadas (§12.2)', () => {
  const dadosComEspecialidades = () => {
    const d = visaoGeralParacatu();
    d.especialidades = [
      { id: 'e1', nome: 'Cardiologia', ciclo: 'clinico', questoes: 9000, acertoPct: 64.1 },
      { id: 'e2', nome: 'Pediatria Geral', ciclo: 'clinico', questoes: 4500, acertoPct: 41.0 },
      { id: 'e3', nome: 'Fisiologia', ciclo: 'basico', questoes: 900, acertoPct: null },
    ];
    return d;
  };
  const montar = (d = dadosComEspecialidades(), url = '/gestor/engajamento?ies=ies-1&eng_sem=8&aluno=a1&periodo=30d') =>
    envolver(<EspecialidadesPraticadas dados={d} consulta={resultadoGestor(d)} />, url);

  it('título, descrição e uma linha por especialidade com a quantidade', () => {
    montar();
    expect(screen.getByRole('heading', { level: 2, name: 'Especialidades mais praticadas' })).toBeInTheDocument();
    expect(screen.getByText('Questões resolvidas e % de acerto')).toBeInTheDocument();
    const itens = screen.getAllByTestId('especialidade-praticada');
    expect(itens.map((i) => i.firstElementChild?.textContent)).toEqual(['Cardiologia9.000', 'Pediatria Geral4.500', 'Fisiologia900']);
  });

  it('"acerto {x}%" (e "—" sem acerto), em alerta só quando crítico', () => {
    montar();
    const acertos = screen.getAllByTestId('especialidade-acerto');
    expect(acertos.map((a) => a.textContent)).toEqual(['acerto 64%', 'acerto 41%', 'acerto —']);
    expect(acertos[1].style.color).toContain('--gp-danger-on');
    expect(acertos[0].style.color).not.toContain('--gp-danger-on');
    expect(acertos[2].style.color).not.toContain('--gp-danger-on');
  });

  it('a barra é relativa à maior especialidade', () => {
    montar();
    const largura = (i: number) => {
      const barra = screen.getAllByTestId('especialidade-praticada')[i].querySelector('[aria-hidden="true"]') as HTMLElement;
      return (barra.firstElementChild as HTMLElement).style.width;
    };
    expect(largura(0)).toBe('100%');
    expect(largura(1)).toBe('50%');
    expect(largura(2)).toBe('10%');
  });

  it('"Abrir taxonomia →" vai para Questões mantendo os filtros, sem o aluno', () => {
    montar();
    const link = screen.getByRole('link', { name: 'Abrir taxonomia →' });
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('/gestor/engajamento/questoes?')).toBe(true);
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('ies')).toBe('ies-1');
    expect(params.get('eng_sem')).toBe('8');
    expect(params.get('periodo')).toBe('30d');
    expect(params.has('aluno')).toBe(false);
  });

  it('sem especialidades: "Nenhuma questão classificada neste recorte."', () => {
    const d = visaoGeralParacatu();
    d.especialidades = [];
    montar(d);
    expect(screen.getByText('Nenhuma questão classificada neste recorte.')).toBeInTheDocument();
  });
});

describe('ComparativoSemestres (§12.2, P8)', () => {
  const setSemestre = vi.fn();
  const montar = (d = visaoGeralParacatu(), semestre: number | null = null) =>
    envolver(<ComparativoSemestres dados={d} consulta={resultadoGestor(d)} filtros={{ semestre, setSemestre }} />);

  beforeEach(() => vi.clearAllMocks());

  it('título, descrição, colunas e as 12 linhas com o ciclo', () => {
    montar();
    expect(screen.getByRole('heading', { level: 2, name: 'Comparativo entre semestres' })).toBeInTheDocument();
    expect(screen.getByText('Clique num semestre para filtrar a página')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Semestre',
      'Base',
      'Engajados',
      'Vídeos / aluno',
      'Docs / aluno',
      'Questões / aluno',
      'Acerto',
    ]);
    const linhas = screen.getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(12);
    expect(linhas[0].textContent).toContain('1º');
    expect(linhas[0].textContent).toContain('básico');
    expect(linhas[5].textContent).toContain('clínico');
    expect(linhas[11].textContent).toContain('internato');
  });

  it('células da 1ª linha: base, % engajados, vídeos/docs por aluno (1 casa), questões e acerto', () => {
    montar();
    const celulas = within(screen.getByTestId('semestre-1')).getAllByRole('cell').map((c) => c.textContent);
    expect(celulas).toEqual(['1º básico', '40', '50%', '9,1', '8,4', '442', '61%']);
  });

  it('clicar no semestre chama setSemestre(n); clicar no selecionado limpa', () => {
    const { unmount } = montar();
    fireEvent.click(screen.getByRole('button', { name: '8º semestre' }));
    expect(setSemestre).toHaveBeenLastCalledWith(8);
    unmount();

    montar(visaoGeralParacatu(), 8);
    expect(screen.getByRole('button', { name: '8º semestre' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '8º semestre' }));
    expect(setSemestre).toHaveBeenLastCalledWith(null);
  });

  it('linha selecionada: fundo de seleção; semestre do aluno filtrado: fundo mais leve', () => {
    montar(visaoGeralComAluno(), 3);
    expect(screen.getByTestId('semestre-3').style.background).toContain('--gp-brand-surface)');
    expect(screen.getByTestId('semestre-8').style.background).toContain('--gp-brand-surface-soft');
    expect(screen.getByTestId('semestre-5').style.background).toBe('');
  });

  it('a linha selecionada que também é a do aluno fica com o fundo de seleção, não o leve', () => {
    montar(visaoGeralComAluno(), 8);
    expect(screen.getByTestId('semestre-8').style.background).not.toContain('soft');
  });

  it('semestre com base mas sem engajados: "—" nas médias e 0% sem número inventado', () => {
    const d = visaoGeralParacatu();
    d.semestres[8] = { ...d.semestres[8], base: 5, engajados: 0, engajadosPct: 0, videosPorEngajado: null, documentosPorEngajado: null, questoesPorEngajado: null, acertoPct: null };
    montar(d);
    const celulas = within(screen.getByTestId('semestre-9')).getAllByRole('cell').map((c) => c.textContent);
    expect(celulas).toEqual(['9º internato', '5', '0%', '—', '—', '—', '—']);
  });

  it('só mostra os semestres que a IES tem: base 0 não vira linha em branco (ex.: FAI só com o 12º)', () => {
    const d = visaoGeralParacatu();
    d.semestres = d.semestres.map((s) =>
      s.semestre === 12 ? s : { ...s, base: 0, engajados: 0, engajadosPct: null, videosPorEngajado: null, documentosPorEngajado: null, questoesPorEngajado: null, acertoPct: null },
    );
    montar(d);
    const linhas = screen.getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].textContent).toContain('12º');
    expect(screen.queryByTestId('semestre-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('semestre-12')).toBeInTheDocument();
  });
});

describe('VisaoGeralEngajamento (rota) — rodapé da página', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVisaoGeral.mockReturnValue(resultadoGestor(visaoGeralParacatu()));
    mockAlunos.mockReturnValue(resultadoGestor(alunosEngajamento(TRES_ALUNOS)));
    mockLista.mockReturnValue(resultadoGestor(listaEngajamento('sumidos30a59', [], { total: 0, pageSize: 5 })));
  });

  it('"Filtrar na tabela de alunos" liga "Sem atividade há 14 dias" e rola até #consumo', () => {
    const rolar = vi.fn();
    Element.prototype.scrollIntoView = rolar;
    envolver(<VisaoGeralEngajamento />);
    expect(screen.getByRole('button', { name: 'Sem atividade há 14 dias' })).toHaveAttribute('aria-pressed', 'false');
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'questoes', 'desc', '', false, 1);

    fireEvent.click(screen.getByRole('button', { name: 'Filtrar na tabela de alunos' }));
    expect(screen.getByRole('button', { name: 'Sem atividade há 14 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(mockAlunos).toHaveBeenLastCalledWith(expect.anything(), 'questoes', 'desc', '', true, 1);
    expect(rolar).toHaveBeenCalledTimes(1);
    expect(rolar.mock.instances[0]).toBe(document.getElementById('consumo'));
  });

  it('o filtro do topo e o Comparativo escrevem a mesma chave eng_sem, nos dois sentidos (toggle)', () => {
    envolver(<VisaoGeralEngajamento />);
    fireEvent.click(screen.getByRole('button', { name: '8º semestre' }));
    expect(screen.getByTestId('url').textContent).toContain('eng_sem=8');
    expect(mockVisaoGeral).toHaveBeenLastCalledWith(expect.objectContaining({ semestre: 8, alunoId: null }));

    fireEvent.click(screen.getByRole('button', { name: '8º semestre' }));
    expect(screen.getByTestId('url').textContent).not.toContain('eng_sem');
  });

  it('clicar no 8º semestre apaga o aluno da URL (aluno e semestre são exclusivos)', () => {
    mockVisaoGeral.mockReturnValue(resultadoGestor(visaoGeralComAluno()));
    envolver(<VisaoGeralEngajamento />, '/gestor/engajamento?ies=ies-1&aluno=aluno-1');
    expect(screen.getByTestId('url').textContent).toContain('aluno=aluno-1');
    fireEvent.click(screen.getByRole('button', { name: '8º semestre' }));
    const url = screen.getByTestId('url').textContent ?? '';
    expect(url).toContain('eng_sem=8');
    expect(url).not.toContain('aluno=');
  });
});
