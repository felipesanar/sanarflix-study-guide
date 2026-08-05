import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@/test/utils';
import { KpisDetalhamento } from '@/features/gestor/components/KpisDetalhamento';
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
    expect(screen.getByTestId('kpi-enamed')).toHaveTextContent('Conceito ENAMED (projetado)');
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

  it('valor ausente aparece como travessão, nunca como zero (§4.10)', () => {
    render(<KpisDetalhamento metricas={[metrica({ acertoMedioPct: null, proficienciaMedia: null, enamedProjetado: null })]} meta={META} />);

    expect(within(screen.getByTestId('kpi-acerto-medio')).getByTestId('kpi-valor')).toHaveTextContent('—');
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-valor')).toHaveTextContent('—');
    expect(within(screen.getByTestId('kpi-enamed')).getByTestId('kpi-valor')).toHaveTextContent('—');
  });

  it('carrega a rastreabilidade do bloco (§4.1)', () => {
    render(<KpisDetalhamento metricas={[metrica({})]} meta={META} />);

    const rastro = screen.getByTestId('kpis-rastreabilidade');
    expect(rastro).toHaveTextContent('2026.1');
    expect(rastro).toHaveTextContent('Simulados SanarFlix');
    expect(rastro).toHaveTextContent('20/07/2026');
    expect(rastro).toHaveTextContent('Proficiente = proficiência maior ou igual a 60');
  });
});
