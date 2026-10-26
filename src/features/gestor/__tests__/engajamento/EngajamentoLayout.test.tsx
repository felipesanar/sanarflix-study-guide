import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockVisaoGeral = vi.fn();
vi.mock('@/features/gestor/api/engajamento', () => ({
  useEngajamentoVisaoGeral: (...args: unknown[]) => mockVisaoGeral(...args),
  // O botão "Exportar" lê a consulta da aba atual; aqui as outras abas não têm dado.
  useEngajamentoQuestoes: () => ({ data: undefined }),
  useEngajamentoConteudos: () => ({ data: undefined }),
}));

import EngajamentoLayout from '@/features/gestor/routes/engajamento/EngajamentoLayout';

/** Spec 2026-10-22-engajamento §9.1, §11, §12.1 e §12.2 (faixa de filtro). */

const Sonda = () => {
  const { pathname, search } = useLocation();
  return (
    <>
      <span data-testid="path">{pathname}</span>
      <span data-testid="search">{search}</span>
    </>
  );
};

const VISAO = {
  ies: { id: 'ies-1', nome: 'PARACATU' },
  temDados: true,
  recorte: { semestre: null, aluno: null },
};

const resultado = (data: unknown, meta: unknown = { atualizadoEm: '2026-10-22T09:02:41.5+00:00' }) => ({
  data,
  meta,
  isLoading: false,
  isError: false,
  isPlaceholderData: false,
  isFetching: false,
  refetch: vi.fn(),
});

const renderizar = (url = '/gestor/engajamento?ies=ies-1') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/gestor/engajamento" element={<EngajamentoLayout />}>
          <Route index element={<div>conteúdo da visão geral</div>} />
          <Route path="questoes" element={<div>conteúdo de questões</div>} />
          <Route path="conteudos" element={<div>conteúdo de conteúdos</div>} />
        </Route>
      </Routes>
      <Sonda />
    </MemoryRouter>,
  );

const params = () => new URLSearchParams(screen.getByTestId('search').textContent ?? '');
const rotulos = (select: HTMLElement) =>
  within(select).getAllByRole('option').map((o) => o.textContent);

describe('EngajamentoLayout (spec §12.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
    mockVisaoGeral.mockReturnValue(resultado(VISAO));
  });
  afterEach(() => vi.useRealTimers());

  describe('cabeçalho', () => {
    it('breadcrumb, H1 e subtítulo com a IES e o "atualizado em" no horário de São Paulo', () => {
      renderizar();
      expect(screen.getByText('Uso da plataforma / Engajamento')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Engajamento no SanarFlix' })).toBeInTheDocument();
      expect(
        screen.getByText(
          'Vídeos, documentos e questões dos alunos da PARACATU · atualizado em 22/10/2026, 06:02',
        ),
      ).toBeInTheDocument();
    });

    it('nunca atualizado (meta.atualizadoEm nulo): termina em "atualização pendente"', () => {
      mockVisaoGeral.mockReturnValue(resultado(VISAO, { atualizadoEm: null }));
      renderizar();
      expect(
        screen.getByText('Vídeos, documentos e questões dos alunos da PARACATU · atualização pendente'),
      ).toBeInTheDocument();
    });

    it('sem dado ainda (carregando), não afirma nome de IES nem horário', () => {
      mockVisaoGeral.mockReturnValue({ ...resultado(undefined, undefined), isLoading: true });
      renderizar();
      expect(screen.getByRole('heading', { level: 1, name: 'Engajamento no SanarFlix' })).toBeInTheDocument();
      expect(screen.queryByText(/atualizado em|atualização pendente/)).not.toBeInTheDocument();
    });

    it('a visão geral é consultada com o recorte lido da URL (período, semestre e aluno)', () => {
      renderizar('/gestor/engajamento?ies=ies-1&periodo=30d&eng_sem=8');
      const filtros = mockVisaoGeral.mock.calls[0][0];
      expect(filtros).toMatchObject({
        iesId: 'ies-1', inicio: '2026-09-23', fim: '2026-10-22', semestre: 8, alunoId: null,
      });
    });
  });

  describe('filtro Período', () => {
    it('opções: Últimos 6 meses, Últimos 30 dias, Semestre letivo AAAA.S e Personalizado…', () => {
      renderizar();
      expect(rotulos(screen.getByLabelText('Período'))).toEqual([
        'Últimos 6 meses',
        'Últimos 30 dias',
        'Semestre letivo 2026.2',
        'Personalizado…',
      ]);
      expect(screen.getByLabelText('Período')).toHaveValue('6m');
    });

    it('escolher uma opção grava periodo na URL', () => {
      renderizar();
      fireEvent.change(screen.getByLabelText('Período'), { target: { value: '30d' } });
      expect(params().get('periodo')).toBe('30d');
      expect(screen.getByLabelText('Período')).toHaveValue('30d');
      fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'letivo' } });
      expect(params().get('periodo')).toBe('letivo');
    });

    it('"Personalizado…" mostra De, Até e Aplicar, sem mexer na URL até aplicar', () => {
      renderizar();
      expect(screen.queryByLabelText('De')).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'custom' } });

      const de = screen.getByLabelText('De');
      const ate = screen.getByLabelText('Até');
      expect(de).toHaveAttribute('type', 'date');
      expect(ate).toHaveAttribute('type', 'date');
      expect(de).toHaveAttribute('min', '2025-01-01');
      expect(de).toHaveAttribute('max', '2026-10-22');
      expect(ate).toHaveAttribute('min', '2025-01-01');
      expect(ate).toHaveAttribute('max', '2026-10-22');
      expect(screen.getByRole('button', { name: 'Aplicar' })).toBeInTheDocument();
      expect(params().has('periodo')).toBe(false);
    });

    it('Aplicar só habilita com datas válidas e grava periodo, de e ate', () => {
      renderizar();
      fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'custom' } });
      const aplicar = screen.getByRole('button', { name: 'Aplicar' });
      expect(aplicar).toBeDisabled();

      fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-05-10' } });
      fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-05-01' } });
      expect(aplicar).toBeDisabled(); // de depois de até

      fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-06-30' } });
      expect(aplicar).toBeEnabled();
      fireEvent.click(aplicar);

      expect(params().get('periodo')).toBe('custom');
      expect(params().get('de')).toBe('2026-05-10');
      expect(params().get('ate')).toBe('2026-06-30');
    });

    it('com período personalizado na URL, já abre com as datas preenchidas', () => {
      renderizar('/gestor/engajamento?ies=ies-1&periodo=custom&de=2026-03-01&ate=2026-04-15');
      expect(screen.getByLabelText('Período')).toHaveValue('custom');
      expect(screen.getByLabelText('De')).toHaveValue('2026-03-01');
      expect(screen.getByLabelText('Até')).toHaveValue('2026-04-15');
    });

    it('voltar para uma opção fixa esconde as datas e remove de/ate da URL', () => {
      renderizar('/gestor/engajamento?ies=ies-1&periodo=custom&de=2026-03-01&ate=2026-04-15');
      fireEvent.change(screen.getByLabelText('Período'), { target: { value: '6m' } });
      expect(screen.queryByLabelText('De')).not.toBeInTheDocument();
      expect(params().has('de')).toBe(false);
      expect(params().has('ate')).toBe(false);
    });
  });

  describe('filtro Semestre do aluno', () => {
    it('opções: "Todos (1º ao 12º)" e "{n}º semestre · {ciclo}"', () => {
      renderizar();
      const opcoes = rotulos(screen.getByLabelText('Semestre do aluno'));
      expect(opcoes).toHaveLength(13);
      expect(opcoes[0]).toBe('Todos (1º ao 12º)');
      expect(opcoes[1]).toBe('1º semestre · básico');
      expect(opcoes[8]).toBe('8º semestre · clínico');
      expect(opcoes[12]).toBe('12º semestre · internato');
      expect(screen.getByLabelText('Semestre do aluno')).toHaveValue('');
    });

    it('escolher um semestre grava eng_sem; voltar a "Todos" remove', () => {
      renderizar();
      fireEvent.change(screen.getByLabelText('Semestre do aluno'), { target: { value: '8' } });
      expect(params().get('eng_sem')).toBe('8');
      expect(screen.getByLabelText('Semestre do aluno')).toHaveValue('8');
      fireEvent.change(screen.getByLabelText('Semestre do aluno'), { target: { value: '' } });
      expect(params().has('eng_sem')).toBe(false);
    });

    it('com aluno filtrado, o select mostra "Todos", fica habilitado e escolher um semestre troca o filtro (regra 1)', () => {
      renderizar('/gestor/engajamento?ies=ies-1&aluno=aluno-7');
      const select = screen.getByLabelText('Semestre do aluno');
      expect(select).toHaveValue('');
      expect(select).toBeEnabled();
      fireEvent.change(select, { target: { value: '5' } });
      expect(params().get('eng_sem')).toBe('5');
      expect(params().has('aluno')).toBe(false);
    });
  });

  it('botão "Exportar" com ícone de download', () => {
    const { container } = renderizar();
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeInTheDocument();
    expect(container.querySelector('[class*="download"]')).not.toBeNull();
  });

  describe('abas', () => {
    it('nav "Seções de engajamento" com Visão geral, Questões e Conteúdos', () => {
      renderizar();
      const nav = screen.getByRole('navigation', { name: 'Seções de engajamento' });
      const links = within(nav).getAllByRole('link');
      expect(links.map((l) => l.textContent)).toEqual(['Visão geral', 'Questões', 'Conteúdos']);
      expect(links[0]).toHaveAttribute('href', expect.stringMatching(/^\/gestor\/engajamento(\?|$)/));
      expect(links[1]).toHaveAttribute('href', expect.stringMatching(/^\/gestor\/engajamento\/questoes/));
      expect(links[2]).toHaveAttribute('href', expect.stringMatching(/^\/gestor\/engajamento\/conteudos/));
    });

    it('marca a aba atual com aria-current; a Visão geral só em correspondência exata', () => {
      renderizar('/gestor/engajamento/questoes?ies=ies-1');
      const nav = screen.getByRole('navigation', { name: 'Seções de engajamento' });
      expect(within(nav).getByRole('link', { name: 'Questões' })).toHaveAttribute('aria-current', 'page');
      expect(within(nav).getByRole('link', { name: 'Visão geral' })).not.toHaveAttribute('aria-current');
      expect(screen.getByText('conteúdo de questões')).toBeInTheDocument();
    });

    it('regra 5: os links de Questões e Conteúdos removem o aluno e mantêm período, semestre e ies', () => {
      renderizar('/gestor/engajamento?ies=ies-1&periodo=30d&aluno=aluno-7');
      const nav = screen.getByRole('navigation', { name: 'Seções de engajamento' });
      for (const nome of ['Questões', 'Conteúdos']) {
        const href = within(nav).getByRole('link', { name: nome }).getAttribute('href') ?? '';
        const destino = new URLSearchParams(href.split('?')[1] ?? '');
        expect(destino.has('aluno'), nome).toBe(false);
        expect(destino.get('ies'), nome).toBe('ies-1');
        expect(destino.get('periodo'), nome).toBe('30d');
      }
    });

    it('regra 5: o link de volta para a Visão geral mantém tudo, menos tipo', () => {
      renderizar('/gestor/engajamento/conteudos?ies=ies-1&periodo=30d&eng_sem=8&tipo=video');
      const nav = screen.getByRole('navigation', { name: 'Seções de engajamento' });
      const href = within(nav).getByRole('link', { name: 'Visão geral' }).getAttribute('href') ?? '';
      const destino = new URLSearchParams(href.split('?')[1] ?? '');
      expect(destino.has('tipo')).toBe(false);
      expect(destino.get('eng_sem')).toBe('8');
      expect(destino.get('periodo')).toBe('30d');
      expect(destino.get('ies')).toBe('ies-1');
    });

    it('clicar na aba navega para ela', () => {
      renderizar('/gestor/engajamento?ies=ies-1&periodo=30d');
      fireEvent.click(screen.getByRole('link', { name: 'Conteúdos' }));
      expect(screen.getByTestId('path').textContent).toBe('/gestor/engajamento/conteudos');
      expect(params().get('periodo')).toBe('30d');
      expect(screen.getByText('conteúdo de conteúdos')).toBeInTheDocument();
    });
  });

  describe('faixa "Página filtrada por"', () => {
    const comAluno = {
      ...VISAO,
      recorte: { semestre: null, aluno: { id: 'aluno-7', nome: 'Ana Clara Ribeiro', semestre: 8 } },
    };

    it('não aparece sem aluno nem semestre', () => {
      renderizar();
      expect(screen.queryByText('Página filtrada por')).not.toBeInTheDocument();
    });

    it('com aluno: chip "Aluno: {nome} ({n}º sem.)" e a frase de escopo', () => {
      mockVisaoGeral.mockReturnValue(resultado(comAluno));
      renderizar('/gestor/engajamento?ies=ies-1&aluno=aluno-7');
      const faixa = screen.getByRole('status');
      expect(within(faixa).getByText('Página filtrada por')).toBeInTheDocument();
      expect(within(faixa).getByText('Aluno: Ana Clara Ribeiro (8º sem.)')).toBeInTheDocument();
      expect(within(faixa).getByText('Todos os componentes abaixo mostram só este recorte.')).toBeInTheDocument();
    });

    it('com semestre: chip "{n}º semestre"', () => {
      renderizar('/gestor/engajamento?ies=ies-1&eng_sem=8');
      const faixa = screen.getByRole('status');
      expect(within(faixa).getByText('8º semestre')).toBeInTheDocument();
    });

    it('o × (aria-label "Remover filtro") limpa aluno e semestre e preserva o resto', () => {
      mockVisaoGeral.mockReturnValue(resultado(comAluno));
      renderizar('/gestor/engajamento?ies=ies-1&periodo=30d&aluno=aluno-7');
      fireEvent.click(screen.getByRole('button', { name: 'Remover filtro' }));
      expect(params().has('aluno')).toBe(false);
      expect(params().has('eng_sem')).toBe(false);
      expect(params().get('periodo')).toBe('30d');
      expect(params().get('ies')).toBe('ies-1');
    });

    it('só existe na Visão geral: nas abas Questões e Conteúdos não aparece', () => {
      renderizar('/gestor/engajamento/questoes?ies=ies-1&eng_sem=8');
      expect(screen.queryByText('Página filtrada por')).not.toBeInTheDocument();
    });
  });

  describe('IES sem dados (§11)', () => {
    beforeEach(() => {
      mockVisaoGeral.mockReturnValue(resultado({ ...VISAO, temDados: false }));
    });

    it.each([
      ['Visão geral', '/gestor/engajamento?ies=ies-1', 'conteúdo da visão geral'],
      ['Questões', '/gestor/engajamento/questoes?ies=ies-1', 'conteúdo de questões'],
      ['Conteúdos', '/gestor/engajamento/conteudos?ies=ies-1', 'conteúdo de conteúdos'],
    ])('aba %s troca o conteúdo pelo estado vazio da instituição', (_aba, url, conteudo) => {
      renderizar(url);
      expect(screen.getByText('Ainda não há dados do SanarFlix para esta instituição.')).toBeInTheDocument();
      expect(
        screen.getByText('Os dados aparecem aqui assim que os alunos da instituição começarem a usar o SanarFlix.'),
      ).toBeInTheDocument();
      expect(screen.queryByText(conteudo)).not.toBeInTheDocument();
    });

    it('o cabeçalho, os filtros e as abas continuam na tela', () => {
      renderizar();
      expect(screen.getByRole('heading', { level: 1, name: 'Engajamento no SanarFlix' })).toBeInTheDocument();
      expect(screen.getByLabelText('Período')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Seções de engajamento' })).toBeInTheDocument();
    });
  });

  it('com dados, renderiza o conteúdo da aba (Outlet)', () => {
    renderizar();
    expect(screen.getByText('conteúdo da visão geral')).toBeInTheDocument();
    expect(screen.queryByText('Ainda não há dados do SanarFlix para esta instituição.')).not.toBeInTheDocument();
  });

  it('erro na visão geral não derruba o layout: cabeçalho, filtros e abas seguem na tela', () => {
    mockVisaoGeral.mockReturnValue({ ...resultado(undefined, undefined), isError: true });
    renderizar();
    expect(screen.getByRole('heading', { level: 1, name: 'Engajamento no SanarFlix' })).toBeInTheDocument();
    expect(screen.getByText('conteúdo da visão geral')).toBeInTheDocument();
  });

  it('trocar de aba pelo link tira o aluno da URL (regra 5, de ponta a ponta)', () => {
    mockVisaoGeral.mockReturnValue(resultado({
      ...VISAO,
      recorte: { semestre: null, aluno: { id: 'aluno-7', nome: 'Ana', semestre: 8 } },
    }));
    renderizar('/gestor/engajamento?ies=ies-1&aluno=aluno-7');
    act(() => {
      fireEvent.click(screen.getByRole('link', { name: 'Questões' }));
    });
    expect(params().has('aluno')).toBe(false);
  });
});
