import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { fireEvent, render, screen, userEvent, waitFor, within } from '@/test/utils';
import { GraficoProtagonista } from '@/features/gestor/components/GraficoProtagonista';
import { useVisaoGeral } from '@/features/gestor/api/queries';
import type { FiltrosGestor, Meta, VisaoGeral } from '@/features/gestor/api/types';

/**
 * `@/integrations/supabase/client` e `@/contexts/AuthContext` são mockados
 * (não `@/features/gestor/api/queries`, que roda de verdade): o 4º teste
 * precisa da implementação REAL de `useVisaoGeral`/react-query para provar
 * que ela é chamada uma única vez ao trocar de modo — mockar `queries.ts`
 * provaria só que o mock foi chamado uma vez, não que o hook não refaz
 * requisição. Mesmo padrão de `src/features/gestor/__tests__/queries.test.tsx`.
 */
const { rpcSpy } = vi.hoisted(() => ({ rpcSpy: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: rpcSpy } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

/**
 * Fixture local a este arquivo, com os MESMOS valores de `visaoGeralFake` do
 * plano (Task 37, `__tests__/fixtures/visaoGeral.ts`) — esse arquivo é de
 * outro agente, roda em paralelo e ainda não existe neste working tree (mesma
 * situação já resolvida da mesma forma em EvolucaoChart/AreasChart/
 * DispersaoChart/CascataDiagnostico.test.tsx). Migrar para o import
 * compartilhado quando ele pousar — os valores são idênticos, nenhuma
 * expectativa deveria mudar.
 */
const META: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados ENAMED SanarFlix',
  atualizadoEm: '2026-07-20T12:00:00.000Z',
  criterio: 'Proficiente = proficiência >= 60',
  partial: false,
  lowSample: false,
};

const VISAO_GERAL_FAKE: VisaoGeral = {
  kpis: {
    enamedProjetado: { valor: 3, delta: 1, serie: [], criterio: 'Conceito 1–5' },
    proficientesPct: { valor: 62, delta: 4, serie: [], criterio: 'Proficiente = proficiência >= 60' },
    acertoPct: { valor: 57, delta: -2, serie: [], criterio: 'Acertos sobre questões respondidas' },
    simulados: { realizados: 3, contratados: 7 },
  },
  evolucao: [
    { simuladoId: 's1', nome: 'Simulado 1', data: '2026-03-10T00:00:00.000Z', valor: 51, participantes: 120 },
    { simuladoId: 's2', nome: 'Simulado 2', data: '2026-05-12T00:00:00.000Z', valor: 58, participantes: 118 },
    { simuladoId: 's3', nome: 'Simulado 3', data: '2026-07-14T00:00:00.000Z', valor: 62, participantes: 115 },
  ],
  evolucaoPorArea: [
    {
      area: 'Clínica Médica',
      critica: true,
      pontos: [
        { rotulo: 'Simulado 1', valor: 28 },
        { rotulo: 'Simulado 2', valor: 29 },
        { rotulo: 'Simulado 3', valor: 27 },
      ],
    },
    {
      area: 'Cirurgia',
      critica: false,
      pontos: [
        { rotulo: 'Simulado 1', valor: 58 },
        { rotulo: 'Simulado 2', valor: 60 },
        { rotulo: 'Simulado 3', valor: 61 },
      ],
    },
  ],
  diagnosticoResumo: [
    { nivel: 'excelente', areas: [{ id: 'ga-gine', nome: 'Ginecologia e Obstetrícia', acertoPct: 84 }] },
    { nivel: 'mediano', areas: [{ id: 'ga-cirurgia', nome: 'Cirurgia', acertoPct: 61 }] },
    { nivel: 'critico', areas: [{ id: 'ga-clinica', nome: 'Clínica Médica', acertoPct: 27 }] },
  ],
  distribuicaoAlunos: [
    { grupo: 'consistentemente_proficiente', quantidade: 48, percentual: 42 },
    { grupo: 'em_variacao', quantidade: 39, percentual: 34 },
    { grupo: 'consistentemente_nao_proficiente', quantidade: 28, percentual: 24 },
  ],
  dispersao: [
    { alunoId: 'a1', semestre: 11, nota: 72 },
    { alunoId: 'a2', semestre: 11, nota: 58 },
    { alunoId: 'a3', semestre: 11, nota: 64 },
    { alunoId: 'a4', semestre: 12, nota: 81 },
    { alunoId: 'a5', semestre: 12, nota: 49 },
    { alunoId: 'a6', semestre: 12, nota: 66 },
  ],
  insights: [
    { escopo: 'area', texto: 'Clínica Médica está em nível crítico nos três simulados, com desempenho estável em 27%.' },
    { escopo: 'aluno', texto: '28 alunos permanecem abaixo do limiar em todos os simulados do recorte.' },
  ],
};

const FILTROS: FiltrosGestor = { iesId: 'ies-1', semestre: '6ano', simulados: [] };

/**
 * Harness com o hook REAL (não mockado) — é a única forma de provar o caso
 * crítico nº15 (spec §8.2): `useVisaoGeral` já desembrulha o envelope em
 * `ResultadoGestor<T>.data` (um único unwrap, ver `api/queries.ts`), então
 * `consulta.data` já é `VisaoGeral`, nunca `consulta.data.data`.
 */
function Harness() {
  const consulta = useVisaoGeral(FILTROS);
  if (!consulta.data) return <p>carregando</p>;
  return <GraficoProtagonista visao={consulta.data} />;
}

describe('GraficoProtagonista', () => {
  beforeEach(() => {
    rpcSpy.mockReset();
    rpcSpy.mockResolvedValue({ data: { data: VISAO_GERAL_FAKE, meta: META }, error: null });
  });

  it('abre no modo Geral', () => {
    render(<GraficoProtagonista visao={VISAO_GERAL_FAKE} />);
    expect(screen.getByRole('button', { name: 'Geral', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Evolução da proficiência institucional/i })).toBeInTheDocument();
  });

  it('mantém o controle de modo dentro do card do gráfico', () => {
    render(<GraficoProtagonista visao={VISAO_GERAL_FAKE} />);
    const card = screen.getByTestId('grafico-protagonista');
    expect(card).toContainElement(screen.getByTestId('grafico-modos'));
  });

  /**
   * Os rótulos são os da referência, ao pé da letra: "Geral", "Grande área",
   * "Aluno". O "Por " que existia antes ("Por grande área", "Por aluno")
   * transformava um seletor de MODO DE LEITURA em algo que se lia como filtro,
   * e alargava os segmentos a ponto de empurrar o título do card.
   */
  it('rotula os três modos exatamente como a referência: Geral · Grande área · Aluno', () => {
    render(<GraficoProtagonista visao={VISAO_GERAL_FAKE} />);
    const barra = screen.getByTestId('grafico-modos');
    expect(within(barra).getAllByRole('button').map((botao) => botao.textContent)).toEqual([
      'Geral',
      'Grande área',
      'Aluno',
    ]);
    expect(screen.queryByRole('button', { name: /^Por / })).not.toBeInTheDocument();
  });

  it('alterna para Grande área e para Aluno trocando o componente exibido', async () => {
    const user = userEvent.setup();
    render(<GraficoProtagonista visao={VISAO_GERAL_FAKE} />);

    await user.click(screen.getByRole('button', { name: 'Grande área' }));
    expect(screen.getByRole('img', { name: /Desempenho por grande área/i })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Evolução da proficiência institucional/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Aluno' }));
    expect(screen.getByRole('img', { name: /Dispersão de proficiência por semestre/i })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Desempenho por grande área/i })).not.toBeInTheDocument();
  });

  /**
   * Anatomia do segmented do handoff, a mesma de `FiltroSemestre`: um
   * indicador ÚNICO que DESLIZA por `transform` sob os rótulos. O estado ativo
   * era antes `bg-background … shadow-sm` no próprio botão — sombra em botão,
   * que a régua proíbe, e um retângulo que piscava de um segmento para o outro
   * em vez de deslizar.
   */
  it('o realce é um indicador único que desliza por transform, sem sombra em botão', async () => {
    const user = userEvent.setup();
    render(<GraficoProtagonista visao={VISAO_GERAL_FAKE} />);

    const indicador = screen.getByTestId('grafico-modos-indicador');
    expect(indicador.style.transform).toBe('translateX(0%)');

    await user.click(screen.getByRole('button', { name: 'Grande área' }));
    expect(screen.getByTestId('grafico-modos-indicador').style.transform).toBe('translateX(100%)');

    await user.click(screen.getByRole('button', { name: 'Aluno' }));
    expect(screen.getByTestId('grafico-modos-indicador').style.transform).toBe('translateX(200%)');

    // Um só indicador, e nenhum segmento carrega sombra própria.
    expect(screen.getAllByTestId('grafico-modos-indicador')).toHaveLength(1);
    within(screen.getByTestId('grafico-modos'))
      .getAllByRole('button')
      .forEach((botao) => expect(botao.className).not.toMatch(/shadow/));
  });

  it('NÃO dispara nenhuma requisição ao trocar de modo (caso crítico nº15)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId('grafico-protagonista')).toBeInTheDocument());
    expect(rpcSpy).toHaveBeenCalledTimes(1);
    expect(rpcSpy).toHaveBeenCalledWith('get_gestor_visao_geral', expect.anything());

    await user.click(screen.getByRole('button', { name: 'Grande área' }));
    await user.click(screen.getByRole('button', { name: 'Aluno' }));
    await user.click(screen.getByRole('button', { name: 'Geral' }));

    expect(rpcSpy).toHaveBeenCalledTimes(1);
  });

  it('expõe o seletor de modo como toolbar (roving tabIndex sobre toggles é o padrão APG Toolbar)', () => {
    render(<GraficoProtagonista visao={VISAO_GERAL_FAKE} />);
    const barra = screen.getByRole('toolbar', { name: 'Modo do gráfico' });
    expect(barra).toBe(screen.getByTestId('grafico-modos'));
    expect(within(barra).getAllByRole('button')).toHaveLength(3);
  });

  it('navegação por teclado no controle de modo: setas movem seleção e foco (roving tabIndex)', () => {
    render(<GraficoProtagonista visao={VISAO_GERAL_FAKE} />);
    const geral = screen.getByRole('button', { name: 'Geral' });
    expect(geral).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'Grande área' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: 'Aluno' })).toHaveAttribute('tabindex', '-1');

    geral.focus();
    fireEvent.keyDown(geral, { key: 'ArrowRight' });
    const porArea = screen.getByRole('button', { name: 'Grande área' });
    expect(porArea).toHaveAttribute('aria-pressed', 'true');
    expect(porArea).toHaveFocus();
    expect(porArea).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('img', { name: /Desempenho por grande área/i })).toBeInTheDocument();

    fireEvent.keyDown(porArea, { key: 'ArrowRight' });
    const porAluno = screen.getByRole('button', { name: 'Aluno' });
    expect(porAluno).toHaveAttribute('aria-pressed', 'true');
    expect(porAluno).toHaveFocus();

    // ArrowRight no último segmento roda de volta para o primeiro (wrap).
    fireEvent.keyDown(porAluno, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Geral' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.keyDown(screen.getByRole('button', { name: 'Geral' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: 'Aluno' })).toHaveAttribute('aria-pressed', 'true');

    // Home/End vão direto às pontas, como manda o padrão APG Toolbar.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Aluno' }), { key: 'Home' });
    expect(screen.getByRole('button', { name: 'Geral' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Geral' }), { key: 'End' });
    expect(screen.getByRole('button', { name: 'Aluno' })).toHaveAttribute('aria-pressed', 'true');
  });

  /**
   * Item B2 do passe de conformidade (`docs/06-data-viz.md:23`: "troca o
   * conjunto de séries com fade cruzado"). O conteúdo some/aparece por
   * `opacity` (nunca `transform`/translação/escala — decisão registrada no
   * item), com a duração/curva do handoff em `style` (nunca classe
   * arbitrária do Tailwind, que o guard de `tema.test.tsx` reprova).
   */
  describe('fade cruzado na troca de modo (item B2)', () => {
    it('o contêiner do conteúdo declara transição de opacity com --gp-motion-3/--gp-ease, nunca transform/translação/escala', () => {
      render(<GraficoProtagonista visao={VISAO_GERAL_FAKE} />);
      const conteudo = screen.getByTestId('grafico-protagonista-conteudo');

      expect(conteudo.style.transitionProperty).toBe('opacity');
      expect(conteudo.style.transitionDuration).toBe('var(--gp-motion-3)');
      expect(conteudo.style.transitionTimingFunction).toBe('var(--gp-ease)');
      expect(conteudo.style.transform).toBe('');
      expect(conteudo.getAttribute('style')).not.toMatch(/translate|scale/);
    });

    it('nasce em opacity 0 e sobe para 1 um quadro depois — é o que dá à transição CSS de onde partir', async () => {
      render(<GraficoProtagonista visao={VISAO_GERAL_FAKE} />);
      await waitFor(() =>
        expect(screen.getByTestId('grafico-protagonista-conteudo').style.opacity).toBe('1'),
      );
    });

    it('trocar de modo REMONTA o contêiner de fade (key={modo}) — cada modo ganha seu próprio ciclo de fade-in', async () => {
      const user = userEvent.setup();
      render(<GraficoProtagonista visao={VISAO_GERAL_FAKE} />);
      await waitFor(() =>
        expect(screen.getByTestId('grafico-protagonista-conteudo').style.opacity).toBe('1'),
      );
      const contedoAntes = screen.getByTestId('grafico-protagonista-conteudo');

      await user.click(screen.getByRole('button', { name: 'Grande área' }));

      const conteudoDepois = screen.getByTestId('grafico-protagonista-conteudo');
      expect(conteudoDepois).not.toBe(contedoAntes);
      await waitFor(() => expect(conteudoDepois.style.opacity).toBe('1'));
    });

    it('as três séries seguem sem animação própria (isAnimationActive={false} continua cravado — decisão separada de 05/08)', async () => {
      const user = userEvent.setup();
      render(<GraficoProtagonista visao={VISAO_GERAL_FAKE} />);

      await user.click(screen.getByRole('button', { name: 'Grande área' }));
      expect(screen.getByRole('img', { name: /Desempenho por grande área/i })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Aluno' }));
      expect(screen.getByRole('img', { name: /Dispersão de proficiência por semestre/i })).toBeInTheDocument();
      // A garantia de `isAnimationActive={false}` propriamente dita é
      // travada por análise estática em `movimentoGraficos.test.tsx`
      // (EvolucaoChart/AreasChart/DispersaoChart); aqui só se confirma que a
      // troca de modo continua funcionando com o contêiner de fade no meio.
    });
  });
});
