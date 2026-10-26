import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockAdmin = vi.fn();
vi.mock('@/services/admin/engajamento', () => ({
  useAdminEngajamento: (...args: unknown[]) => mockAdmin(...args),
}));

import EngajamentoSanarflixPage from '@/experiences/admin/pages/EngajamentoSanarflixPage';
import { adminEngajamento, adminEngajamentoSemestre8 } from '@/features/gestor/__tests__/fixtures/engajamento/admin';

/** Página do admin: cabeçalho, filtros na URL, faixa de semestre e estados (spec §10.8, §12.5). */

const resultado = (data: unknown, extra: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  ...extra,
});

const Sonda = () => {
  const { search } = useLocation();
  return <span data-testid="search">{search}</span>;
};

const montar = (url = '/admin/engajamento') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <EngajamentoSanarflixPage />
      <Sonda />
    </MemoryRouter>,
  );

const params = () => new URLSearchParams(screen.getByTestId('search').textContent ?? '');

describe('EngajamentoSanarflixPage (§12.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
    mockAdmin.mockReturnValue(resultado(adminEngajamento()));
  });
  afterEach(() => vi.useRealTimers());

  it('H1 e subtítulo com o nº de IES e o período em minúsculas', () => {
    montar();
    expect(screen.getByRole('heading', { level: 1, name: 'Engajamento por instituição' })).toBeInTheDocument();
    expect(
      screen.getByText('Rede B2B · 3 IES · últimos 6 meses · sem dados individuais de aluno — para isso, abra o portal do gestor da IES'),
    ).toBeInTheDocument();
  });

  it('consulta com o período padrão (6 meses) e sem semestre', () => {
    montar();
    expect(mockAdmin).toHaveBeenLastCalledWith('2026-05-01', '2026-10-22', null);
  });

  it('filtro Período: 6 meses, 30 dias e o ano corrente; escrever grava `periodo` (e o padrão limpa a chave)', () => {
    montar();
    const seletor = screen.getByLabelText('Período');
    expect(within(seletor).getAllByRole('option').map((o) => o.textContent)).toEqual(['Últimos 6 meses', 'Últimos 30 dias', '2026']);
    fireEvent.change(seletor, { target: { value: '30d' } });
    expect(params().get('periodo')).toBe('30d');
    expect(mockAdmin).toHaveBeenLastCalledWith('2026-09-23', '2026-10-22', null);
    fireEvent.change(seletor, { target: { value: 'ano' } });
    expect(params().get('periodo')).toBe('ano');
    expect(mockAdmin).toHaveBeenLastCalledWith('2026-01-01', '2026-10-22', null);
    fireEvent.change(seletor, { target: { value: '6m' } });
    expect(params().has('periodo')).toBe(false);
  });

  it('subtítulo acompanha o período escolhido', () => {
    montar('/admin/engajamento?periodo=ano');
    expect(screen.getByText(/· 2026 · sem dados individuais/)).toBeInTheDocument();
  });

  it('filtro Semestre do aluno: "Todos (1º ao 12º)" e "{n}º semestre · {ciclo}"', () => {
    montar();
    const seletor = screen.getByLabelText('Semestre do aluno');
    const opcoes = within(seletor).getAllByRole('option').map((o) => o.textContent);
    expect(opcoes[0]).toBe('Todos (1º ao 12º)');
    expect(opcoes[1]).toBe('1º semestre · básico');
    expect(opcoes[8]).toBe('8º semestre · clínico');
    expect(opcoes[12]).toBe('12º semestre · internato');
    expect(opcoes).toHaveLength(13);
  });

  it('escolher um semestre grava `sem`, refaz a consulta e mostra a faixa', () => {
    montar();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    mockAdmin.mockReturnValue(resultado(adminEngajamentoSemestre8()));
    fireEvent.change(screen.getByLabelText('Semestre do aluno'), { target: { value: '8' } });
    expect(params().get('sem')).toBe('8');
    expect(mockAdmin).toHaveBeenLastCalledWith('2026-05-01', '2026-10-22', 8);

    const faixa = screen.getByRole('status');
    expect(within(faixa).getByText('Página filtrada por')).toBeInTheDocument();
    expect(within(faixa).getByText('8º semestre')).toBeInTheDocument();
    expect(within(faixa).getByText('Indicadores, ranking e gráficos mostram só alunos deste semestre em todas as IES.')).toBeInTheDocument();
  });

  it('o "×" da faixa limpa o semestre', () => {
    mockAdmin.mockReturnValue(resultado(adminEngajamentoSemestre8()));
    montar('/admin/engajamento?sem=8');
    expect(screen.getByLabelText('Semestre do aluno')).toHaveValue('8');
    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro' }));
    expect(params().has('sem')).toBe(false);
    expect(screen.getByLabelText('Semestre do aluno')).toHaveValue('');
  });

  it('valor inválido na URL cai no padrão, sem erro', () => {
    montar('/admin/engajamento?periodo=xyz&sem=13');
    expect(screen.getByLabelText('Período')).toHaveValue('6m');
    expect(screen.getByLabelText('Semestre do aluno')).toHaveValue('');
    expect(mockAdmin).toHaveBeenLastCalledWith('2026-05-01', '2026-10-22', null);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('os 4 KPIs da rede aparecem com os dados da RPC', () => {
    montar();
    expect(screen.getByTestId('kpis-rede')).toHaveTextContent('Base ativa da rede1.0003 IES');
  });

  it('carregando: sem KPIs afirmados', () => {
    mockAdmin.mockReturnValue(resultado(undefined, { isLoading: true }));
    montar();
    expect(screen.queryByTestId('kpis-rede')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('erro: "Tentar novamente" refaz a consulta', () => {
    const refetch = vi.fn();
    mockAdmin.mockReturnValue(resultado(undefined, { isError: true, refetch }));
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('sem IES com alunos: "Nenhuma instituição com alunos ativos neste recorte."', () => {
    const d = adminEngajamento();
    d.ranking = [];
    mockAdmin.mockReturnValue(resultado(d));
    montar();
    expect(screen.getByText('Nenhuma instituição com alunos ativos neste recorte.')).toBeInTheDocument();
  });
});
