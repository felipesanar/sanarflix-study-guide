import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/utils';
import {
  AnelDeFoco,
  DispersaoChart,
  medianaDeNotas,
  prepararPontos,
} from '@/features/gestor/charts/DispersaoChart';
import type { VisaoGeral } from '@/features/gestor/api/types';

const DIM = { largura: 640, altura: 320 };

/**
 * Mesmos valores da fixture compartilhada da Fase 4 (`visaoGeralFake.dispersao`,
 * Task 37) — replicados aqui porque a Task 37 é de outro agente em paralelo e
 * `__tests__/fixtures/visaoGeral.ts` ainda não existe neste working tree. Ver
 * pendências: quando a fixture compartilhada landar, este arquivo pode trocar
 * para importá-la sem mudar nenhuma expectativa (os valores são idênticos).
 */
const DOIS_SEMESTRES: VisaoGeral['dispersao'] = [
  { alunoId: 'a1', semestre: 11, nota: 72 },
  { alunoId: 'a2', semestre: 11, nota: 58 },
  { alunoId: 'a3', semestre: 11, nota: 64 },
  { alunoId: 'a4', semestre: 12, nota: 81 },
  { alunoId: 'a5', semestre: 12, nota: 49 },
  { alunoId: 'a6', semestre: 12, nota: 66 },
];

const UM_SEMESTRE: VisaoGeral['dispersao'] = [
  { alunoId: 'a1', semestre: 11, nota: 40 },
  { alunoId: 'a2', semestre: 11, nota: 55 },
  { alunoId: 'a3', semestre: 11, nota: 70 },
];

describe('prepararPontos', () => {
  /**
   * O jitter passou a valer para TODO recorte (reunião de 07/08), não só para
   * o de um semestre: o eixo X é discreto, então cada semestre virava uma
   * coluna de 1px com dezenas de alunos empilhados no mesmo pixel — a nuvem
   * lia como uma régua. Era justamente onde há MAIS alunos que ele faltava.
   */
  it('espalha os pontos dentro de cada semestre, também com mais de um semestre', () => {
    const preparados = prepararPontos(DOIS_SEMESTRES);

    const doOnze = preparados.filter((p) => p.semestre === 11).map((p) => p.x);
    const doDoze = preparados.filter((p) => p.semestre === 12).map((p) => p.x);
    expect(new Set(doOnze).size).toBe(doOnze.length);
    expect(new Set(doDoze).size).toBe(doDoze.length);

    // Cada nuvem fica dentro da sua coluna: as duas nunca se encostam.
    expect(Math.max(...doOnze)).toBeLessThan(Math.min(...doDoze));
  });

  /** O deslocamento nunca ultrapassa a meia-distância entre duas colunas. */
  it('mantém cada ponto perto do seu próprio semestre', () => {
    prepararPontos(DOIS_SEMESTRES).forEach((p) => {
      // 0.3001: a subtração reintroduz ruído de float mesmo com `x` já
      // arredondado (10.7 - 11 = -0.30000000000000071). O limite real é 0.3.
      expect(Math.abs(p.x - p.semestre)).toBeLessThanOrEqual(0.3001);
    });
  });

  it('aplica jitter determinístico quando há um único semestre', () => {
    const preparados = prepararPontos(UM_SEMESTRE);
    const xs = preparados.map((p) => p.x);
    expect(new Set(xs).size).toBe(3);
    xs.forEach((x) => expect(Math.abs(x - 11)).toBeLessThanOrEqual(0.3001));
    // Determinístico: a mesma entrada devolve exatamente as mesmas posições.
    expect(prepararPontos(UM_SEMESTRE).map((p) => p.x)).toEqual(xs);
  });
});

describe('medianaDeNotas', () => {
  it('calcula a mediana com número ímpar de pontos', () => {
    expect(medianaDeNotas(UM_SEMESTRE)).toBe(55);
  });

  it('calcula a mediana com número par de pontos', () => {
    expect(medianaDeNotas([...UM_SEMESTRE, { alunoId: 'a4', semestre: 11, nota: 80 }])).toBe(62.5);
  });
});

describe('DispersaoChart (modo Aluno)', () => {
  it('desenha um símbolo por aluno e é acessível como imagem', () => {
    const { container } = render(<DispersaoChart pontos={DOIS_SEMESTRES} {...DIM} />);
    expect(screen.getByRole('img', { name: /Dispersão de proficiência por semestre/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.recharts-scatter-symbol')).toHaveLength(6);
  });

  /**
   * docs/06-data-viz.md §3: ponto de aluno em opacidade 0.75 e cor NEUTRA. A
   * marca fica reservada para o que o gráfico AFIRMA (mediana, tendência) —
   * com a nuvem inteira em vermelho, os três liam como a mesma série.
   */
  it('pinta a nuvem em cor neutra a 75% de opacidade, sem competir com a marca', () => {
    const { container } = render(<DispersaoChart pontos={DOIS_SEMESTRES} {...DIM} />);
    const simbolo = container.querySelector('.recharts-scatter-symbol path');
    expect(simbolo?.getAttribute('fill')).toBe('var(--gp-text-3)');
    expect(simbolo?.getAttribute('fill-opacity')).toBe('0.75');
  });

  /** docs/06-data-viz.md §3: "ponto sob hover ganha anel". */
  it('a forma ativa do ponto é um anel da marca, sem expor nada do aluno', () => {
    const { container } = render(<AnelDeFoco cx={40} cy={20} />);
    const circulos = Array.from(container.querySelectorAll('circle'));
    expect(circulos.map((no) => no.getAttribute('r'))).toEqual(['4', '8']);
    expect(circulos[1].getAttribute('fill')).toBe('none');
    expect(circulos[1].getAttribute('stroke')).toBe('var(--gp-brand)');
  });

  /**
   * Cores trocadas entre meta e mediana (reunião de 07/08): "do jeito que tá
   * hoje induz o cara a olhar mais pra essa mediana, mas na verdade o que
   * importa pra ele é a meta". A meta é o corte de negócio e agora leva a
   * linha sólida de marca; a mediana, que é descritiva, virou o traço neutro.
   */
  it('a meta de proficiência é a linha de MARCA, sólida — não o tracejado neutro', () => {
    const { container } = render(<DispersaoChart pontos={DOIS_SEMESTRES} {...DIM} />);
    const corte = container.querySelector('.recharts-reference-line-line');
    expect(corte).not.toBeNull();
    expect(corte?.getAttribute('stroke')).toBe('var(--gp-brand)');
    expect(corte?.getAttribute('stroke-width')).toBe('2');
    expect(corte?.getAttribute('stroke-dasharray')).toBeNull();
    expect(container.querySelector('.recharts-reference-line text')?.textContent).toBe(
      'meta de proficiência · 60',
    );
    expect(screen.getByText(/Corte de proficiência: 60/i)).toBeInTheDocument();
  });

  /** Handoff §7: a dispersão é o único gráfico que mantém grade vertical. */
  it('mantém grade sólida nos dois eixos — só aqui há grade vertical', () => {
    const { container } = render(<DispersaoChart pontos={DOIS_SEMESTRES} {...DIM} />);
    const linhas = Array.from(container.querySelectorAll('.recharts-cartesian-grid line'));
    expect(linhas.length).toBeGreaterThan(0);
    linhas.forEach((linha) => expect(linha.getAttribute('stroke-dasharray')).toBeNull());
    expect(container.querySelector('.recharts-cartesian-grid-vertical line')).not.toBeNull();
  });

  it('desenha a linha de tendência tracejada quando o servidor a fornece, e a declara na legenda', () => {
    const { container } = render(
      <DispersaoChart
        pontos={DOIS_SEMESTRES}
        tendencia={[{ semestre: 11, nota: 58 }, { semestre: 12, nota: 66 }]}
        {...DIM}
      />
    );
    const reta = container.querySelector('.recharts-scatter-line line, .recharts-scatter-line path');
    expect(reta).not.toBeNull();
    expect(reta?.getAttribute('stroke-dasharray')).toBe('5 4');
    expect(screen.getByText('Linha de tendência')).toBeInTheDocument();
    expect(screen.queryByText(/ainda não é publicada/i)).not.toBeInTheDocument();
  });

  /**
   * Sem reta, o aviso fala do CONTRATO, não do recorte: a reta é calculada no
   * servidor (§4.11) e nenhuma RPC do portal a publica hoje. "Indisponível
   * para este recorte" mandava o gestor trocar de filtro atrás de um dado que
   * não existe em nenhum.
   */
  it('sem tendência do servidor não desenha reta e diz que o dado ainda não é publicado', () => {
    const { container } = render(<DispersaoChart pontos={DOIS_SEMESTRES} {...DIM} />);
    expect(container.querySelector('.recharts-scatter-line')).toBeNull();
    expect(screen.getByText('A reta de tendência ainda não é publicada pelo servidor.')).toBeInTheDocument();
    expect(screen.queryByText(/indisponível para este recorte/i)).not.toBeInTheDocument();
  });

  it('com um único semestre vira distribuição interna: jitter + mediana em destaque', () => {
    const { container } = render(<DispersaoChart pontos={UM_SEMESTRE} {...DIM} />);
    expect(container.querySelectorAll('.recharts-scatter-symbol')).toHaveLength(3);
    expect(screen.getByText(/Mediana do semestre: 55/i)).toBeInTheDocument();
  });

  /** docs/06-data-viz.md, princípio 7: o vazio é desenhado, não um bloco branco. */
  it('o estado vazio mantém a moldura do gráfico', () => {
    render(<DispersaoChart pontos={[]} {...DIM} />);
    const vazio = screen.getByTestId('dispersao-vazio');
    expect(vazio).toHaveTextContent('Sem alunos com resultado neste recorte');
    expect(vazio).toHaveTextContent('meta de proficiência · 60');
    ['100', '80', '40', '20', '0'].forEach((tick) => expect(vazio).toHaveTextContent(tick));
  });

  it('nunca expõe alunoId em atributo, tooltip, label ou tabela de dados no DOM', () => {
    const { container } = render(<DispersaoChart pontos={DOIS_SEMESTRES} {...DIM} />);
    DOIS_SEMESTRES.forEach((ponto) => {
      expect(container.innerHTML).not.toContain(ponto.alunoId);
    });
  });

  /**
   * Achado 2 (revisão de 05/08), mesma classe já corrigida em `AreasChart`:
   * `role="img"` no `<figure>` torna todo descendente "presentational" (ARIA
   * 1.2, Children Presentational: True), podando a `<figcaption>` — que carrega
   * o corte, a mediana e a legenda — e a tabela colapsável exigida pelo handoff
   * §5 da árvore de acessibilidade.
   */
  it('mantém role="img" restrito ao desenho, sem podar figcaption e tabela da árvore de acessibilidade', () => {
    const { container } = render(<DispersaoChart pontos={UM_SEMESTRE} {...DIM} />);

    const imagem = container.querySelector('[role="img"]');
    expect(imagem).not.toBeNull();
    expect(imagem?.querySelector('details, summary, table, figcaption')).toBeNull();

    expect(screen.getByTestId('dispersao-tabela')).toBeInTheDocument();
    expect(screen.getByText(/Mediana do semestre: 55/i)).toBeInTheDocument();
  });

  /**
   * Spec de movimento §5, item 3: "nunca um retângulo cinza" — o skeleton da
   * dispersão desenha eixos reais e uma nuvem de pontos fixa em opacidade
   * 0.18, não um bloco genérico.
   */
  describe('carregando (skeleton com eixos reais e nuvem fixa, spec de movimento §5)', () => {
    it('ignora pontos e desenha os eixos reais (grade, eixo Y 0–100) com uma nuvem fixa a 0.18 de opacidade', () => {
      const { container } = render(<DispersaoChart pontos={DOIS_SEMESTRES} carregando {...DIM} />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-busy', 'true');

      const ticksY = Array.from(
        container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value'),
      ).map((no) => no.textContent);
      expect(ticksY).toEqual(['0', '20', '40', '80', '100']);

      const simbolos = Array.from(container.querySelectorAll('.recharts-scatter-symbol path'));
      expect(simbolos.length).toBeGreaterThan(0);
      simbolos.forEach((simbolo) => expect(simbolo.getAttribute('fill-opacity')).toBe('0.18'));

      // Nenhum dado real chega ao DOM enquanto carrega, e nenhum alunoId dos
      // pontos reais aparece na nuvem fixa.
      expect(screen.queryByTestId('dispersao-tabela')).not.toBeInTheDocument();
      DOIS_SEMESTRES.forEach((ponto) => expect(container.innerHTML).not.toContain(ponto.alunoId));
    });

    it('não mostra o estado vazio quando carregando, mesmo com pontos=[]', () => {
      render(<DispersaoChart pontos={[]} carregando {...DIM} />);
      expect(screen.queryByTestId('dispersao-vazio')).not.toBeInTheDocument();
      expect(screen.getByTestId('dispersao-carregando')).toBeInTheDocument();
    });
  });
});
