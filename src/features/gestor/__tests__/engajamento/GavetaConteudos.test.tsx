import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockAlunos = vi.fn();
vi.mock('@/features/gestor/api/engajamento', () => ({
  useEngajamentoConteudoAlunos: (...args: unknown[]) => mockAlunos(...args),
}));

import { GavetaConteudos, participacao } from '@/features/gestor/components/engajamento/GavetaConteudos';
import type { ConteudosEngajamento } from '@/features/gestor/api/types-engajamento';
import { conteudoAlunos, conteudosParacatu } from '../fixtures/engajamento/conteudos';
import { resultadoGestor } from '../fixtures/engajamento/visaoGeral';

/** Gaveta "Por especialidade" e pop-up do conteúdo (spec 2026-10-22-engajamento §8.7, §8.8, §12.4). */

const FILTROS = { iesId: 'ies-1', inicio: '2026-05-01', fim: '2026-10-22', semestre: null, alunoId: null, tipo: 'todos' as const };

const montar = (d: ConteudosEngajamento = conteudosParacatu(), extra: Record<string, unknown> = {}) =>
  render(
    <TooltipProvider>
      <MemoryRouter>
        <GavetaConteudos dados={d} consulta={resultadoGestor(d, extra)} filtros={FILTROS} />
      </MemoryRouter>
    </TooltipProvider>,
  );

const linha = (chave: string) => screen.getByTestId(`conteudo-${chave}`);
const existe = (chave: string) => screen.queryByTestId(`conteudo-${chave}`) !== null;
const celulas = (chave: string) => within(linha(chave)).getAllByRole('gridcell').map((c) => c.textContent);

const CARDIO = 'e:Cardiologia';
const ARRITMIAS = 'm:Cardiologia|Arritmias';
const GERAIS = 'm:Cardiologia|Materiais gerais';
const FARMACO = 'e:Farmacologia';
const ECG = 'c:Cardiologia|Arritmias|c-ecg';

describe('GavetaConteudos — estrutura (§12.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAlunos.mockReturnValue(resultadoGestor(conteudoAlunos()));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('título, descrição, "Recolher tudo", treegrid rotulado e cabeçalhos', () => {
    montar();
    expect(screen.getByRole('heading', { level: 2, name: 'Por especialidade' })).toBeInTheDocument();
    expect(
      screen.getByText('Especialidade › módulo › conteúdo · clique numa linha para abrir o nível abaixo · clique num conteúdo para ver quais alunos o consumiram'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recolher tudo' })).toBeInTheDocument();
    const arvore = screen.getByRole('treegrid', { name: 'Conteúdos consumidos por especialidade, módulo e conteúdo' });
    expect(within(arvore).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Especialidade / módulo / conteúdo',
      'Consumos',
      'Alunos',
      'Participação no nível',
    ]);
  });

  it('sem nota de rodapé sobre o que conta como consumo', () => {
    montar();
    expect(screen.queryByText(/Consumo = player ou documento aberto/)).not.toBeInTheDocument();
  });

  it('abertura inicial: a 1ª especialidade e o seu 1º módulo', () => {
    montar();
    expect(linha(CARDIO)).toHaveAttribute('aria-expanded', 'true');
    expect(linha(ARRITMIAS)).toHaveAttribute('aria-expanded', 'true');
    expect(existe(ECG)).toBe(true);
    expect(linha(GERAIS)).toHaveAttribute('aria-expanded', 'false');
    expect(existe('c:Cardiologia|Materiais gerais|c-mapa')).toBe(false);
    expect(linha(FARMACO)).toHaveAttribute('aria-expanded', 'false');
    expect(existe('m:Farmacologia|Módulo básico')).toBe(false);
  });

  it('níveis (aria-level) e valores de cada linha', () => {
    montar();
    expect(linha(CARDIO)).toHaveAttribute('aria-level', '1');
    expect(linha(ARRITMIAS)).toHaveAttribute('aria-level', '2');
    expect(linha(ECG)).toHaveAttribute('aria-level', '3');
    expect(celulas(CARDIO)).toEqual(['Cardiologia', '7.000', '210', '51%']);
    expect(celulas(ECG)).toEqual(['Aula de ECG', '2.400', '120', '60%']);
  });

  it('participação: o 1º nível é ÷ total; cada filho é ÷ o pai; irmãos somam ~100%', () => {
    montar();
    // 7.000 / 13.837 = 50,6 → 51%; 6.837 / 13.837 = 49,4 → 49%
    expect(celulas(CARDIO)[3]).toBe('51%');
    expect(celulas(FARMACO)[3]).toBe('49%');
    // módulos de Cardiologia: 4.000/7.000 = 57% e 3.000/7.000 = 43%
    expect(celulas(ARRITMIAS)[3]).toBe('57%');
    expect(celulas(GERAIS)[3]).toBe('43%');
    // conteúdos de Arritmias: 2.400/4.000 e 1.600/4.000
    expect(celulas(ECG)[3]).toBe('60%');
    expect(celulas('c:Cardiologia|Arritmias|c-fa')[3]).toBe('40%');
    const soma = ['51%', '49%'].reduce((s, v) => s + parseInt(v, 10), 0);
    expect(Math.abs(soma - 100)).toBeLessThanOrEqual(1);
  });

  it('participacao(): inteiro, e "—" sem base', () => {
    expect(participacao(1, 3)).toBe('33%');
    expect(participacao(2, 3)).toBe('67%');
    expect(participacao(5, 0)).toBe('—');
  });

  it('as especialidades somam os consumos totais e cada nível soma o de cima (V14)', () => {
    const d = conteudosParacatu();
    const soma = (xs: Array<{ consumos: number }>) => xs.reduce((s, x) => s + x.consumos, 0);
    expect(soma(d.arvore)).toBe(d.kpis.consumos);
    for (const e of d.arvore) {
      expect(soma(e.modulos)).toBe(e.consumos);
      for (const m of e.modulos) expect(soma(m.conteudos)).toBe(m.consumos);
    }
  });

  it('"Materiais gerais" fica por último dentro da especialidade', () => {
    montar();
    const modulos = [...screen.getByRole('treegrid').querySelectorAll('[role=row][aria-level="2"]')].map((r) => r.getAttribute('data-testid'));
    expect(modulos).toEqual([`conteudo-${ARRITMIAS}`, `conteudo-${GERAIS}`]);
  });

  it('o ícone de cada conteúdo tem aria-label "Vídeo" ou "Documento"', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Materiais gerais' }));
    expect(within(linha(ECG)).getByRole('img', { name: 'Vídeo' })).toBeInTheDocument();
    expect(within(linha('c:Cardiologia|Arritmias|c-fa')).getByRole('img', { name: 'Documento' })).toBeInTheDocument();
    expect(within(linha('c:Cardiologia|Materiais gerais|c-mapa')).getByRole('img', { name: 'Documento' })).toBeInTheDocument();
  });
});

describe('GavetaConteudos — abrir e fechar (§12.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAlunos.mockReturnValue(resultadoGestor(conteudoAlunos()));
  });

  it('aria-label "Abrir {nome}" / "Recolher {nome}"; o clique alterna', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Recolher Cardiologia' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Farmacologia' }));
    expect(linha(FARMACO)).toHaveAttribute('aria-expanded', 'true');
    expect(existe('m:Farmacologia|Módulo básico')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Recolher Farmacologia' }));
    expect(existe('m:Farmacologia|Módulo básico')).toBe(false);
  });

  it('o mesmo conteúdo em dois módulos abre e fecha de forma independente', () => {
    const d = conteudosParacatu();
    d.arvore[0].modulos[1].conteudos = [{ id: 'c-ecg', nome: 'Aula de ECG', tipo: 'video', consumos: 3000, alunos: 100 }];
    montar(d);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Materiais gerais' }));
    expect(existe('c:Cardiologia|Arritmias|c-ecg')).toBe(true);
    expect(existe('c:Cardiologia|Materiais gerais|c-ecg')).toBe(true);
  });

  it('"Recolher tudo" fecha tudo e fica fechado', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher tudo' }));
    for (const c of [CARDIO, FARMACO]) expect(linha(c)).toHaveAttribute('aria-expanded', 'false');
    expect(existe(ARRITMIAS)).toBe(false);
    expect(existe(ECG)).toBe(false);
  });

  it('conteúdo (folha) não tem aria-expanded', () => {
    montar();
    expect(linha(ECG)).not.toHaveAttribute('aria-expanded');
  });
});

describe('AlunosDoConteudoDialog (§12.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
    mockAlunos.mockReturnValue(resultadoGestor(conteudoAlunos()));
  });
  afterEach(() => vi.useRealTimers());

  const abrir = () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver alunos que consumiram Aula de ECG' }));
    return screen.getByRole('dialog');
  };

  it('o botão do conteúdo tem aria-haspopup="dialog"', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Ver alunos que consumiram Aula de ECG' })).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('só consulta depois do clique, com a chave (content_id, especialidade, módulo)', () => {
    montar();
    expect(mockAlunos).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ver alunos que consumiram Aula de ECG' }));
    expect(mockAlunos).toHaveBeenLastCalledWith(FILTROS, { content_id: 'c-ecg', especialidade: 'Cardiologia', modulo: 'Arritmias' });
  });

  it('sobretítulo "{especialidade} › {módulo}", título, resumo e colunas', () => {
    const dialog = abrir();
    expect(within(dialog).getByText('Cardiologia › Arritmias')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Aula de ECG' })).toBeInTheDocument();
    expect(within(dialog).getByText('120 alunos · 2.400 consumos · vídeo')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Aluno', 'Semestre', 'Aberturas', 'Última abertura']);
  });

  it('documento: "… · documento"', () => {
    const d = conteudoAlunos();
    d.conteudo = { ...d.conteudo, tipo: 'document', nome: 'Aula de ECG' };
    mockAlunos.mockReturnValue(resultadoGestor(d));
    expect(abrir()).toHaveTextContent('120 alunos · 2.400 consumos · documento');
  });

  it('"Última abertura" converte UTC para São Paulo antes de contar os dias', () => {
    const dialog = abrir();
    // 02h30Z de 23/10 = 23h30 de 22/10 em SP, e hoje (SP) é 22/10 → "hoje"
    const ana = within(dialog).getByRole('row', { name: /Ana Clara/ });
    expect(within(ana).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Ana Clara Ribeiro', '8º', '40', 'hoje']);
    expect(within(ana).getByText('hoje')).toHaveAttribute('title', '22/10/2026, 23:30');
    const bruno = within(dialog).getByRole('row', { name: /Bruno/ });
    expect(within(bruno).getByText('há 3 dias')).toHaveAttribute('title', '19/10/2026, 12:00');
  });

  it('rodapé "Mostrando os 12 alunos…" só com mais de 12 alunos', () => {
    const dialog = abrir();
    expect(within(dialog).getByText('Mostrando os 12 alunos com mais aberturas de 120.')).toBeInTheDocument();
  });

  it('com 12 alunos ou menos, sem rodapé', () => {
    const d = conteudoAlunos();
    d.resumo = { ...d.resumo, alunos: 2 };
    mockAlunos.mockReturnValue(resultadoGestor(d));
    expect(within(abrir()).queryByText(/Mostrando os 12/)).not.toBeInTheDocument();
  });

  it('fechar devolve o foco ao botão do conteúdo', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    montar();
    const gatilho = screen.getByRole('button', { name: 'Ver alunos que consumiram Aula de ECG' });
    await user.click(gatilho);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gatilho).toHaveFocus();
  });

  it('carregando e erro', () => {
    mockAlunos.mockReturnValue(resultadoGestor(undefined, { isLoading: true }));
    const { unmount } = render(<span />);
    unmount();
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver alunos que consumiram Aula de ECG' }));
    expect(within(screen.getByRole('dialog')).getByText('Carregando alunos')).toBeInTheDocument();
  });

  it('erro: "Tentar novamente" refaz a consulta', () => {
    const refetch = vi.fn();
    mockAlunos.mockReturnValue(resultadoGestor(undefined, { isError: true, refetch }));
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver alunos que consumiram Aula de ECG' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('GavetaConteudos — estados (§11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAlunos.mockReturnValue(resultadoGestor(conteudoAlunos()));
  });

  it('sem consumo: estado vazio compacto', () => {
    const d = conteudosParacatu();
    d.kpis = { consumos: 0, videos: 0, documentos: 0, alunos: 0, porAluno: null };
    d.arvore = [];
    montar(d);
    expect(screen.getByText('Nenhum conteúdo consumido neste recorte.')).toBeInTheDocument();
    expect(screen.queryByRole('treegrid')).not.toBeInTheDocument();
  });

  it('trocando filtro: dado anterior com aria-busy', () => {
    montar(conteudosParacatu(), { isPlaceholderData: true });
    expect(screen.getByTestId('bloco-gaveta-conteudos')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('treegrid')).toBeInTheDocument();
  });

  it('erro: "Tentar novamente" refaz a consulta', () => {
    const refetch = vi.fn();
    render(
      <TooltipProvider>
        <MemoryRouter>
          <GavetaConteudos dados={undefined} consulta={resultadoGestor(undefined, { isError: true, refetch })} filtros={FILTROS} />
        </MemoryRouter>
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
