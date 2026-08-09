import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@/test/utils';
import { KpisVisaoGeral } from '@/features/gestor/components/KpisVisaoGeral';
import { contarSimuladosComNotaReal, useVisaoGeral } from '@/features/gestor/api/queries';
import type { FiltrosGestor, VisaoGeral } from '@/features/gestor/api/types';
import { metaFake, visaoGeralFake, visaoComUmSimulado, visaoComCasosDificeis } from './fixtures/visaoGeral';

// O setup global troca useLocation por () => ({ pathname: '/' }); o link "Ver
// cronograma" precisa da search real da URL (medido: sem esta linha o teste
// de preservação de query string falha mesmo com o componente correto).
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

// A RPC e a sessão, para o bloco de `useVisaoGeral` no fim do arquivo. Mesmo
// padrão de `queries.test.tsx`. Não afetam os testes de render acima:
// `KpisVisaoGeral` é apresentacional e não toca nem em supabase nem em auth.
const mockRpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

const titulos = () =>
  screen.getAllByTestId('kpi-card').map((card) => card.querySelector('[data-testid="kpi-titulo"]')?.textContent);

describe('KpisVisaoGeral', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('renderiza os 4 KPIs na ordem canônica da §4.8', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    // "projetado" saiu do título e virou tag qualificadora na mesma linha —
    // o título duplicava a informação da tag (referência: LIGHT.html:3614).
    expect(titulos()).toEqual([
      'Conceito ENAMED',
      'Alunos proficientes',
      'Percentual de acerto',
      'Simulados realizados',
    ]);
  });

  it('formata cada KPI na sua escala, com a escala em elemento próprio', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const valores = screen.getAllByTestId('kpi-valor').map((v) => v.textContent);
    expect(valores).toEqual(['3', '62%', '57%', '3']);
    const sufixos = screen.getAllByTestId('kpi-sufixo').map((s) => s.textContent);
    expect(sufixos).toEqual(['/ 5', '/ 7']);
  });

  /**
   * Item B1 do passe de conformidade: prova que `KpisVisaoGeral` (o caller
   * real) de fato passa `valorNumerico`/`formatarValor` para `KpiCard` — não
   * só que `KpiCard` sabe animar quando alguém passa as props certas
   * (`KpiCard.test.tsx` já cobre isso isoladamente). Sem a fiação aqui, o
   * hook existiria e nunca seria usado em produção.
   */
  it('muda o recorte (rerender com kpis diferentes) e os números fazem count-up — a fiação de valorNumerico/formatarValor está nos 4 cartões', () => {
    vi.useFakeTimers();
    const { rerender } = render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    expect(screen.getAllByTestId('kpi-valor').map((v) => v.textContent)).toEqual([
      '3',
      '62%',
      '57%',
      '3',
    ]);

    const kpisNovoRecorte: VisaoGeral['kpis'] = {
      ...visaoGeralFake.kpis,
      acertoPct: { ...visaoGeralFake.kpis.acertoPct, valor: 90 },
    };
    rerender(<KpisVisaoGeral kpis={kpisNovoRecorte} meta={metaFake} />);

    // No meio do caminho, o 3º cartão (percentual de acerto) ainda não é 90%.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const meioCaminho = screen.getAllByTestId('kpi-valor')[2].textContent;
    expect(meioCaminho).not.toBe('90%');
    expect(meioCaminho).not.toBe('57%');

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getAllByTestId('kpi-valor').map((v) => v.textContent)).toEqual([
      '3',
      '62%',
      '90%',
      '3',
    ]);
    vi.useRealTimers();
  });

  it('cada cartão traz o seu critério VISÍVEL na linha de hint, sem exigir hover', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const hints = screen.getAllByTestId('kpi-hint').map((h) => h.textContent);
    expect(hints).toEqual([
      'projeção institucional · escala 1 a 5',
      'acima de 60 de proficiência',
      // "no simulado mais recente", não "no período": o valor é o `acerto_pct`
      // do ponto `atual` da régua, nunca um acumulado do período.
      'questões certas no simulado mais recente',
      'do contrato vigente da IES',
    ]);
  });

  /**
   * Os quatro cartões têm rodapé de BASE — a linha que diz sobre o que o
   * número foi calculado. Sem ela, dois cartões da referência ficavam sem
   * fundo e o gestor lia "54% dos meus alunos" onde o dado diz "54% de quem
   * fez o último simulado".
   */
  it('todo cartão diz a base do cálculo no rodapé', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const cartoes = screen.getAllByTestId('kpi-card');
    expect(cartoes[1]).toHaveTextContent('sobre os alunos com resultado no simulado mais recente');
    expect(cartoes[2]).toHaveTextContent('respostas válidas, na última tentativa de cada aluno');
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

  it('o cartão do conceito avisa, no rodapé, que a projeção não é o conceito oficial do MEC', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    expect(cards[0].querySelector('[data-testid="kpi-rodape"]')).toHaveTextContent(
      'não é o conceito oficial do MEC',
    );
  });

  /**
   * Invariante 2 do handoff: TRI só existe por aluno, no Detalhamento. A sigla
   * vazava pelo `criterio` do KPI de simulados — visível no tooltip e no
   * `sr-only` de rastreabilidade, dentro da Visão Geral. A asserção varre o
   * texto INTEIRO do bloco (incluindo o sr-only), não só um rótulo específico.
   */
  it('nenhuma sigla TRI aparece na Visão Geral, nem dentro da rastreabilidade', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const bloco = screen.getByTestId('kpis-visao-geral');
    expect(bloco.textContent ?? '').not.toMatch(/\bTRI\b/i);
    // O conceito continua sendo dito, só sem a sigla.
    expect(bloco).toHaveTextContent('nota de proficiência');
  });

  it('com 1 simulado realizado nenhuma régua aparece', () => {
    render(<KpisVisaoGeral kpis={visaoComUmSimulado().kpis} meta={metaFake} />);
    expect(screen.queryAllByTestId('kpi-regua')).toHaveLength(0);
  });

  /**
   * `KpiCard` só materializa o skeleton depois da regra dos 400ms
   * (`useDelayedLoading`, spec de motion §7) — sem avançar o relógio o
   * cartão fica em branco (ver `KpiCard.test.tsx`), então este teste precisa
   * vencer o atraso antes de contar os skeletons.
   */
  it('propaga o estado de loading para os quatro cards', () => {
    vi.useFakeTimers();
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} estado="loading" />);
    act(() => {
      vi.advanceTimersByTime(401);
    });
    expect(screen.queryAllByTestId('kpi-skeleton')).toHaveLength(4);
    vi.useRealTimers();
  });

  it('com delta negativo, o card de Percentual de acerto mostra o sinal explícito e a base de comparação', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    // U+2212 (minus real) — a pílula de delta usa tipografia tabular, não hífen.
    expect(cards[2]).toHaveTextContent('−2');
    expect(cards[2]).toHaveTextContent('vs anterior');
  });

  it('com IES sem contrato (contratados nulo), mostra TRACO no total e nunca "0" nem trilha', () => {
    const casosDificeis = visaoComCasosDificeis();
    render(<KpisVisaoGeral kpis={casosDificeis.kpis} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    const valorSimulados = cards[3].querySelector('[data-testid="kpi-valor"]');
    const sufixoSimulados = cards[3].querySelector('[data-testid="kpi-sufixo"]');
    // `2`: a fixture tem 2 pontos de `evolucao` com nota real (s1, s2) e 1 com
    // `valor: null` (s3) — ver o comentário em `visaoComCasosDificeis`.
    expect(valorSimulados?.textContent).toBe('2');
    expect(sufixoSimulados?.textContent).toBe('/ —');
    expect(sufixoSimulados?.textContent).not.toContain('0');
    expect(cards[3].querySelector('[data-testid="kpi-trilha"]')).toBeNull();
  });

  it('Task 05/08 (achado FAI): "simulados realizados" mostra a contagem de simulados com nota, nunca "0" ao lado de um gráfico com dado real', () => {
    // Reproduz o defeito relatado: a RPC calculava o numerador como "slots do
    // contrato com simulado realizado", que zerava para uma IES sem
    // `ies_simulado_previsto` vinculado (FAI) mesmo com simulados reais no
    // gráfico "Evolução institucional" logo abaixo, na MESMA tela.
    //
    // Aqui o escopo é só o RENDER: dado um numerador já corrigido, o cartão o
    // mostra ao lado de um denominador ausente. O `3` é LITERAL de propósito —
    // até 06/08 esta linha chamava `contarSimuladosComNotaReal(...)` para
    // montar o próprio insumo, isto é, calculava o esperado com a mesma função
    // que deveria estar verificando; o caso seguia verde mesmo com o
    // pós-processamento de `useVisaoGeral` apagado. Quem prova que o numerador
    // corrigido CHEGA até aqui é o bloco de `useVisaoGeral` no fim do arquivo.
    const kpisComoFai: VisaoGeral['kpis'] = {
      ...visaoGeralFake.kpis,
      simulados: {
        realizados: 3, // os 3 pontos de `visaoGeralFake.evolucao` têm nota real
        contratados: null, // FAI não tem linha em ies_contrato_simulados.
      },
    };
    render(<KpisVisaoGeral kpis={kpisComoFai} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    const valorSimulados = cards[3].querySelector('[data-testid="kpi-valor"]');
    expect(valorSimulados?.textContent).toBe('3');
    expect(cards[3].querySelector('[data-testid="kpi-sufixo"]')?.textContent).toBe('/ —');
    expect(valorSimulados?.textContent).not.toContain('0');
  });

  /**
   * As duas pontas de "Simulados realizados" têm recortes diferentes: o
   * numerador é contado sobre `evolucao`, que a RPC monta só com os alunos do
   * semestre selecionado (`u.semestre = ANY(v_sems)`), e o denominador é a
   * soma dos contratos vigentes da IES INTEIRA. Com um semestre específico a
   * fração dizia "1 de 7" comparando universos diferentes; o denominador é
   * suprimido em vez de mentir sobre o total.
   */
  it('com recorte de um semestre específico, o KPI de simulados esconde o denominador e a trilha', () => {
    window.history.pushState({}, '', '/gestor/visao-geral?ies=univille&semestre=5');
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    // O numerador (3 simulados com nota no recorte) continua sendo afirmado.
    expect(cards[3].querySelector('[data-testid="kpi-valor"]')?.textContent).toBe('3');
    expect(cards[3].querySelector('[data-testid="kpi-sufixo"]')).toBeNull();
    expect(cards[3].querySelector('[data-testid="kpi-trilha"]')).toBeNull();
    // E o total contratado não reaparece pela contagem de restantes da trilha.
    expect(cards[3].querySelector('[data-testid="kpi-trilha-restantes"]')).toBeNull();
  });

  it('com recorte de um semestre específico, o cartão explica por que o total contratado sumiu', () => {
    window.history.pushState({}, '', '/gestor/visao-geral?semestre=12');
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    expect(cards[3].querySelector('[data-testid="kpi-hint"]')?.textContent).toBe(
      'com nota neste recorte de semestre',
    );
    expect(cards[3].textContent ?? '').toContain('vale para a IES inteira');
  });

  /**
   * `geral` deixa `v_sems` NULL na RPC — cobre a IES inteira. O denominador do
   * contrato descreve o mesmo universo do numerador e continua onde sempre
   * esteve; suprimi-lo ali seria esconder metade do KPI à toa.
   */
  it('com recorte "geral" (IES inteira) o denominador e a trilha permanecem', () => {
    window.history.pushState({}, '', '/gestor/visao-geral?semestre=geral');
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    expect(cards[3].querySelector('[data-testid="kpi-sufixo"]')?.textContent).toBe('/ 7');
    expect(cards[3].querySelector('[data-testid="kpi-trilha"]')).not.toBeNull();
  });

  /**
   * Refino de 07/08 (migration
   * `20260807200000_gestor_recorte_6ano_e_conceito_geral.sql`): `'6ano'`
   * deixou de cair em `v_sems := NULL` (antes só marcava 11º/12º em
   * evidência, sem filtrar) e passou a recortar de verdade para
   * `ARRAY[11,12]`, igual a um semestre numérico específico. Por isso o KPI
   * de simulados trata `'6ano'` como QUALQUER outro recorte de semestre —
   * mesmo comportamento do teste de `?semestre=5`/`?semestre=12` acima: o
   * numerador (só 11º/12º) e o denominador (contrato da IES inteira) passam a
   * descrever universos diferentes, então o denominador e a trilha somem.
   * Este era exatamente o caso que este arquivo, antes da correção, afirmava
   * o contrário (agrupado com `'geral'` no `it.each` acima).
   */
  it('com recorte "6ano" (filtra 11º/12º, não é mais IES inteira) o KPI de simulados esconde o denominador e a trilha', () => {
    window.history.pushState({}, '', '/gestor/visao-geral?semestre=6ano');
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    expect(cards[3].querySelector('[data-testid="kpi-sufixo"]')).toBeNull();
    expect(cards[3].querySelector('[data-testid="kpi-trilha"]')).toBeNull();
    expect(cards[3].querySelector('[data-testid="kpi-hint"]')?.textContent).toBe(
      'com nota neste recorte de semestre',
    );
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

/**
 * A EMENDA entre a função pura e o cartão — a parte que faltava.
 *
 * Os dois blocos acima cobriam as duas pontas e nenhum cobria o meio: apagar o
 * pós-processamento de `realizados` em `useVisaoGeral` (`api/queries.ts`)
 * deixava a suíte inteira verde enquanto produção voltava a mostrar "0 de —"
 * ao lado de um gráfico com 3 simulados. O teste de render recebia o numerador
 * já corrigido de mão beijada; o teste da função pura nunca via o hook.
 *
 * Aqui a RPC é mockada com o envelope EXATO que produção devolve para a FAI
 * (`kpis.simulados.realizados = 0`, `evolucao` com 3 pontos com nota) e a
 * asserção é sobre o que sai do hook. Se a substituição sair de `useVisaoGeral`,
 * este é o caso que fica vermelho.
 */
describe('useVisaoGeral — o numerador de "Simulados realizados" não é o que a RPC manda', () => {
  const FILTROS: FiltrosGestor = { iesId: 'ies-fai', semestre: '6ano', simulados: [] };

  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  /** Envelope da RPC com o `realizados` que o servidor calcularia. */
  const envelopeCom = (realizados: number, evolucao: VisaoGeral['evolucao']) => ({
    data: {
      data: {
        ...visaoGeralFake,
        kpis: { ...visaoGeralFake.kpis, simulados: { realizados, contratados: null } },
        evolucao,
      },
      meta: metaFake,
    },
    error: null,
  });

  beforeEach(() => {
    mockRpc.mockReset();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('a RPC diz realizados=0 e o hook entrega 3 — os 3 pontos com nota de `evolucao`', async () => {
    mockRpc.mockResolvedValue(envelopeCom(0, visaoGeralFake.evolucao));

    const { result } = renderHook(() => useVisaoGeral(FILTROS), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.kpis.simulados.realizados).toBe(3);
    // `contratados` NÃO é recalculado: continua vindo do servidor tal qual
    // (`null` sem contrato, nunca `0` — spec §4.10). Só o numerador troca de fonte.
    expect(result.current.data?.kpis.simulados.contratados).toBeNull();
  });

  it('ponto sem nota não vira simulado realizado, mesmo quando a RPC infla o número', async () => {
    // O inverso do caso acima: aqui o servidor manda 3 (slots de contrato) e a
    // série só tem 2 medições — o KPI tem de descer para 2, ou volta a
    // discordar do gráfico, que não desenha o ponto nulo (connectNulls={false}).
    const comBuraco: VisaoGeral['evolucao'] = [
      ...visaoGeralFake.evolucao.slice(0, 2),
      { ...visaoGeralFake.evolucao[2], valor: null, participantes: 0 },
    ];
    mockRpc.mockResolvedValue(envelopeCom(3, comBuraco));

    const { result } = renderHook(() => useVisaoGeral(FILTROS), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.kpis.simulados.realizados).toBe(2);
  });

  it('o resto do payload atravessa intacto — a correção é cirúrgica no numerador', async () => {
    // Guarda contra "consertar" o KPI reescrevendo o envelope inteiro: nenhum
    // outro KPI, nem a série, podem ser tocados no caminho.
    mockRpc.mockResolvedValue(envelopeCom(0, visaoGeralFake.evolucao));

    const { result } = renderHook(() => useVisaoGeral(FILTROS), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data?.kpis.proficientesPct).toEqual(visaoGeralFake.kpis.proficientesPct);
    expect(result.current.data?.evolucao).toEqual(visaoGeralFake.evolucao);
    expect(result.current.meta).toEqual(metaFake);
  });
});
