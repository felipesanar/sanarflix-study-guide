import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockAluno = vi.fn();
vi.mock('@/features/gestor/api/engajamento', () => ({
  useEngajamentoAluno: (...args: unknown[]) => mockAluno(...args),
}));

import { DrawerAlunoEngajamento, textoItemTimeline } from '@/features/gestor/components/engajamento/DrawerAlunoEngajamento';
import type { FiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';
import { alunoEngajamento } from '../fixtures/engajamento/aluno';
import { resultadoGestor } from '../fixtures/engajamento/visaoGeral';

/** Drawer do aluno (spec 2026-10-22-engajamento §8.4, §12.2). */

const setAluno = vi.fn();
const onFechar = vi.fn();

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

const montar = (f = filtros()) =>
  render(
    <TooltipProvider>
      <MemoryRouter>
        <DrawerAlunoEngajamento alunoId="aluno-1" filtros={f} onFechar={onFechar} />
      </MemoryRouter>
    </TooltipProvider>,
  );

const painel = () => screen.getByRole('dialog', { name: 'Detalhes do aluno' });

describe('DrawerAlunoEngajamento (§12.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAluno.mockReturnValue(resultadoGestor(alunoEngajamento()));
  });

  it('consulta o aluno com o recorte da página', () => {
    const f = filtros();
    montar(f);
    expect(mockAluno).toHaveBeenCalledWith(f, 'aluno-1');
  });

  it('cabeçalho: iniciais, nome (H2) e "{n}º semestre · Situação · última atividade …"', () => {
    montar();
    const p = painel();
    expect(within(p).getByRole('heading', { level: 2, name: 'Ana Clara Ribeiro' })).toBeInTheDocument();
    expect(within(p).getByText('AR')).toBeInTheDocument();
    expect(within(p).getByText('8º semestre · Ativo · última atividade hoje')).toBeInTheDocument();
  });

  it('situação sumida e sem atividade', () => {
    const d = alunoEngajamento();
    d.aluno = { ...d.aluno, situacao: 'sumido', diasSemAtividade: 40 };
    mockAluno.mockReturnValue(resultadoGestor(d));
    const { unmount } = montar();
    expect(within(painel()).getByText('8º semestre · Sumido · última atividade há 40 dias')).toBeInTheDocument();
    unmount();

    d.aluno = { ...d.aluno, situacao: 'sem_atividade', diasSemAtividade: null, ultimaAtividade: null };
    mockAluno.mockReturnValue(resultadoGestor(d));
    montar();
    expect(within(painel()).getByText('8º semestre · Sem atividade · última atividade nunca')).toBeInTheDocument();
  });

  it('o botão de fechar tem o nome "Fechar detalhes" e chama onFechar', () => {
    montar();
    fireEvent.click(within(painel()).getByRole('button', { name: 'Fechar detalhes' }));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('4 cartões: Questões, Acerto, Vídeos · Docs e Dias ativos, com as médias do semestre', () => {
    montar();
    const cartoes = within(painel())
      .getAllByTestId('drawer-cartao')
      .map((c) => c.textContent);
    expect(cartoes).toEqual([
      'Questões1.284média do semestre: 420',
      'Acerto74%média do semestre: 66%',
      'Vídeos · Docs142 · 61',
      'Dias ativos42de 175 no período',
    ]);
  });

  it('acerto vazio e média sem valor: "—"', () => {
    const d = alunoEngajamento();
    d.resumo = { ...d.resumo, acertoPct: null, mediaSemestreAcertoPct: null, mediaSemestreQuestoes: null };
    mockAluno.mockReturnValue(resultadoGestor(d));
    montar();
    const cartoes = within(painel()).getAllByTestId('drawer-cartao').map((c) => c.textContent);
    expect(cartoes[0]).toBe('Questões1.284média do semestre: —');
    expect(cartoes[1]).toBe('Acerto—média do semestre: —');
  });

  describe('Atividade mês a mês', () => {
    it('figura acessível com a legenda "Questões (÷4)", "Vídeos", "Documentos", um grupo de barras por mês e sem tabela', () => {
      montar();
      const grafico = within(painel()).getByRole('img', { name: 'Atividade mês a mês' });
      const figura = grafico.closest('figure') as HTMLElement;
      expect(within(figura).getByText('Questões (÷4)')).toBeInTheDocument();
      expect(within(figura).getByText('Vídeos')).toBeInTheDocument();
      expect(within(figura).getByText('Documentos')).toBeInTheDocument();
      expect(within(figura).queryByText('Ver dados em tabela')).toBeNull();
      expect(within(figura).getAllByTestId('drawer-barra-questoes')).toHaveLength(3);
      expect(within(figura).getByText('Out*')).toBeInTheDocument();
    });

    it('questões entram ÷ 4 e o mês de maior atividade ocupa a área toda', () => {
      montar();
      const q = within(painel()).getAllByTestId('drawer-barra-questoes').map((b) => b.style.height);
      const v = within(painel()).getAllByTestId('drawer-barra-videos').map((b) => b.style.height);
      // Set: 600/4 + 20 + 20 = 190, o maior total → 120px; as questões ocupam 150/190 dele.
      expect(parseFloat(q[1]) + parseFloat(v[1]) + parseFloat(within(painel()).getAllByTestId('drawer-barra-documentos')[1].style.height)).toBeCloseTo(120, 5);
      expect(parseFloat(q[1])).toBeCloseTo((150 / 190) * 120, 5);
      expect(parseFloat(q[0])).toBeCloseTo((100 / 190) * 120, 5); // Ago: 400/4 = 100
    });

    it('cores das séries: questões em --gp-brand-strong; vídeos e documentos em tons da marca', () => {
      montar();
      const bg = (id: string) => within(painel()).getAllByTestId(id)[0].style.background;
      expect(bg('drawer-barra-questoes')).toContain('--gp-brand-strong');
      expect(bg('drawer-barra-videos')).toContain('70%');
      expect(bg('drawer-barra-documentos')).toContain('30%');
    });
  });

  describe('Acerto por especialidade vs. semestre', () => {
    it('uma linha por especialidade com "{acerto}% ({questões})", traço da média e a legenda', () => {
      montar();
      const itens = within(painel()).getAllByTestId('drawer-especialidade');
      expect(itens.map((i) => i.firstElementChild?.textContent)).toEqual(['Cardiologia80% (300)', 'Pediatria45% (200)', 'Neonatologia— (50)']);
      expect(within(painel()).getByText('Traço preto = média do mesmo semestre')).toBeInTheDocument();
      // traço na média do semestre: 70% e 62%; sem média, sem traço
      const marcadores = itens.map((i) => within(i).queryByTestId('barra-marcador')?.style.left);
      expect(marcadores).toEqual(['70%', '62%', undefined]);
    });

    it('a largura da barra é o acerto do aluno', () => {
      montar();
      const [cardio] = within(painel()).getAllByTestId('drawer-especialidade');
      const barra = cardio.querySelector('[aria-hidden="true"]') as HTMLElement;
      expect((barra.firstElementChild as HTMLElement).style.width).toBe('80%');
    });
  });

  describe('Últimas atividades', () => {
    it('as três frases, com a data dd/mm', () => {
      montar();
      const itens = within(painel())
        .getByRole('heading', { name: 'Últimas atividades' })
        .parentElement!.querySelectorAll('li');
      expect([...itens].map((li) => li.textContent)).toEqual([
        '22/10Resolveu 25 questões de Cardiologia (80% de acerto)',
        '21/10Assistiu “Betabloqueadores” · Farmacologia',
        '19/10Abriu o documento “Pré-natal de risco” · Obstetrícia',
      ]);
    });

    it('vazio: "Nenhuma atividade registrada"', () => {
      const d = alunoEngajamento();
      d.timeline = [];
      mockAluno.mockReturnValue(resultadoGestor(d));
      montar();
      expect(within(painel()).getByText('Nenhuma atividade registrada')).toBeInTheDocument();
    });

    it('textoItemTimeline: questões sem acerto não inventam percentual', () => {
      expect(
        textoItemTimeline({ dia: '2026-10-22', tipo: 'questoes', especialidade: 'Cardiologia', questoes: 3, acertoPct: null, conteudo: null }),
      ).toBe('Resolveu 3 questões de Cardiologia');
    });
  });

  describe('Filtrar a página por este aluno', () => {
    it('grava o aluno e fecha o drawer', () => {
      montar();
      fireEvent.click(within(painel()).getByRole('button', { name: 'Filtrar a página por este aluno' }));
      expect(setAluno).toHaveBeenCalledWith('aluno-1');
      expect(onFechar).toHaveBeenCalledTimes(1);
    });
  });

  describe('estados', () => {
    it('carregando: esqueleto, sem número afirmado e sem o botão de filtro', () => {
      mockAluno.mockReturnValue(resultadoGestor(undefined, { isLoading: true }));
      montar();
      const p = painel();
      expect(within(p).getByText('Carregando dados do aluno')).toBeInTheDocument();
      expect(within(p).queryByTestId('drawer-cartao')).not.toBeInTheDocument();
      expect(within(p).queryByRole('button', { name: 'Filtrar a página por este aluno' })).not.toBeInTheDocument();
    });

    it('erro: "Tentar novamente" refaz a consulta', () => {
      const refetch = vi.fn();
      mockAluno.mockReturnValue(resultadoGestor(undefined, { isError: true, refetch }));
      montar();
      fireEvent.click(within(painel()).getByRole('button', { name: /Tentar novamente/ }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('ESC fecha o drawer', async () => {
      const user = userEvent.setup();
      montar();
      await user.keyboard('{Escape}');
      expect(onFechar).toHaveBeenCalledTimes(1);
    });
  });
});
