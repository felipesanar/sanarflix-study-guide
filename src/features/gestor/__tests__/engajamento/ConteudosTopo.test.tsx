import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockConteudos = vi.fn();
const mockVisaoGeral = vi.fn();
vi.mock('@/features/gestor/api/engajamento', () => ({
  useEngajamentoConteudos: (...args: unknown[]) => mockConteudos(...args),
  // A base de cada semestre (quais existem na IES) vem da visão geral, que o layout já consulta.
  useEngajamentoVisaoGeral: (...args: unknown[]) => mockVisaoGeral(...args),
  // O pop-up de um conteúdo (gaveta, na mesma rota) só consulta com o pop-up aberto.
  useEngajamentoConteudoAlunos: () => ({ data: undefined, isLoading: true, isError: false, isPlaceholderData: false, refetch: () => undefined }),
}));

import { KpisConteudos } from '@/features/gestor/components/engajamento/KpisConteudos';
import ConteudosEngajamento from '@/features/gestor/routes/engajamento/ConteudosEngajamento';
import { META_ENGAJAMENTO, resultadoGestor, visaoGeralParacatu } from '../fixtures/engajamento/visaoGeral';
import { conteudosParacatu } from '../fixtures/engajamento/conteudos';

/** Aba Conteúdos, parte de cima: filtro de tipo, KPIs, Evolução e Por semestre (spec 2026-10-22-engajamento §12.4). */

const Sonda = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};

const montar = (url = '/gestor/engajamento/conteudos?ies=ies-1') =>
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[url]}>
        <ConteudosEngajamento />
        <Sonda />
      </MemoryRouter>
    </TooltipProvider>,
  );

const valor = (id: string) => within(screen.getByTestId(id)).getByTestId('kpi-valor').textContent;
const nota = (id: string) => within(screen.getByTestId(id)).getByTestId('kpi-rodape').textContent;

describe('KpisConteudos (§12.4)', () => {
  const kpis = (tipo: 'todos' | 'video' | 'document') =>
    render(
      <TooltipProvider>
        <KpisConteudos dados={conteudosParacatu()} meta={META_ENGAJAMENTO} tipo={tipo} />
      </TooltipProvider>,
    );

  it('2 KPIs; "Todos" mostra o split vídeos · documentos', () => {
    kpis('todos');
    expect(screen.getAllByTestId('kpi-titulo').map((t) => t.textContent)).toEqual(['Conteúdos consumidos', 'Conteúdos por aluno']);
    expect(valor('kpi-conteudos-consumidos')).toBe('13.837');
    expect(nota('kpi-conteudos-consumidos')).toBe('8.810 vídeos · 5.027 documentos');
    expect(valor('kpi-conteudos-por-aluno')).toBe('46');
    expect(nota('kpi-conteudos-por-aluno')).toBe('13.837 conteúdos ÷ 300 alunos que consumiram');
  });

  it('"Vídeo" e "Documento" trocam a nota', () => {
    const { unmount } = kpis('video');
    expect(nota('kpi-conteudos-consumidos')).toBe('vídeos abertos no período');
    unmount();
    kpis('document');
    expect(nota('kpi-conteudos-consumidos')).toBe('documentos abertos no período');
  });

  it('sem consumo: "Conteúdos por aluno" fica "—"', () => {
    const d = conteudosParacatu();
    d.kpis = { consumos: 0, videos: 0, documentos: 0, alunos: 0, porAluno: null };
    render(
      <TooltipProvider>
        <KpisConteudos dados={d} meta={META_ENGAJAMENTO} tipo="todos" />
      </TooltipProvider>,
    );
    expect(valor('kpi-conteudos-por-aluno')).toBe('—');
  });

  it('carregando e erro', () => {
    const refazer = vi.fn();
    const { unmount } = render(
      <TooltipProvider>
        <KpisConteudos dados={undefined} tipo="todos" estado="loading" />
      </TooltipProvider>,
    );
    expect(screen.getAllByTestId('kpi-titulo')).toHaveLength(2);
    expect(screen.queryAllByTestId('kpi-valor')).toHaveLength(0);
    unmount();
    render(
      <TooltipProvider>
        <KpisConteudos dados={undefined} tipo="todos" estado="error" onTentarNovamente={refazer} />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Tentar novamente/ })[0]);
    expect(refazer).toHaveBeenCalledTimes(1);
  });
});

describe('ConteudosEngajamento — filtro, Evolução e Por semestre (§12.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
    mockConteudos.mockReturnValue(resultadoGestor(conteudosParacatu()));
    mockVisaoGeral.mockReturnValue(resultadoGestor(visaoGeralParacatu()));
  });
  afterEach(() => vi.useRealTimers());

  it('consulta com o recorte da URL, incluindo o tipo', () => {
    montar('/gestor/engajamento/conteudos?ies=ies-1&eng_sem=8&tipo=video&periodo=30d');
    expect(mockConteudos.mock.calls[0][0]).toMatchObject({ iesId: 'ies-1', semestre: 8, tipo: 'video', inicio: '2026-09-23', fim: '2026-10-22' });
  });

  it('"Tipo de conteúdo": Todos, Vídeo e Documento com aria-pressed; o padrão é Todos', () => {
    montar();
    const grupo = screen.getByRole('group', { name: 'Tipo de conteúdo' });
    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Todos', 'Vídeo', 'Documento']);
    expect(within(grupo).getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(grupo).getByRole('button', { name: 'Vídeo' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('trocar o tipo grava `tipo` na URL e refaz a consulta', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Vídeo' }));
    expect(new URLSearchParams(screen.getByTestId('search').textContent ?? '').get('tipo')).toBe('video');
    expect(mockConteudos).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: 'video' }));
    expect(screen.getByRole('button', { name: 'Vídeo' })).toHaveAttribute('aria-pressed', 'true');
    expect(nota('kpi-conteudos-consumidos')).toBe('vídeos abertos no período');
  });

  it('a nota do KPI segue o tipo da URL', () => {
    montar('/gestor/engajamento/conteudos?ies=ies-1&tipo=document');
    expect(nota('kpi-conteudos-consumidos')).toBe('documentos abertos no período');
  });

  it('Evolução: título, descrição com o mês parcial e a figura sem tabela alternativa', () => {
    montar();
    expect(screen.getByRole('heading', { level: 2, name: 'Evolução dos conteúdos consumidos' })).toBeInTheDocument();
    expect(screen.getByText('Total por mês · outubro parcial, até 22/10')).toBeInTheDocument();
    const figura = screen.getByRole('img', { name: 'Evolução dos conteúdos consumidos' }).closest('figure') as HTMLElement;
    expect(within(figura).queryByText('Ver dados em tabela')).toBeNull();
    expect(within(figura).getAllByTestId('linha-ponto')).toHaveLength(6);
    expect(within(figura).getByText('Out*')).toBeInTheDocument();
    expect(within(figura).getByText('1.637')).toBeInTheDocument();
  });

  it('Evolução: eixo de quantidade em múltiplos de 500 (3.000 × 1,15 → 3.500)', () => {
    montar();
    const grafico = screen.getByRole('img', { name: 'Evolução dos conteúdos consumidos' });
    expect(within(grafico).getByText('3.500')).toBeInTheDocument();
    expect(within(grafico).getByText('1.750')).toBeInTheDocument();
  });

  it('sem mês parcial, a descrição é só "Total por mês"', () => {
    const d = conteudosParacatu();
    d.meses = d.meses.map((m) => ({ ...m, parcial: false }));
    mockConteudos.mockReturnValue(resultadoGestor(d));
    montar();
    expect(screen.getByText('Total por mês')).toBeInTheDocument();
  });

  it('Por semestre: título, descrição, uma barra por semestre da IES (12 na PARACATU) e o semestre do filtro realçado', () => {
    montar('/gestor/engajamento/conteudos?ies=ies-1&eng_sem=8');
    expect(screen.getByRole('heading', { level: 2, name: 'Conteúdos por semestre' })).toBeInTheDocument();
    expect(screen.getByText('Total consumido no período por alunos de cada semestre')).toBeInTheDocument();
    const grafico = screen.getByRole('img', { name: 'Conteúdos por semestre' });
    expect(within(grafico).getAllByTestId('barra-semestre')).toHaveLength(12);
    expect(within(grafico).getByText('8º').parentElement).toHaveTextContent('3.000');
    expect((within(grafico).getByText('8º').parentElement as HTMLElement).style.background).toContain('--gp-brand-surface');
    expect((within(grafico).getByText('7º').parentElement as HTMLElement).style.background).toBe('transparent');
  });

  it('Por semestre: só os semestres com alunos na IES (ex.: só o 11º e o 12º), sem colunas em branco', () => {
    const v = visaoGeralParacatu();
    v.semestres = v.semestres.map((s) => (s.semestre >= 11 ? s : { ...s, base: 0 }));
    mockVisaoGeral.mockReturnValue(resultadoGestor(v));
    montar();
    const grafico = screen.getByRole('img', { name: 'Conteúdos por semestre' });
    expect(within(grafico).getAllByTestId('barra-semestre')).toHaveLength(2);
    expect(within(grafico).getByText('11º')).toBeInTheDocument();
    expect(within(grafico).getByText('12º')).toBeInTheDocument();
    expect(within(grafico).queryByText('1º')).not.toBeInTheDocument();
  });

  it('Por semestre: enquanto a base não chega, mostra só os semestres com consumo', () => {
    mockVisaoGeral.mockReturnValue(resultadoGestor(undefined, { isLoading: true }));
    const d = conteudosParacatu();
    d.semestres = d.semestres.map((s) => (s.semestre >= 11 ? s : { ...s, consumos: 0 }));
    mockConteudos.mockReturnValue(resultadoGestor(d));
    montar();
    const grafico = screen.getByRole('img', { name: 'Conteúdos por semestre' });
    expect(within(grafico).getAllByTestId('barra-semestre')).toHaveLength(2);
  });

  it('Evolução e Por semestre crescem até a mesma altura (lado a lado)', () => {
    montar();
    for (const b of ['conteudos-evolucao', 'conteudos-por-semestre']) {
      expect(screen.getByTestId(`bloco-${b}`)).toHaveClass('h-full');
    }
  });

  it('Evolução por dia em período de até 31 dias; por mês acima disso', () => {
    const d = conteudosParacatu();
    d.dias = Array.from({ length: 30 }, (_, i) => ({ dia: new Date(Date.UTC(2026, 8, 23 + i)).toISOString().slice(0, 10), consumos: 10 + i }));
    mockConteudos.mockReturnValue(resultadoGestor(d));
    const { unmount } = montar('/gestor/engajamento/conteudos?ies=ies-1&periodo=30d');
    expect(screen.getByText('Total por dia')).toBeInTheDocument();
    const figura = screen.getByRole('img', { name: 'Evolução dos conteúdos consumidos' });
    expect(within(figura).getAllByTestId('linha-ponto')).toHaveLength(30);
    expect(within(figura).getByText('23 set')).toBeInTheDocument();
    unmount();
    montar('/gestor/engajamento/conteudos?ies=ies-1&periodo=6m');
    expect(screen.getByText(/^Total por mês/)).toBeInTheDocument();
    expect(within(screen.getByRole('img', { name: 'Evolução dos conteúdos consumidos' })).getAllByTestId('linha-ponto')).toHaveLength(6);
  });

  it('Evolução por dia: o eixo y acompanha a grandeza diária (não o múltiplo de 500 do mensal)', () => {
    const d = conteudosParacatu();
    d.dias = Array.from({ length: 30 }, (_, i) => ({ dia: new Date(Date.UTC(2026, 8, 23 + i)).toISOString().slice(0, 10), consumos: 10 + i })); // máx. 39
    mockConteudos.mockReturnValue(resultadoGestor(d));
    montar('/gestor/engajamento/conteudos?ies=ies-1&periodo=30d');
    const figura = screen.getByRole('img', { name: 'Evolução dos conteúdos consumidos' });
    expect(within(figura).getByText('50')).toBeInTheDocument(); // 39 × 1,15 = 44,85 → 50
    expect(within(figura).queryByText('500')).not.toBeInTheDocument();
    expect(within(figura).queryByText('250')).not.toBeInTheDocument();
  });

  it('trocando filtro: dado anterior com aria-busy nos blocos e nos KPIs', () => {
    mockConteudos.mockReturnValue(resultadoGestor(conteudosParacatu(), { isPlaceholderData: true }));
    montar();
    expect(screen.getByTestId('bloco-conteudos-evolucao')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('bloco-conteudos-por-semestre')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('kpis-conteudos').parentElement).toHaveAttribute('aria-busy', 'true');
  });

  it('erro: "Tentar novamente" nos blocos, com o mesmo refetch', () => {
    const refetch = vi.fn();
    mockConteudos.mockReturnValue(resultadoGestor(undefined, { isError: true, refetch }));
    montar();
    const botoes = screen.getAllByRole('button', { name: /Tentar novamente/ });
    expect(botoes.length).toBeGreaterThanOrEqual(5); // 2 KPIs + 2 blocos + gaveta
    botoes.forEach((b) => fireEvent.click(b));
    expect(refetch).toHaveBeenCalledTimes(botoes.length);
  });
});
