import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockQuestoes = vi.fn();
vi.mock('@/features/gestor/api/engajamento', () => ({
  useEngajamentoQuestoes: (...args: unknown[]) => mockQuestoes(...args),
  // A gaveta de taxonomia (mesma rota) só consulta alunos com o pop-up aberto: fora do escopo destes testes.
  useEngajamentoQuestoesAlunos: () => ({ data: undefined, isLoading: true, isError: false, isPlaceholderData: false, refetch: () => undefined }),
}));

import { KpisQuestoes } from '@/features/gestor/components/engajamento/KpisQuestoes';
import QuestoesEngajamento from '@/features/gestor/routes/engajamento/QuestoesEngajamento';
import { META_ENGAJAMENTO, resultadoGestor } from '../fixtures/engajamento/visaoGeral';
import { questoesParacatu } from '../fixtures/engajamento/questoes';

/** Aba Questões, parte de cima: KPIs, Evolução e Por semestre (spec 2026-10-22-engajamento §12.3). */

const montar = (url = '/gestor/engajamento/questoes?ies=ies-1') =>
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[url]}>
        <QuestoesEngajamento />
      </MemoryRouter>
    </TooltipProvider>,
  );

const valor = (id: string) => within(screen.getByTestId(id)).getByTestId('kpi-valor').textContent;
const nota = (id: string) => within(screen.getByTestId(id)).getByTestId('kpi-rodape').textContent;

describe('KpisQuestoes (§12.3)', () => {
  it('3 KPIs: rótulos, valores e notas literais', () => {
    render(
      <TooltipProvider>
        <KpisQuestoes dados={questoesParacatu()} meta={META_ENGAJAMENTO} />
      </TooltipProvider>,
    );
    expect(screen.getAllByTestId('kpi-titulo').map((t) => t.textContent)).toEqual(['Questões resolvidas', 'Acerto', 'Questões por aluno']);
    expect(valor('kpi-questoes-total')).toBe('145.873');
    expect(nota('kpi-questoes-total')).toBe('296 alunos resolveram');
    expect(valor('kpi-questoes-acerto')).toBe('66%');
    expect(nota('kpi-questoes-acerto')).toBe('corretas ÷ (corretas + erradas)');
    expect(valor('kpi-questoes-por-aluno')).toBe('493');
    expect(nota('kpi-questoes-por-aluno')).toBe('145.873 questões ÷ 296 alunos que resolveram');
  });

  it('sem resolvedores: acerto e questões por aluno "—"', () => {
    const d = questoesParacatu();
    d.kpis = { questoes: 0, acertoPct: null, alunos: 0, porAluno: null };
    render(
      <TooltipProvider>
        <KpisQuestoes dados={d} meta={META_ENGAJAMENTO} />
      </TooltipProvider>,
    );
    expect(valor('kpi-questoes-acerto')).toBe('—');
    expect(valor('kpi-questoes-por-aluno')).toBe('—');
    expect(nota('kpi-questoes-por-aluno')).toBe('0 questões ÷ 0 alunos que resolveram');
  });

  it('carregando e erro', () => {
    const refazer = vi.fn();
    const { unmount } = render(
      <TooltipProvider>
        <KpisQuestoes dados={undefined} estado="loading" />
      </TooltipProvider>,
    );
    expect(screen.getAllByTestId('kpi-titulo')).toHaveLength(3);
    expect(screen.queryAllByTestId('kpi-valor')).toHaveLength(0);
    unmount();

    render(
      <TooltipProvider>
        <KpisQuestoes dados={undefined} estado="error" onTentarNovamente={refazer} />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /Tentar novamente/ })[0]);
    expect(refazer).toHaveBeenCalledTimes(1);
  });
});

describe('QuestoesEngajamento — Evolução e Por semestre (§12.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
    mockQuestoes.mockReturnValue(resultadoGestor(questoesParacatu()));
  });
  afterEach(() => vi.useRealTimers());

  it('consulta com o recorte lido da URL', () => {
    montar('/gestor/engajamento/questoes?ies=ies-1&eng_sem=8&periodo=30d');
    expect(mockQuestoes.mock.calls[0][0]).toMatchObject({ iesId: 'ies-1', semestre: 8, inicio: '2026-09-23', fim: '2026-10-22' });
  });

  describe('Evolução', () => {
    it('padrão "Quantidade": título, descrição com o mês parcial e o seletor', () => {
      montar();
      expect(screen.getByRole('heading', { level: 2, name: 'Evolução das questões resolvidas' })).toBeInTheDocument();
      expect(screen.getByText('Total de questões por mês · outubro parcial, até 22/10')).toBeInTheDocument();
      const seletor = screen.getByLabelText('Métrica da evolução');
      expect(within(seletor).getAllByRole('option').map((o) => o.textContent)).toEqual(['Quantidade', '% de acerto']);
      expect(seletor).toHaveValue('quantidade');
    });

    it('"% de acerto" troca título e descrição, com o eixo calculado na descrição', () => {
      montar();
      fireEvent.change(screen.getByLabelText('Métrica da evolução'), { target: { value: 'pct' } });
      expect(screen.getByRole('heading', { level: 2, name: 'Evolução do % de acerto' })).toBeInTheDocument();
      expect(screen.getByText('Acerto médio por mês (eixo de 60% a 75%) · outubro parcial, até 22/10')).toBeInTheDocument();
    });

    it('o eixo da descrição é o mesmo que o gráfico desenha', () => {
      montar();
      fireEvent.change(screen.getByLabelText('Métrica da evolução'), { target: { value: 'pct' } });
      const grafico = screen.getByRole('img', { name: 'Evolução do % de acerto' });
      for (const marca of ['60%', '75%']) expect(within(grafico).getAllByText(marca).length).toBeGreaterThanOrEqual(1);
    });

    it('o gráfico é uma figura acessível com os meses (o parcial com "*") e os valores formatados', () => {
      montar();
      const grafico = screen.getByRole('img', { name: 'Evolução das questões resolvidas' });
      const figura = grafico.closest('figure') as HTMLElement;
      expect(within(figura).queryByText('Ver dados em tabela')).toBeNull();
      expect(within(figura).getAllByTestId('linha-ponto')).toHaveLength(6);
      expect(within(figura).getByText('Out*')).toBeInTheDocument();
      expect(within(figura).getByText('19.873')).toBeInTheDocument();
      expect(within(figura).getByText('31.000')).toBeInTheDocument();
    });

    it('% de acerto: valores em % inteiro; mês sem acerto fica sem ponto', () => {
      const d = questoesParacatu();
      d.meses[2] = { ...d.meses[2], questoes: 0, acertoPct: null };
      mockQuestoes.mockReturnValue(resultadoGestor(d));
      montar();
      fireEvent.change(screen.getByLabelText('Métrica da evolução'), { target: { value: 'pct' } });
      const figura = screen.getByRole('img', { name: 'Evolução do % de acerto' }).closest('figure') as HTMLElement;
      expect(within(figura).getAllByText('65%').length).toBeGreaterThanOrEqual(1);
      expect(within(figura).getAllByTestId('linha-ponto')).toHaveLength(5); // o mês sem acerto não desenha ponto
    });

    it('sem mês parcial no fim, a descrição não cita parcial', () => {
      const d = questoesParacatu();
      d.meses = d.meses.map((m) => ({ ...m, parcial: false }));
      mockQuestoes.mockReturnValue(resultadoGestor(d));
      montar();
      expect(screen.getByText('Total de questões por mês')).toBeInTheDocument();
    });
  });

  describe('Por semestre', () => {
    it('padrão "Quantidade": título, descrição, seletor e as 12 barras', () => {
      montar();
      expect(screen.getByRole('heading', { level: 2, name: 'Questões por semestre' })).toBeInTheDocument();
      expect(screen.getByText('Total resolvido no período por alunos de cada semestre')).toBeInTheDocument();
      const seletor = screen.getByLabelText('Métrica por semestre');
      expect(within(seletor).getAllByRole('option').map((o) => o.textContent)).toEqual(['Quantidade', '% de acerto']);
      const figura = screen.getByRole('img', { name: 'Questões por semestre' }).closest('figure') as HTMLElement;
      expect(within(figura).getAllByTestId('barra-semestre')).toHaveLength(12);
      expect(within(figura).getByText('8º').parentElement).toHaveTextContent('30.000');
    });

    it('"% de acerto": título e descrição próprios; sem acerto, "—"', () => {
      montar();
      fireEvent.change(screen.getByLabelText('Métrica por semestre'), { target: { value: 'pct' } });
      expect(screen.getByRole('heading', { level: 2, name: '% de acerto por semestre' })).toBeInTheDocument();
      expect(screen.getByText('Acerto médio dos alunos de cada semestre (barra cheia = 100%)')).toBeInTheDocument();
      const figura = screen.getByRole('img', { name: '% de acerto por semestre' }).closest('figure') as HTMLElement;
      expect(within(figura).getByText('1º').parentElement).toHaveTextContent('60%');
      expect(within(figura).getByText('9º').parentElement).toHaveTextContent('—');
    });

    it('os dois seletores são independentes', () => {
      montar();
      fireEvent.change(screen.getByLabelText('Métrica por semestre'), { target: { value: 'pct' } });
      expect(screen.getByLabelText('Métrica da evolução')).toHaveValue('quantidade');
      expect(screen.getByRole('heading', { level: 2, name: 'Evolução das questões resolvidas' })).toBeInTheDocument();
    });

    it('o semestre do filtro fica realçado; sem filtro, nenhum', () => {
      const { unmount } = montar('/gestor/engajamento/questoes?ies=ies-1&eng_sem=8');
      const grafico = screen.getByRole('img', { name: 'Questões por semestre' });
      const fundo = (n: number) => (within(grafico).getByText(`${n}º`).parentElement as HTMLElement).style.background;
      expect(fundo(8)).toContain('--gp-brand-surface');
      expect(fundo(7)).toBe('transparent');
      unmount();

      montar();
      const g2 = screen.getByRole('img', { name: 'Questões por semestre' });
      expect((within(g2).getByText('8º').parentElement as HTMLElement).style.background).toBe('transparent');
    });

    it('as barras ignoram o filtro: continuam as 12 barras com o filtro de semestre ligado', () => {
      montar('/gestor/engajamento/questoes?ies=ies-1&eng_sem=8');
      const figura = screen.getByRole('img', { name: 'Questões por semestre' }).closest('figure') as HTMLElement;
      expect(within(figura).getAllByTestId('barra-semestre')).toHaveLength(12);
    });
  });

  describe('estados (§11)', () => {
    it('trocando filtro: dado anterior com aria-busy nos blocos e nos KPIs', () => {
      mockQuestoes.mockReturnValue(resultadoGestor(questoesParacatu(), { isPlaceholderData: true }));
      montar();
      expect(screen.getByTestId('bloco-questoes-evolucao')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByTestId('bloco-questoes-por-semestre')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByTestId('kpis-questoes').parentElement).toHaveAttribute('aria-busy', 'true');
    });

    it('erro: "Tentar novamente" em cada bloco, todos com o mesmo refetch', () => {
      const refetch = vi.fn();
      mockQuestoes.mockReturnValue(resultadoGestor(undefined, { isError: true, refetch }));
      montar();
      const botoes = screen.getAllByRole('button', { name: /Tentar novamente/ });
      expect(botoes.length).toBeGreaterThanOrEqual(5); // 3 KPIs + 2 blocos
      botoes.forEach((b) => fireEvent.click(b));
      expect(refetch).toHaveBeenCalledTimes(botoes.length);
    });
  });
});
