import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { KpisVisaoGeral } from '@/features/gestor/components/KpisVisaoGeral';
import { metaFake, visaoGeralFake, visaoComUmSimulado, visaoComCasosDificeis } from './fixtures/visaoGeral';

// O setup global troca useLocation por () => ({ pathname: '/' }); o link "Ver
// cronograma" precisa da search real da URL (medido: sem esta linha o teste
// de preservação de query string falha mesmo com o componente correto).
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const titulos = () =>
  screen.getAllByTestId('kpi-card').map((card) => card.querySelector('[data-testid="kpi-titulo"]')?.textContent);

describe('KpisVisaoGeral', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('renderiza os 4 KPIs na ordem canônica da §4.8', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    expect(titulos()).toEqual([
      'Conceito ENAMED projetado',
      'Alunos proficientes',
      'Percentual de acerto',
      'Simulados realizados',
    ]);
  });

  it('formata cada KPI na sua escala: conceito 1-5, percentuais e feitos/total', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const valores = screen.getAllByTestId('kpi-valor').map((v) => v.textContent);
    expect(valores).toEqual(['3/5', '62%', '57%', '3 de 7']);
  });

  it('marca o conceito ENAMED com o badge "projetado" e só ele', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    expect(screen.getAllByText('projetado')).toHaveLength(1);
    expect(screen.getAllByTestId('kpi-card')[0]).toHaveTextContent('projetado');
  });

  it('os três primeiros KPIs lideram pela evolução (régua presente) e o quarto não tem régua', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    expect(cards[0].querySelector('[data-testid="kpi-regua"]')).not.toBeNull();
    expect(cards[1].querySelector('[data-testid="kpi-regua"]')).not.toBeNull();
    expect(cards[2].querySelector('[data-testid="kpi-regua"]')).not.toBeNull();
    expect(cards[3].querySelector('[data-testid="kpi-regua"]')).toBeNull();
  });

  it('o KPI de simulados tem trilha e link "Ver cronograma" para o Início', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    expect(screen.getByTestId('kpi-trilha')).toHaveAttribute('aria-valuenow', '43');
    expect(screen.getByRole('link', { name: 'Ver cronograma' })).toHaveAttribute('href', '/gestor');
  });

  it('o link "Ver cronograma" preserva a query string do recorte atual (ies/semestre/simulados)', () => {
    window.history.pushState({}, '', '/gestor/visao-geral?ies=univille&semestre=11');
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    expect(screen.getByRole('link', { name: 'Ver cronograma' })).toHaveAttribute(
      'href',
      '/gestor?ies=univille&semestre=11',
    );
  });

  it('com 1 simulado realizado nenhuma régua aparece', () => {
    render(<KpisVisaoGeral kpis={visaoComUmSimulado().kpis} meta={metaFake} />);
    expect(screen.queryAllByTestId('kpi-regua')).toHaveLength(0);
  });

  it('propaga o estado de loading para os quatro cards', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} estado="loading" />);
    expect(screen.queryAllByTestId('kpi-skeleton')).toHaveLength(4);
  });

  it('com delta negativo, o card de Percentual de acerto mostra o sinal explícito', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    expect(cards[2]).toHaveTextContent('-2');
  });

  it('com IES sem contrato (contratados nulo), mostra TRACO no total e nunca "0" nem trilha', () => {
    const casosDificeis = visaoComCasosDificeis();
    render(<KpisVisaoGeral kpis={casosDificeis.kpis} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    const valorSimulados = cards[3].querySelector('[data-testid="kpi-valor"]');
    expect(valorSimulados?.textContent).toBe('3 de —');
    expect(valorSimulados?.textContent).not.toContain('0');
    expect(cards[3].querySelector('[data-testid="kpi-trilha"]')).toBeNull();
  });

  it('com ponto nulo na régua, o KPI de proficientes mostra traço nesse ponto (nunca zero)', () => {
    const casosDificeis = visaoComCasosDificeis();
    render(<KpisVisaoGeral kpis={casosDificeis.kpis} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    const regua = cards[1].querySelector('[data-testid="kpi-regua"]');
    expect(regua).toHaveTextContent('—');
    expect(regua?.textContent).not.toMatch(/\b0%/);
  });
});
