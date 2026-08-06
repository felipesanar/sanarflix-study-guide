import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@/test/utils';
import { KpisDetalhamento } from '@/features/gestor/components/KpisDetalhamento';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import type { Meta, MetricasSimulado } from '@/features/gestor/api/types';

const META: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados SanarFlix',
  atualizadoEm: '2026-07-20T13:00:00Z',
  criterio: 'Proficiente = proficiência maior ou igual a 60',
  partial: false,
  lowSample: false,
};

const metrica = (over: Partial<MetricasSimulado>): MetricasSimulado => ({
  simuladoId: 's1',
  nome: 'Simulado 1',
  data: '2026-03-10T13:00:00Z',
  participantes: 100,
  acertoMedioPct: 60,
  enamedProjetado: 3,
  proficienciaMedia: 55,
  ...over,
});

describe('KpisDetalhamento', () => {
  it('mostra exatamente os 3 KPIs do Detalhamento, sem "simulados realizados" (§4.7.6)', () => {
    render(<KpisDetalhamento metricas={[metrica({})]} meta={META} />);

    expect(screen.getByTestId('kpi-acerto-medio')).toHaveTextContent('Percentual de acerto médio');
    expect(screen.getByTestId('kpi-enamed')).toHaveTextContent('Conceito ENAMED');
    expect(screen.getByTestId('kpi-enamed')).toHaveTextContent('projetado');
    expect(screen.getByTestId('kpi-proficiencia-media')).toHaveTextContent('Proficiência média');
    // regex restrita aos 3 cards — /^kpi-/ sozinho também casaria com o testid interno "kpi-valor"
    expect(screen.getAllByTestId(/^kpi-(acerto-medio|enamed|proficiencia-media)$/)).toHaveLength(3);
    expect(screen.queryByText(/simulados realizados/i)).toBeNull();
  });

  it('com 1 simulado mostra os valores daquele simulado', () => {
    render(<KpisDetalhamento metricas={[metrica({ acertoMedioPct: 61, proficienciaMedia: 58, enamedProjetado: 3 })]} meta={META} />);

    expect(within(screen.getByTestId('kpi-acerto-medio')).getByTestId('kpi-valor')).toHaveTextContent('61%');
    expect(within(screen.getByTestId('kpi-enamed')).getByTestId('kpi-valor')).toHaveTextContent('3/5');
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-valor')).toHaveTextContent('58');
  });

  it('a proficiência média mostra a escala 0–100 em elemento próprio', () => {
    render(<KpisDetalhamento metricas={[metrica({ proficienciaMedia: 58 })]} meta={META} />);
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-sufixo')).toHaveTextContent('/ 100');
  });

  it('com 2+ simulados recalcula as médias sobre o conjunto', () => {
    render(
      <KpisDetalhamento
        metricas={[
          metrica({ simuladoId: 's1', nome: 'Simulado 1', participantes: 100, acertoMedioPct: 60, proficienciaMedia: 55, enamedProjetado: 3 }),
          metrica({ simuladoId: 's2', nome: 'Simulado 2', participantes: 100, acertoMedioPct: 70, proficienciaMedia: 65, enamedProjetado: 4 }),
        ]}
        meta={META}
      />,
    );

    expect(within(screen.getByTestId('kpi-acerto-medio')).getByTestId('kpi-valor')).toHaveTextContent('65%');
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-valor')).toHaveTextContent('60');
    expect(screen.getByTestId('kpi-acerto-medio')).toHaveTextContent('2 simulados');
  });

  it('com 2+ simulados o Conceito ENAMED vira comparativo, nunca média (§4.1, §12 caso 3)', () => {
    render(
      <KpisDetalhamento
        metricas={[
          metrica({ simuladoId: 's1', nome: 'Simulado 1', enamedProjetado: 3 }),
          metrica({ simuladoId: 's2', nome: 'Simulado 2', enamedProjetado: 4 }),
        ]}
        meta={META}
      />,
    );

    const enamed = screen.getByTestId('kpi-enamed');
    expect(enamed).toHaveTextContent('comparativo');
    expect(within(enamed).queryByTestId('kpi-valor')).toBeNull();
    expect(within(enamed).getByTestId('enamed-s1')).toHaveTextContent('Simulado 1');
    expect(within(enamed).getByTestId('enamed-s1')).toHaveTextContent('3/5');
    expect(within(enamed).getByTestId('enamed-s2')).toHaveTextContent('4/5');
    expect(within(enamed).getAllByTestId(/^enamed-/)).toHaveLength(2);
  });

  /**
   * A referência escreve no rodapé do acerto médio a BASE DE PARTICIPAÇÃO
   * ("98 participantes de 104 elegíveis"), não a contagem de simulados: a
   * pergunta que o rodapé responde é "sobre quem esta média foi calculada".
   */
  it('o rodapé do acerto médio diz sobre quem a média foi calculada', () => {
    render(<KpisDetalhamento metricas={[metrica({ participantes: 98 })]} meta={META} />);
    expect(within(screen.getByTestId('kpi-acerto-medio')).getByTestId('kpi-rodape')).toHaveTextContent(
      '98 participantes',
    );
  });

  /**
   * Com 2+ simulados a soma é de PARTICIPAÇÕES — o mesmo aluno participa de
   * vários simulados, e chamar isso de "participantes" inflaria a turma. É o
   * peso que a média ponderada usa como denominador.
   */
  it('com 2+ simulados o rodapé soma participações, nunca alunos distintos', () => {
    render(
      <KpisDetalhamento
        metricas={[
          metrica({ simuladoId: 's1', participantes: 98 }),
          metrica({ simuladoId: 's2', participantes: 100 }),
        ]}
        meta={META}
      />,
    );
    const rodape = within(screen.getByTestId('kpi-acerto-medio')).getByTestId('kpi-rodape');
    expect(rodape).toHaveTextContent('198 participações');
    expect(rodape).not.toHaveTextContent('198 participantes');
  });

  /** O corte vem de `lib/regras.ts`; a copy nunca datilografa o 60 por conta própria. */
  it('o rodapé da proficiência situa a média contra a régua única, acima e abaixo', () => {
    const { rerender } = render(
      <KpisDetalhamento metricas={[metrica({ proficienciaMedia: 63 })]} meta={META} />,
    );
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-rodape')).toHaveTextContent(
      `acima da meta de proficiência (${PROFICIENCIA_MINIMA})`,
    );

    rerender(<KpisDetalhamento metricas={[metrica({ proficienciaMedia: 55 })]} meta={META} />);
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-rodape')).toHaveTextContent(
      `abaixo da meta de proficiência (${PROFICIENCIA_MINIMA})`,
    );
  });

  /** Exatamente 60 é proficiente: a régua é `>=` em todas as RPCs de produção. */
  it('exatamente na régua a média conta como acima, nunca abaixo', () => {
    render(<KpisDetalhamento metricas={[metrica({ proficienciaMedia: PROFICIENCIA_MINIMA })]} meta={META} />);
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-rodape')).toHaveTextContent(
      'acima da meta',
    );
  });

  /**
   * O peso da média ponderada é `participantes`, que a RPC devolve como
   * `GREATEST(n_resp, n_tri)` — mas proficiência só existe para quem tem nota
   * calculada. Com um simulado recém-encerrado (muitas respostas, poucas
   * notas) o peso errado INVERTE o veredito: 70×200 e 40×190 dão 55,4
   * ("abaixo"), enquanto ponderar pelos alunos que realmente têm nota passa de
   * 60. Como o cartão não sabe o peso certo, não escolhe lado nenhum.
   */
  it('com simulados dos dois lados da meta, o rodapé não afirma lado nenhum — o peso é que decidiria', () => {
    render(
      <KpisDetalhamento
        metricas={[
          metrica({ simuladoId: 's1', participantes: 200, proficienciaMedia: 70 }),
          metrica({ simuladoId: 's2', participantes: 190, proficienciaMedia: 40 }),
        ]}
        meta={META}
      />,
    );
    const rodape = within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-rodape');
    expect(rodape).not.toHaveTextContent(/acima|abaixo/);
    expect(rodape).toHaveTextContent(`dos dois lados da meta (${PROFICIENCIA_MINIMA})`);
  });

  /**
   * A média ponderada fica sempre ENTRE a menor e a maior das proficiências
   * que entraram na conta: com todas do mesmo lado da régua, nenhum peso muda
   * o veredito e suprimi-lo seria calar uma informação verdadeira.
   */
  it('com todos os simulados do mesmo lado da meta, o veredito continua sendo dito', () => {
    const { rerender } = render(
      <KpisDetalhamento
        metricas={[
          metrica({ simuladoId: 's1', participantes: 200, proficienciaMedia: 63 }),
          metrica({ simuladoId: 's2', participantes: 190, proficienciaMedia: 70 }),
        ]}
        meta={META}
      />,
    );
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-rodape')).toHaveTextContent(
      'acima da meta',
    );

    rerender(
      <KpisDetalhamento
        metricas={[
          metrica({ simuladoId: 's1', participantes: 200, proficienciaMedia: 40 }),
          metrica({ simuladoId: 's2', participantes: 190, proficienciaMedia: 55 }),
        ]}
        meta={META}
      />,
    );
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-rodape')).toHaveTextContent(
      'abaixo da meta',
    );
  });

  /**
   * Simulado sem proficiência (ou sem participante) fica fora da média — e,
   * pelo mesmo motivo, não pode puxar o veredito para "depende do peso": a
   * condição de entrada aqui é a mesma de `mediaPonderadaPorParticipantes`.
   */
  it('simulado fora da média não bloqueia o veredito dos que entraram nela', () => {
    render(
      <KpisDetalhamento
        metricas={[
          metrica({ simuladoId: 's1', participantes: 200, proficienciaMedia: 70 }),
          metrica({ simuladoId: 's2', participantes: 0, proficienciaMedia: 40 }),
          metrica({ simuladoId: 's3', participantes: 150, proficienciaMedia: null }),
        ]}
        meta={META}
      />,
    );
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-rodape')).toHaveTextContent(
      'acima da meta',
    );
  });

  it('sem proficiência medida o rodapé não afirma "acima" nem "abaixo" de nada (§4.10)', () => {
    render(<KpisDetalhamento metricas={[metrica({ proficienciaMedia: null })]} meta={META} />);
    const rodape = within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-rodape');
    expect(rodape).not.toHaveTextContent(/acima|abaixo/);
    expect(rodape).toHaveTextContent('1 simulado');
  });

  /**
   * Com 1 simulado o cartão do conceito ainda enuncia a regra: é onde a gestora
   * aprende que o conceito nunca vira média, antes de selecionar o segundo
   * simulado e ver o cartão mudar de forma.
   */
  it('o cartão do conceito enuncia a regra "sem média" mesmo com 1 simulado', () => {
    render(<KpisDetalhamento metricas={[metrica({})]} meta={META} />);
    expect(within(screen.getByTestId('kpi-enamed')).getByTestId('kpi-rodape')).toHaveTextContent('sem média');
  });

  it('valor ausente aparece como travessão, nunca como zero (§4.10)', () => {
    render(<KpisDetalhamento metricas={[metrica({ acertoMedioPct: null, proficienciaMedia: null, enamedProjetado: null })]} meta={META} />);

    expect(within(screen.getByTestId('kpi-acerto-medio')).getByTestId('kpi-valor')).toHaveTextContent('—');
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-valor')).toHaveTextContent('—');
    expect(within(screen.getByTestId('kpi-enamed')).getByTestId('kpi-valor')).toHaveTextContent('—');
  });

  it('sem proficiência medida, nem a escala "/ 100" é afirmada', () => {
    render(<KpisDetalhamento metricas={[metrica({ proficienciaMedia: null })]} meta={META} />);
    expect(within(screen.getByTestId('kpi-proficiencia-media')).queryByTestId('kpi-sufixo')).toBeNull();
  });

  /**
   * Antes do passe de conformidade a rastreabilidade dos três indicadores era
   * um único parágrafo sob a grade, comum aos três — e formatado com
   * `formatData`, que mostra a data-calendário em UTC. Agora cada cartão tem
   * o seu `info`, com o instante convertido para Brasília.
   */
  it('cada um dos 3 cartões carrega a sua própria rastreabilidade (§4.1)', () => {
    render(<KpisDetalhamento metricas={[metrica({})]} meta={META} />);

    expect(screen.getAllByRole('button', { name: /rastreabilidade/i })).toHaveLength(3);
    expect(screen.queryByTestId('kpis-rastreabilidade')).toBeNull();

    const rastros = screen.getAllByTestId('rastreabilidade-texto');
    rastros.forEach((rastro) => {
      expect(rastro).toHaveTextContent('2026.1');
      expect(rastro).toHaveTextContent('Simulados SanarFlix');
      expect(rastro).toHaveTextContent('20/07/2026');
    });
  });

  it('o critério é o do indicador, não o do bloco inteiro', () => {
    render(<KpisDetalhamento metricas={[metrica({})]} meta={META} />);

    expect(within(screen.getByTestId('kpi-enamed')).getByTestId('rastreabilidade-texto')).toHaveTextContent(
      'Não existe média de conceito',
    );
    expect(
      within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('rastreabilidade-texto'),
    ).toHaveTextContent('ponderada pelo número de participantes');
  });

  /**
   * `formatData` (usada antes aqui) lê os dígitos do ISO sem converter fuso:
   * um instante UTC depois das ~21h em Brasília aparecia como o DIA SEGUINTE.
   */
  it('"Atualizado em" respeita o fuso de Brasília, nunca a data-calendário UTC', () => {
    render(<KpisDetalhamento metricas={[metrica({})]} meta={{ ...META, atualizadoEm: '2026-08-06T01:10:00Z' }} />);

    const rastro = screen.getAllByTestId('rastreabilidade-texto')[0];
    expect(rastro).toHaveTextContent('05/08/2026');
    expect(rastro).not.toHaveTextContent('06/08/2026');
  });
});
