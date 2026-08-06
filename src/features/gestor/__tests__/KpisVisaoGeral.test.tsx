import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { KpisVisaoGeral } from '@/features/gestor/components/KpisVisaoGeral';
import { contarSimuladosComNotaReal } from '@/features/gestor/api/queries';
import type { VisaoGeral } from '@/features/gestor/api/types';
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
    // `2`: a fixture tem 2 pontos de `evolucao` com nota real (s1, s2) e 1 com
    // `valor: null` (s3) — ver o comentário em `visaoComCasosDificeis`.
    expect(valorSimulados?.textContent).toBe('2 de —');
    expect(valorSimulados?.textContent).not.toContain('0');
    expect(cards[3].querySelector('[data-testid="kpi-trilha"]')).toBeNull();
  });

  it('Task 05/08 (achado FAI): "simulados realizados" mostra a contagem de simulados com nota, nunca "0" ao lado de um gráfico com dado real', () => {
    // Reproduz o defeito relatado: a RPC calculava o numerador como "slots do
    // contrato com simulado realizado", que zerava para uma IES sem
    // `ies_simulado_previsto` vinculado (FAI) mesmo com simulados reais no
    // gráfico "Evolução institucional" logo abaixo, na MESMA tela. A correção
    // (`contarSimuladosComNotaReal`, `api/queries.ts`, consumida por
    // `useVisaoGeral` antes de `kpis` chegar aqui) recalcula o numerador a
    // partir de `evolucao` — os 3 pontos de `visaoGeralFake.evolucao` têm
    // nota real, então o numerador é 3 independentemente do que a RPC diria
    // sobre slots de contrato.
    const kpisComoFai: VisaoGeral['kpis'] = {
      ...visaoGeralFake.kpis,
      simulados: {
        realizados: contarSimuladosComNotaReal(visaoGeralFake.evolucao),
        contratados: null, // FAI não tem linha em ies_contrato_simulados.
      },
    };
    render(<KpisVisaoGeral kpis={kpisComoFai} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    const valorSimulados = cards[3].querySelector('[data-testid="kpi-valor"]');
    expect(valorSimulados?.textContent).toBe('3 de —');
    expect(valorSimulados?.textContent).not.toContain('0');
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

/**
 * `contarSimuladosComNotaReal` (`api/queries.ts`) é a derivação em si — o que
 * `useVisaoGeral` usa para recalcular `kpis.simulados.realizados` antes de
 * `KpisVisaoGeral` receber a prop. Testada aqui em isolamento (função pura,
 * sem precisar montar o hook nem mockar `supabase.rpc`) porque é o núcleo da
 * correção da Task de 05/08: se esta função regredir, o KPI volta a poder
 * discordar do gráfico "Evolução institucional", que lê a MESMA `evolucao`.
 */
describe('contarSimuladosComNotaReal (api/queries.ts)', () => {
  const ponto = (valor: number | null): VisaoGeral['evolucao'][number] => ({
    simuladoId: `s-${valor ?? 'null'}-${Math.random()}`,
    nome: 'Simulado',
    data: '2026-01-01T00:00:00.000Z',
    valor,
    participantes: valor === null ? 0 : 10,
  });

  it('conta só os pontos com nota real (valor !== null), não a lista inteira', () => {
    const evolucao = [ponto(51), ponto(null), ponto(58), ponto(62)];
    expect(contarSimuladosComNotaReal(evolucao)).toBe(3);
    expect(contarSimuladosComNotaReal(evolucao)).not.toBe(evolucao.length);
  });

  it('quando todos os pontos têm nota, a contagem bate com o tamanho da série (caso feliz)', () => {
    expect(contarSimuladosComNotaReal(visaoGeralFake.evolucao)).toBe(visaoGeralFake.evolucao.length);
    expect(contarSimuladosComNotaReal(visaoGeralFake.evolucao)).toBe(3);
  });

  it('série vazia conta 0 — zero real (nenhum simulado no recorte), não ausência de dado', () => {
    expect(contarSimuladosComNotaReal([])).toBe(0);
  });

  it('todos os pontos sem nota (aguardando resultado) conta 0, nunca o total de pontos', () => {
    const evolucao = [ponto(null), ponto(null)];
    expect(contarSimuladosComNotaReal(evolucao)).toBe(0);
  });
});
