import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { KpisDetalhamentoMentor, type KpisDetalhamentoMentorProps } from '@/features/mentor/components/KpisDetalhamentoMentor';

vi.mock('@/features/gestor/hooks/useCountUp', () => ({ useCountUp: (v: number | null) => v }));
const props: KpisDetalhamentoMentorProps = {
  modalidade: 'b2c', estado: 'ok', acertoMedio: 68.5, participantes: 80, totalTurma: 100,
  meta: { periodo: '2026', fonte: 'Simulados', atualizadoEm: '2026-11-04', criterio: 'Participantes', partial: false, lowSample: false },
  porSimulado: [
    { rotulo: '4º', participacao: 70, possivelAprovacaoPct: 40, conceito: 3, proficienciaMedia: 55, proficientesPct: 50 },
    { rotulo: '5º', participacao: 80, possivelAprovacaoPct: 45, conceito: 4, proficienciaMedia: 58, proficientesPct: 60 },
  ],
};
const montar = (p: KpisDetalhamentoMentorProps) => render(<TooltipProvider><KpisDetalhamentoMentor {...p} /></TooltipProvider>);

it('B2C reutiliza valores e anatomia do KpiCard com delta e régua', () => {
  montar(props);
  expect(screen.getByText('68,5%')).toBeVisible();
  const aprovacao = within(screen.getByTestId('kpi-possivel-aprovacao'));
  expect(aprovacao.getByTestId('kpi-delta')).toHaveTextContent('+5');
  expect(aprovacao.getByTestId('kpi-regua')).toBeVisible();
  expect(within(screen.getByTestId('kpi-participacao')).getByTestId('kpi-valor')).toHaveTextContent('80');
});

it('B2B marca ambas projeções e não calcula média dos conceitos', () => {
  montar({ ...props, modalidade: 'b2b' });
  expect(screen.getAllByText('projetado')).toHaveLength(2);
  expect(within(screen.getByTestId('kpi-conceito')).getByTestId('kpi-valor')).toHaveTextContent('4');
  expect(screen.queryByText('Possível aprovação')).not.toBeInTheDocument();
});

it('sem dados mostra — e não exibe delta nem régua', () => {
  montar({ ...props, estado: 'empty', acertoMedio: null, porSimulado: [] });
  expect(screen.getAllByTestId('kpi-valor').map(el => el.textContent)).toEqual(['—', '—', '—']);
  expect(screen.queryByTestId('kpi-delta')).not.toBeInTheDocument();
  expect(screen.queryByTestId('kpi-regua')).not.toBeInTheDocument();
});

it('duas entradas com apenas um ponto válido não geram régua nem delta', () => {
  montar({ ...props, porSimulado: [{ ...props.porSimulado[0], possivelAprovacaoPct: null }, props.porSimulado[1]] });
  expect(screen.queryByTestId('kpi-regua')).not.toBeInTheDocument();
  expect(screen.queryByTestId('kpi-delta')).not.toBeInTheDocument();
});

it('null atual não é substituído pelo dado do simulado anterior', () => {
  montar({ ...props, modalidade: 'b2b', porSimulado: [props.porSimulado[0], { ...props.porSimulado[1], conceito: null, proficienciaMedia: null }] });
  expect(within(screen.getByTestId('kpi-conceito')).getByTestId('kpi-valor')).toHaveTextContent('—');
  expect(screen.queryByTestId('kpi-delta')).not.toBeInTheDocument();
  expect(screen.queryByTestId('kpi-regua')).not.toBeInTheDocument();
});
