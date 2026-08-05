import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { EvolucaoRecorte, ehSemestreEspecifico } from '@/features/gestor/components/EvolucaoRecorte';
import type { MetricasSimulado } from '@/features/gestor/api/types';

const propsEvolucaoChart = vi.fn();
vi.mock('@/features/gestor/charts/EvolucaoChart', () => ({
  EvolucaoChart: (props: unknown) => {
    propsEvolucaoChart(props);
    return <div data-testid="evolucao-chart" />;
  },
}));

const propsDispersaoChart = vi.fn();
vi.mock('@/features/gestor/charts/DispersaoChart', () => ({
  DispersaoChart: (props: unknown) => {
    propsDispersaoChart(props);
    return <div data-testid="dispersao-chart" />;
  },
}));

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

const METRICAS = [
  metrica({ simuladoId: 's1', nome: 'Simulado 1', proficienciaMedia: 55, participantes: 100 }),
  metrica({ simuladoId: 's2', nome: 'Simulado 2', proficienciaMedia: 62, participantes: 90 }),
];

const DISPERSAO = [
  { alunoId: 'a1', semestre: 11, nota: 40 },
  { alunoId: 'a2', semestre: 11, nota: 60 },
  { alunoId: 'a3', semestre: 11, nota: 80 },
  { alunoId: 'a4', semestre: 12, nota: 70 },
];

describe('EvolucaoRecorte', () => {
  it('ehSemestreEspecifico distingue os agregadores dos semestres (§4.5)', () => {
    expect(ehSemestreEspecifico('6ano')).toBe(false);
    expect(ehSemestreEspecifico('geral')).toBe(false);
    expect(ehSemestreEspecifico('11')).toBe(true);
  });

  it('com 6º ano mostra o EvolucaoChart real, com pontos mapeados de MetricasSimulado', () => {
    propsEvolucaoChart.mockClear();
    render(<EvolucaoRecorte metricas={METRICAS} semestre="6ano" dispersao={DISPERSAO} />);

    expect(screen.getByRole('heading', { name: 'Evolução do recorte' })).toBeInTheDocument();
    expect(screen.getByTestId('evolucao-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('dispersao-chart')).toBeNull();
    expect(propsEvolucaoChart).toHaveBeenCalledWith(
      expect.objectContaining({
        pontos: [
          { simuladoId: 's1', nome: 'Simulado 1', data: METRICAS[0].data, valor: 55, participantes: 100 },
          { simuladoId: 's2', nome: 'Simulado 2', data: METRICAS[1].data, valor: 62, participantes: 90 },
        ],
      }),
    );
  });

  it('com "geral" também mostra o EvolucaoChart', () => {
    render(<EvolucaoRecorte metricas={METRICAS} semestre="geral" dispersao={DISPERSAO} />);
    expect(screen.getByTestId('evolucao-chart')).toBeInTheDocument();
  });

  it('com um semestre específico vira a distribuição daquele semestre, via o DispersaoChart real (§4.5, §12 caso 9)', () => {
    propsDispersaoChart.mockClear();
    render(<EvolucaoRecorte metricas={METRICAS} semestre="11" dispersao={DISPERSAO} />);

    expect(screen.getByRole('heading', { name: 'Distribuição do 11º semestre' })).toBeInTheDocument();
    expect(screen.getByTestId('dispersao-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('evolucao-chart')).toBeNull();
    expect(propsDispersaoChart).toHaveBeenCalledWith(
      expect.objectContaining({
        pontos: [
          { alunoId: 'a1', semestre: 11, nota: 40 },
          { alunoId: 'a2', semestre: 11, nota: 60 },
          { alunoId: 'a3', semestre: 11, nota: 80 },
        ],
      }),
    );
  });

  it('sem aluno no semestre filtrado, passa lista vazia ao DispersaoChart (que já mostra seu próprio vazio)', () => {
    propsDispersaoChart.mockClear();
    render(<EvolucaoRecorte metricas={METRICAS} semestre="3" dispersao={DISPERSAO} />);

    expect(screen.getByTestId('dispersao-chart')).toBeInTheDocument();
    expect(propsDispersaoChart).toHaveBeenCalledWith(expect.objectContaining({ pontos: [] }));
  });
});
