import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockVisaoGeral = vi.fn();
const mockQuestoes = vi.fn();
const mockConteudos = vi.fn();
const carregando = () => ({ data: undefined, isLoading: true, isError: false, isPlaceholderData: false, refetch: () => undefined });
vi.mock('@/features/gestor/api/engajamento', () => ({
  PAGE_SIZE_ALUNOS: 20,
  useEngajamentoVisaoGeral: (...args: unknown[]) => mockVisaoGeral(...args),
  useEngajamentoQuestoes: (...args: unknown[]) => mockQuestoes(...args),
  useEngajamentoConteudos: (...args: unknown[]) => mockConteudos(...args),
  useEngajamentoAlunos: () => carregando(),
  useEngajamentoLista: () => carregando(),
  useEngajamentoQuestoesAlunos: () => carregando(),
  useEngajamentoConteudoAlunos: () => carregando(),
  buscarExportAlunos: vi.fn(),
  buscarListaCompleta: vi.fn(),
}));
vi.mock('@/features/gestor/api/queries', () => ({ useGestorContexto: () => ({ data: { podeExportar: false } }) }));

import {
  ROTEIRO_CONTEUDOS,
  ROTEIRO_QUESTOES,
  ROTEIRO_VISAO_GERAL,
  SEGURA_CONCLUSAO_MS,
  etapasDoCarregamento,
  frasesDoRoteiro,
  indiceDaFrase,
  progressoEstimado,
} from '@/features/gestor/components/engajamento/CarregamentoEngajamento';
import ConteudosEngajamento from '@/features/gestor/routes/engajamento/ConteudosEngajamento';
import QuestoesEngajamento from '@/features/gestor/routes/engajamento/QuestoesEngajamento';
import VisaoGeralEngajamento from '@/features/gestor/routes/engajamento/VisaoGeralEngajamento';
import { resultadoGestor, visaoGeralParacatu } from '../fixtures/engajamento/visaoGeral';

/** Carregamento da primeira abertura das abas do Engajamento (opção C do Claude Design, 30/10/2026). */

const envolver = (ui: React.ReactElement, url = '/gestor/engajamento?ies=ies-1') => {
  const arvore = (filho: React.ReactElement) => (
    <TooltipProvider>
      <MemoryRouter initialEntries={[url]}>{filho}</MemoryRouter>
    </TooltipProvider>
  );
  const r = render(arvore(ui));
  return { ...r, rerender: (filho: React.ReactElement) => r.rerender(arvore(filho)) };
};

const frase = (segundos: number, concluido = false) =>
  frasesDoRoteiro(ROTEIRO_VISAO_GERAL)[indiceDaFrase(ROTEIRO_VISAO_GERAL, segundos, concluido)];
const avancar = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('progressoEstimado', () => {
  it('começa em 0, sobe rápido e desacelera: ~64% aos 3 s, ~90% aos 8 s', () => {
    expect(progressoEstimado(0)).toBe(0);
    expect(progressoEstimado(3)).toBeCloseTo(64, 0);
    expect(progressoEstimado(8)).toBeCloseTo(90, 0);
  });

  it('nunca chega a 100 sozinho', () => {
    expect(progressoEstimado(60)).toBeLessThan(95);
    expect(progressoEstimado(-1)).toBe(0);
  });
});

describe('indiceDaFrase', () => {
  it('as frases seguem o percentual', () => {
    expect(frase(0)).toBe('Coletando os seus dados…');
    expect(frase(3)).toBe('Agregando e realizando as contas…');
  });

  it('passado o fim previsto, as frases de "quase lá" se revezam em vez de travar numa só', () => {
    const demora = [frase(8.6), frase(11.6), frase(14.6)];
    expect(demora[0]).toBe('Quase lá, conferindo as contas…');
    expect(new Set(demora).size).toBe(3);
  });

  it('dado que chegou é "Prontinho!", em qualquer momento e em qualquer aba', () => {
    expect(frase(1, true)).toBe('Prontinho!');
    for (const roteiro of [ROTEIRO_QUESTOES, ROTEIRO_CONTEUDOS]) {
      expect(frasesDoRoteiro(roteiro)[indiceDaFrase(roteiro, 1, true)]).toBe('Prontinho!');
    }
  });

  it('cada aba conta a sua história', () => {
    const aos = (roteiro: typeof ROTEIRO_QUESTOES, s: number) => frasesDoRoteiro(roteiro)[indiceDaFrase(roteiro, s, false)];
    expect(aos(ROTEIRO_QUESTOES, 2)).toBe('Separando acertos e erros…');
    expect(aos(ROTEIRO_CONTEUDOS, 2)).toBe('Folheando os documentos abertos…');
  });
});

describe('etapasDoCarregamento', () => {
  it('marca feitas, a atual e as pendentes pelo percentual', () => {
    expect(etapasDoCarregamento(ROTEIRO_VISAO_GERAL, 40).map((e) => e.estado)).toEqual(['feita', 'atual', 'pendente', 'pendente']);
    expect(etapasDoCarregamento(ROTEIRO_VISAO_GERAL, 100).every((e) => e.estado === 'feita')).toBe(true);
  });
});

describe('VisaoGeralEngajamento — primeira abertura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const blocosEscondidos = () => screen.getByTestId('kpis-engajamento').closest('[hidden]');

  it('regra dos 400 ms: antes dela, espaço em branco; depois, o painel com logo, frase, percentual e etapas', () => {
    mockVisaoGeral.mockReturnValue(resultadoGestor(undefined, { isLoading: true }));
    envolver(<VisaoGeralEngajamento />);

    expect(screen.getByTestId('carregamento-aguardando')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Carregando Engajamento' })).not.toBeInTheDocument();
    expect(blocosEscondidos()).not.toBeNull();

    avancar(450);
    const painel = screen.getByRole('status', { name: 'Carregando Engajamento' });
    expect(within(painel).getByRole('progressbar', { name: 'Progresso estimado do carregamento' })).toBeInTheDocument();
    expect(within(painel).getAllByRole('listitem')).toHaveLength(4);
    expect(within(painel).getByText(ROTEIRO_VISAO_GERAL.apoio)).toBeInTheDocument();
    expect(blocosEscondidos()).not.toBeNull();

    avancar(3000);
    const pct = Number(screen.getByTestId('carregamento-pct').textContent);
    expect(pct).toBeGreaterThan(50);
    expect(pct).toBeLessThan(94);
  });

  it('dado chegando: 100% e "Prontinho!" por 1 s, depois a tela', () => {
    expect(SEGURA_CONCLUSAO_MS).toBe(1000);
    mockVisaoGeral.mockReturnValue(resultadoGestor(undefined, { isLoading: true }));
    const { rerender } = envolver(<VisaoGeralEngajamento />);
    avancar(2000);

    mockVisaoGeral.mockReturnValue(resultadoGestor(visaoGeralParacatu()));
    rerender(<VisaoGeralEngajamento />);
    expect(screen.getByTestId('carregamento-pct').textContent).toBe('100');
    expect(document.querySelector('[data-ativa="true"]')?.textContent).toBe('Prontinho!');

    avancar(SEGURA_CONCLUSAO_MS - 100);
    expect(screen.getByTestId('carregamento-engajamento')).toBeInTheDocument();

    avancar(110);
    expect(screen.queryByTestId('carregamento-engajamento')).not.toBeInTheDocument();
    expect(blocosEscondidos()).toBeNull();
  });

  it('resposta rápida (cache, rede boa): nenhum painel', () => {
    mockVisaoGeral.mockReturnValue(resultadoGestor(visaoGeralParacatu()));
    envolver(<VisaoGeralEngajamento />);
    avancar(1000);
    expect(screen.queryByTestId('carregamento-engajamento')).not.toBeInTheDocument();
    expect(screen.queryByTestId('carregamento-aguardando')).not.toBeInTheDocument();
    expect(blocosEscondidos()).toBeNull();
  });

  it('erro sem dado: os blocos aparecem com "Tentar novamente", sem painel', () => {
    mockVisaoGeral.mockReturnValue(resultadoGestor(undefined, { isError: true }));
    envolver(<VisaoGeralEngajamento />);
    avancar(1000);
    expect(screen.queryByTestId('carregamento-engajamento')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Tentar novamente/ }).length).toBeGreaterThan(0);
  });
});

describe('Questões e Conteúdos — primeira abertura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockVisaoGeral.mockReturnValue(resultadoGestor(visaoGeralParacatu()));
    mockQuestoes.mockReturnValue(resultadoGestor(undefined, { isLoading: true }));
    mockConteudos.mockReturnValue(resultadoGestor(undefined, { isLoading: true }));
  });
  afterEach(() => vi.useRealTimers());

  it('Questões: painel com o roteiro de questões e os KPIs escondidos', () => {
    envolver(<QuestoesEngajamento />, '/gestor/engajamento/questoes?ies=ies-1');
    avancar(450);
    const painel = screen.getByRole('status', { name: 'Carregando Engajamento' });
    expect(within(painel).getByText(ROTEIRO_QUESTOES.apoio)).toBeInTheDocument();
    expect(within(painel).getByText(/Temas e assuntos/)).toBeInTheDocument();
    expect(screen.getByTestId('kpis-questoes').closest('[hidden]')).not.toBeNull();
  });

  it('Conteúdos: painel com o roteiro de conteúdos; o filtro de tipo continua à mão', () => {
    envolver(<ConteudosEngajamento />, '/gestor/engajamento/conteudos?ies=ies-1');
    avancar(450);
    const painel = screen.getByRole('status', { name: 'Carregando Engajamento' });
    expect(within(painel).getByText(ROTEIRO_CONTEUDOS.apoio)).toBeInTheDocument();
    expect(within(painel).getByText(/Mais consumidos/)).toBeInTheDocument();
    expect(screen.getByTestId('kpis-conteudos').closest('[hidden]')).not.toBeNull();
    expect(screen.getByTestId('conteudos-engajamento').querySelector('[hidden]')?.previousElementSibling).toBeTruthy();
  });
});
